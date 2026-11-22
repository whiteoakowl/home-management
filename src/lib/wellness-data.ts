import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { files, journalEntries, journalEntryFiles, wellnessCheckIns, wellnessGoalMarks, wellnessGoals, wellnessSleep } from "@/db/schema";
import { visibleTo, type Viewer } from "./dal";
import { addDays } from "./dates";
import { fileUrl } from "./files";
import { thisWeekCount } from "./wellness";

/**
 * What the viewer may see of someone's Mental Wellness:
 *  - yourself: everything.
 *  - managed (no login) / parent oversight: check-ins and goals; journal entries only if shared.
 *  - shared with you: only check-ins and goals they marked "share", and entries they shared.
 */
export type WellnessAccess = "self" | "managed" | "oversight" | "shared";

export async function checkInsFor(memberId: string, access: WellnessAccess, from: string, to: string) {
  return db
    .select()
    .from(wellnessCheckIns)
    .where(and(eq(wellnessCheckIns.memberId, memberId), gte(wellnessCheckIns.date, from), lte(wellnessCheckIns.date, to), access === "shared" ? eq(wellnessCheckIns.shared, true) : undefined))
    .orderBy(desc(wellnessCheckIns.date));
}

export async function wellnessEntriesFor(viewer: Viewer, memberId: string, opts: { from?: string; to?: string; limit?: number } = {}) {
  const rows = await db
    .select()
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.familyId, viewer.family.id),
        eq(journalEntries.book, "wellness"),
        eq(journalEntries.authorMemberId, memberId),
        visibleTo(viewer, { id: journalEntries.id, visibility: journalEntries.visibility, author: journalEntries.authorMemberId }, "journal_entry"),
        opts.from ? gte(journalEntries.date, opts.from) : undefined,
        opts.to ? lte(journalEntries.date, opts.to) : undefined,
      ),
    )
    .orderBy(desc(journalEntries.date), desc(journalEntries.createdAt))
    .limit(opts.limit ?? 200);
  const attached = rows.length
    ? await db
        .select({ entryId: journalEntryFiles.entryId, fileId: journalEntryFiles.fileId, mime: files.mimeType })
        .from(journalEntryFiles)
        .innerJoin(files, eq(files.id, journalEntryFiles.fileId))
        .where(inArray(journalEntryFiles.entryId, rows.map((r) => r.id)))
        .orderBy(asc(journalEntryFiles.position))
    : [];
  const by = Map.groupBy(attached, (p) => p.entryId);
  return rows.map((e) => {
    const list = by.get(e.id) ?? [];
    return {
      ...e,
      photos: list.filter((p) => !p.mime.startsWith("audio/")).map((p) => ({ id: p.fileId, thumb: fileUrl(p.fileId, true)!, full: fileUrl(p.fileId)! })),
      voice: list.filter((p) => p.mime.startsWith("audio/")).map((p) => ({ id: p.fileId, url: fileUrl(p.fileId)!, mime: p.mime })),
    };
  });
}
export type WellnessEntry = Awaited<ReturnType<typeof wellnessEntriesFor>>[number];

/** Active goals with this week's progress (counted from check-ins, journal entries or ticks). */
export async function goalsWithProgress(viewer: Viewer, memberId: string, access: WellnessAccess, today: string) {
  const goals = await db
    .select()
    .from(wellnessGoals)
    .where(and(eq(wellnessGoals.memberId, memberId), isNull(wellnessGoals.archivedAt), access === "shared" ? eq(wellnessGoals.shared, true) : undefined))
    .orderBy(asc(wellnessGoals.createdAt));
  if (!goals.length) return [];
  const from = addDays(today, -62);
  const [checkIns, entries, marks] = await Promise.all([
    db.select({ date: wellnessCheckIns.date, selfCare: wellnessCheckIns.selfCare }).from(wellnessCheckIns).where(and(eq(wellnessCheckIns.memberId, memberId), gte(wellnessCheckIns.date, from))),
    db.select({ date: journalEntries.date, details: journalEntries.details }).from(journalEntries).where(and(eq(journalEntries.authorMemberId, memberId), eq(journalEntries.book, "wellness"), gte(journalEntries.date, from))),
    db.select().from(wellnessGoalMarks).where(and(inArray(wellnessGoalMarks.goalId, goals.map((g) => g.id)), gte(wellnessGoalMarks.date, from))),
  ]);
  return goals.map((g) => {
    const dates =
      g.kind === "journal"
        ? entries.map((e) => e.date)
        : g.kind === "gratitude"
          ? entries.filter((e) => e.details?.gratitude?.length).map((e) => e.date)
          : g.kind === "check_in"
            ? checkIns.map((c) => c.date)
            : g.kind === "self_care"
              ? [...checkIns.filter((c) => g.selfCareKey && c.selfCare.includes(g.selfCareKey)).map((c) => c.date), ...entries.filter((e) => g.selfCareKey && e.details?.selfCare?.includes(g.selfCareKey)).map((e) => e.date)]
              : marks.filter((m) => m.goalId === g.id).map((m) => m.date);
    return { ...g, dates: [...new Set(dates)], done: thisWeekCount(dates, today), doneToday: dates.includes(today) };
  });
}

/** Sleep journal nights for a member (self or a managed member only; never shared). */
export async function sleepNightsFor(memberId: string, from: string, to: string) {
  return db
    .select()
    .from(wellnessSleep)
    .where(and(eq(wellnessSleep.memberId, memberId), gte(wellnessSleep.date, from), lte(wellnessSleep.date, to)))
    .orderBy(desc(wellnessSleep.date));
}

/**
 * Photos and voice notes in a journal entry are only served to people who may
 * read that entry (private entries: the author alone).
 */
export async function canReadJournalFile(viewer: Viewer, fileId: string) {
  const links = await db
    .select({ id: journalEntries.id })
    .from(journalEntryFiles)
    .innerJoin(journalEntries, eq(journalEntries.id, journalEntryFiles.entryId))
    .where(and(eq(journalEntryFiles.fileId, fileId), eq(journalEntries.familyId, viewer.family.id)));
  if (!links.length) return true;
  const ok = await db
    .select({ id: journalEntries.id })
    .from(journalEntries)
    .where(and(inArray(journalEntries.id, links.map((l) => l.id)), visibleTo(viewer, { id: journalEntries.id, visibility: journalEntries.visibility, author: journalEntries.authorMemberId }, "journal_entry")))
    .limit(1);
  return ok.length > 0;
}
