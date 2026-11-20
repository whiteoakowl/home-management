import { getViewer } from "@/lib/dal";
import { exportFamily } from "@/lib/family-export";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Download our data (account holder only): a JSON file of the family's records. */
export async function GET() {
  const viewer = await getViewer({ allowOnboarding: true });
  if (!viewer.isOwner) return new Response("Only the account holder can download the family's data.", { status: 403 });
  if (!(await rateLimit(`export:${viewer.family.id}`, 5, 3600))) return new Response("Too many downloads. Please try again later.", { status: 429 });
  const data = await exportFamily(viewer.family.id, viewer.member.id);
  const name = `${viewer.family.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "family"}-data-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="${name}"`, "cache-control": "no-store" },
  });
}
