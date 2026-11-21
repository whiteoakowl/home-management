import { getMembership, getViewer } from "@/lib/dal";
import { canReadMedicalFile } from "@/lib/medical";
import { bigFileLink, readFamilyFile } from "@/lib/files";

/** Serves uploaded files to members of the owning family only. */
export async function GET(request: Request, { params }: RouteContext<"/api/files/[id]">) {
  const { id } = await params;
  const { family } = await getMembership();
  if (!family || !/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  // Medical attachments are private to whoever may see the record.
  if (!(await canReadMedicalFile(await getViewer(), id))) return new Response("Not found", { status: 404 });
  const thumb = new URL(request.url).searchParams.has("thumb");
  const download = new URL(request.url).searchParams.has("download");
  // Big files (large PDFs) go straight from storage with a 5-minute private link: the
  // host can't send more than about 6 MB through the app itself.
  if (!thumb) {
    const big = await bigFileLink(family.id, id);
    if (big) return new Response(null, { status: 302, headers: { Location: download ? `${big}${big.includes("?") ? "&" : "?"}download=` : big, "Cache-Control": "private, no-store" } });
  }
  const file = await readFamilyFile(family.id, id, thumb);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mime,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      ...(download
        ? { "Content-Disposition": `attachment; filename="${downloadName(file.name, file.mime)}"` }
        : file.mime === "application/pdf" && file.name
          ? { "Content-Disposition": `inline; filename="${file.name.replace(/"/g, "")}"` }
          : {}),
    },
  });
}

/** A tidy file name for downloads (photos are stored as WebP). */
function downloadName(name: string | null, mime: string) {
  const base = (name ?? "photo").replace(/["\r\n\\/]/g, "").slice(0, 100) || "photo";
  return mime === "image/webp" ? `${base.replace(/\.[a-z0-9]{2,5}$/i, "")}.webp` : base;
}
