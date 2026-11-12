import { getMembership } from "@/lib/dal";
import { readFamilyFile } from "@/lib/files";

/** Serves uploaded files to members of the owning family only. */
export async function GET(request: Request, { params }: RouteContext<"/api/files/[id]">) {
  const { id } = await params;
  const { family } = await getMembership();
  if (!family || !/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const thumb = new URL(request.url).searchParams.has("thumb");
  const file = await readFamilyFile(family.id, id, thumb);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mime,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      ...(file.mime === "application/pdf" && file.name ? { "Content-Disposition": `inline; filename="${file.name.replace(/"/g, "")}"` } : {}),
    },
  });
}
