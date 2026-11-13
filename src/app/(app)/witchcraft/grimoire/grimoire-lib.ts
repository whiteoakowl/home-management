import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { journalEntries } from "@/db/schema";
import { visibleTo, type Viewer } from "@/lib/dal";

/** Grimoire entries the viewer may read (private entries stay private, even from parents). */
export function grimoireEntries(viewer: Viewer) {
  return db
    .select()
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.familyId, viewer.family.id),
        eq(journalEntries.book, "grimoire"),
        visibleTo(viewer, { id: journalEntries.id, visibility: journalEntries.visibility, author: journalEntries.authorMemberId }, "journal_entry", { parentsSeePrivate: false }),
      ),
    )
    .orderBy(desc(journalEntries.isFavorite), desc(journalEntries.date), desc(journalEntries.createdAt));
}
