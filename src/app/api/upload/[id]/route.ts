import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { files } from "@/db/schema";
import { getMembership } from "@/lib/dal";
import { storage } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Video upload when storage has no direct-upload links (local disk, Netlify
 * Blobs). With Supabase, videos go straight to storage and never come here.
 * Only the person who started the upload can send it, once.
 */
export async function PUT(req: Request, ctx: RouteContext<"/api/upload/[id]">) {
  const { id } = await ctx.params;
  const { family, member } = await getMembership();
  if (!family || !member || !/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  if (storage().signedUploadUrl) return new Response("Upload directly to storage", { status: 409 });
  const [row] = await db.select().from(files).where(and(eq(files.id, id), eq(files.familyId, family.id), eq(files.uploadedByMemberId, member.id)));
  if (!row || !row.mimeType.startsWith("video/")) return new Response("Not found", { status: 404 });
  const reader = req.body?.getReader();
  if (!reader) return new Response("No video", { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > row.sizeBytes + 1024 || size > 300 * 1024 * 1024) return new Response("Too large", { status: 413 });
    chunks.push(value);
  }
  await storage().put(row.storageKey, Buffer.concat(chunks), row.mimeType);
  await db.update(files).set({ sizeBytes: size }).where(eq(files.id, id));
  return Response.json({ ok: true });
}
