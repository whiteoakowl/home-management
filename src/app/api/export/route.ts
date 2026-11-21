import { gzipSync } from "node:zlib";
import { getViewer } from "@/lib/dal";
import { exportFamily } from "@/lib/family-export";
import { rateLimit } from "@/lib/rate-limit";
import { storage } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Where a large export is kept (one per family, replaced each time, removed with the account). */
const exportKey = (familyId: string) => `${familyId}/exports/latest.json.gz`;

/**
 * Download our data (account holder only): a JSON file of the family's records.
 * Over 5 MB (the host can't send more than about 6 MB through the app), it's
 * compressed and handed over as a 10-minute private link from storage.
 */
export async function GET() {
  const viewer = await getViewer({ allowOnboarding: true });
  if (!viewer.isOwner) return new Response("Only the account holder can download the family's data.", { status: 403 });
  if (!(await rateLimit(`export:${viewer.family.id}`, 5, 3600))) return new Response("Too many downloads. Please try again later.", { status: 429 });
  const data = await exportFamily(viewer.family.id, viewer.member.id);
  const name = `${viewer.family.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "family"}-data-${new Date().toISOString().slice(0, 10)}.json`;
  const json = Buffer.from(JSON.stringify(data));
  const s = storage();
  if (json.length > 5 * 1024 * 1024 && s.signedUrl) {
    const key = exportKey(viewer.family.id);
    await s.put(key, gzipSync(json), "application/gzip");
    const link = await s.signedUrl(key, 600);
    if (link) return Response.redirect(`${link}${link.includes("?") ? "&" : "?"}download=${encodeURIComponent(`${name}.gz`)}`, 302);
  }
  return new Response(new Uint8Array(json), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="${name}"`, "cache-control": "no-store" },
  });
}
