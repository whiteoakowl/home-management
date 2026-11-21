import { and, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { entityPhotos, familyMembers, files, memories, memoryMedia, petPhotos, pets, photoAlbums } from "@/db/schema";
import { getViewer } from "@/lib/dal";
import { albumVisible, memoryVisible } from "@/lib/memories";

export const dynamic = "force-dynamic";

const clean = (s: string) => s.replace(/[\\/:*?"<>|\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "Untitled";
const day = (d: Date | string | null | undefined) => (d ? (typeof d === "string" ? d : d.toISOString()).slice(0, 10) : "");

/**
 * Account holder: the list of the family's photos for "Download all photos"
 * (Account settings). The browser then fetches each one and builds the zip,
 * so nothing big passes through the app server. Other people's private
 * albums and memories are left out.
 */
export async function GET() {
  const viewer = await getViewer({ allowOnboarding: true });
  if (!viewer.isOwner) return new Response("Only the account holder can download the family's photos.", { status: 403 });
  const fid = viewer.family.id;
  const out: { id: string; path: string; taken: string }[] = [];
  const seen = new Set<string>();
  const add = (fileId: string, folder: string, base: string, taken: string) => {
    if (seen.has(fileId)) return;
    seen.add(fileId);
    out.push({ id: fileId, path: `${folder}/${base}.webp`, taken });
  };

  // Albums.
  const albums = await db.select().from(photoAlbums).where(albumVisible(viewer));
  if (albums.length) {
    const rows = await db.select().from(entityPhotos).where(and(eq(entityPhotos.entityType, "album"), inArray(entityPhotos.entityId, albums.map((a) => a.id)), eq(entityPhotos.mediaType, "photo")));
    const n = new Map<string, number>();
    for (const r of rows.sort((a, b) => +(a.takenAt ?? a.createdAt) - +(b.takenAt ?? b.createdAt))) {
      const a = albums.find((x) => x.id === r.entityId)!;
      const i = (n.get(a.id) ?? 0) + 1;
      n.set(a.id, i);
      const d = day(r.takenAt ?? r.createdAt);
      add(r.fileId, `Albums/${clean(a.title)}`, `${d} ${String(i).padStart(3, "0")}${r.caption ? ` ${clean(r.caption)}` : ""}`, d);
    }
  }
  // Memories.
  const mems = await db.select().from(memories).where(memoryVisible(viewer));
  if (mems.length) {
    const media = await db.select().from(memoryMedia).where(and(inArray(memoryMedia.memoryId, mems.map((m) => m.id)), eq(memoryMedia.mediaType, "photo")));
    for (const m of mems) media.filter((x) => x.memoryId === m.id).forEach((x, i) => add(x.fileId, `Memories/${m.date} ${clean(m.title)}`, String(i + 1).padStart(2, "0"), m.date));
  }
  // Profile, animal and plant photos.
  const others = await db.select().from(entityPhotos).where(and(eq(entityPhotos.familyId, fid), ne(entityPhotos.entityType, "album")));
  others.forEach((r, i) => add(r.fileId, `Other photos/${clean(r.entityType === "member" ? "People" : r.entityType === "animal" ? "Farm animals" : r.entityType === "plant" ? "Garden" : r.entityType)}`, `${day(r.createdAt)} ${String(i + 1).padStart(3, "0")}`, day(r.createdAt)));
  const petRows = await db.select({ fileId: petPhotos.fileId, name: pets.name, createdAt: petPhotos.createdAt }).from(petPhotos).innerJoin(pets, eq(pets.id, petPhotos.petId)).where(eq(pets.familyId, fid));
  petRows.forEach((r, i) => add(r.fileId, `Pets/${clean(r.name)}`, `${day(r.createdAt)} ${String(i + 1).padStart(3, "0")}`, day(r.createdAt)));
  const avatars = await db.select({ name: familyMembers.displayName, fileId: familyMembers.avatarFileId }).from(familyMembers).where(and(eq(familyMembers.familyId, fid), isNotNull(familyMembers.avatarFileId)));
  for (const a of avatars) add(a.fileId!, "Profile pictures", clean(a.name), "");

  // Only files that still exist and are images.
  const ok = out.length ? new Set((await db.select({ id: files.id }).from(files).where(and(eq(files.familyId, fid), inArray(files.id, out.map((o) => o.id))))).map((r) => r.id)) : new Set<string>();
  const list = out.filter((o) => ok.has(o.id));
  return Response.json({ family: viewer.family.name, count: list.length, photos: list }, { headers: { "cache-control": "no-store" } });
}
