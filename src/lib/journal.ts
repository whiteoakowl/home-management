import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { familyMembers, journalEntries, journalEntryFiles, journalEntryMembers } from "@/db/schema";
import { visibleTo, type Viewer } from "./dal";
import { fileUrl } from "./files";

export const MOODS = [
  { key: "happy", emoji: "😊", label: "Happy" },
  { key: "calm", emoji: "😌", label: "Calm" },
  { key: "grateful", emoji: "🙏", label: "Grateful" },
  { key: "excited", emoji: "🥳", label: "Excited" },
  { key: "tired", emoji: "😴", label: "Tired" },
  { key: "sad", emoji: "😔", label: "Sad" },
  { key: "frustrated", emoji: "😤", label: "Frustrated" },
  { key: "sick", emoji: "🤒", label: "Under the weather" },
];
export const moodOf = (k: string | null) => MOODS.find((m) => m.key === k);

/**
 * Journal visibility: private entries are author-only (parents too). The
 * family journal holds 'journal' and 'pet' entries; grimoire entries live in
 * the Witchcraft module.
 */
const visible = (viewer: Viewer) =>
  and(
    ne(journalEntries.book, "grimoire"),
    visibleTo(viewer, { id: journalEntries.id, visibility: journalEntries.visibility, author: journalEntries.authorMemberId }, "journal_entry", { parentsSeePrivate: false }),
  )!;

export async function listEntries(viewer: Viewer, opts: { from?: string; to?: string; q?: string; tag?: string; limit?: number } = {}) {
  const rows = await db
    .select({ e: journalEntries, author: familyMembers.displayName, authorColor: familyMembers.color })
    .from(journalEntries)
    .innerJoin(familyMembers, eq(familyMembers.id, journalEntries.authorMemberId))
    .where(
      and(
        eq(journalEntries.familyId, viewer.family.id),
        visible(viewer),
        opts.from ? gte(journalEntries.date, opts.from) : undefined,
        opts.to ? lte(journalEntries.date, opts.to) : undefined,
        opts.q ? or(ilike(journalEntries.title, `%${opts.q}%`), ilike(journalEntries.body, `%${opts.q}%`)) : undefined,
        opts.tag ? sql`${opts.tag} = any(${journalEntries.tags})` : undefined,
      ),
    )
    .orderBy(desc(journalEntries.date), desc(journalEntries.createdAt))
    .limit(opts.limit ?? 200);
  const ids = rows.map((r) => r.e.id);
  const photos = ids.length
    ? await db.select().from(journalEntryFiles).where(inArray(journalEntryFiles.entryId, ids)).orderBy(asc(journalEntryFiles.position))
    : [];
  const byEntry = Map.groupBy(photos, (p) => p.entryId);
  return rows.map((r) => ({ ...r, photos: (byEntry.get(r.e.id) ?? []).map((p) => ({ id: p.fileId, thumb: fileUrl(p.fileId, true)!, full: fileUrl(p.fileId)! })) }));
}

export async function getEntry(viewer: Viewer, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db
    .select({ e: journalEntries, author: familyMembers.displayName, authorColor: familyMembers.color })
    .from(journalEntries)
    .innerJoin(familyMembers, eq(familyMembers.id, journalEntries.authorMemberId))
    .where(and(eq(journalEntries.id, id), eq(journalEntries.familyId, viewer.family.id), visible(viewer)));
  if (!row) return null;
  const [photos, people] = await Promise.all([
    db.select().from(journalEntryFiles).where(eq(journalEntryFiles.entryId, id)).orderBy(asc(journalEntryFiles.position)),
    db
      .select({ id: familyMembers.id, displayName: familyMembers.displayName, color: familyMembers.color })
      .from(journalEntryMembers)
      .innerJoin(familyMembers, eq(familyMembers.id, journalEntryMembers.memberId))
      .where(eq(journalEntryMembers.entryId, id)),
  ]);
  return { ...row, photos: photos.map((p) => ({ id: p.fileId, thumb: fileUrl(p.fileId, true)!, full: fileUrl(p.fileId)! })), people };
}

export async function journalTags(viewer: Viewer) {
  const rows = await db
    .select({ tag: sql<string>`unnest(${journalEntries.tags})`, n: sql<number>`count(*)::int` })
    .from(journalEntries)
    .where(and(eq(journalEntries.familyId, viewer.family.id), visible(viewer)))
    .groupBy(sql`1`)
    .orderBy(desc(sql`2`))
    .limit(30);
  return rows;
}
