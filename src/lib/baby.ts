import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { babies, babyLogs, babySchedule } from "@/db/schema";
import type { BabyLogKind } from "./baby-kinds";
import { canChangeItem, type Viewer } from "./dal";
import { addDays, todayIn, zonedToUtc } from "./dates";

export async function listBabies(viewer: Viewer) {
  if (!viewer.can("baby")) return [];
  return db
    .select()
    .from(babies)
    .where(and(eq(babies.familyId, viewer.family.id), isNull(babies.archivedAt)))
    .orderBy(asc(babies.birthDate), asc(babies.name));
}

export async function getBaby(viewer: Viewer, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !viewer.can("baby")) return null;
  const [b] = await db.select().from(babies).where(and(eq(babies.id, id), eq(babies.familyId, viewer.family.id)));
  return b ?? null;
}

/** Parents, Add & edit, or whoever added the baby may change the profile. */
export const canManageBaby = (viewer: Viewer, b: { createdByMemberId: string | null }) => viewer.can("baby", "edit") || canChangeItem(viewer, b.createdByMemberId);

/** Use: change what you logged. Add & edit and parents: change anything. */
export const canChangeLog = (viewer: Viewer, l: { createdByMemberId: string | null }) => viewer.can("baby", "edit") || (viewer.can("baby", "use") && canChangeItem(viewer, l.createdByMemberId));

/** Start and end (UTC) of a family-local day. */
export function dayBounds(day: string, tz: string) {
  return { start: zonedToUtc(day, "00:00", tz), end: zonedToUtc(addDays(day, 1), "00:00", tz) };
}

/** Logs for a baby between two instants (plus sleep that overlaps the start), newest first. */
export function logsBetween(babyId: string, from: Date, to: Date, kinds?: BabyLogKind[]) {
  return db
    .select()
    .from(babyLogs)
    .where(
      and(
        eq(babyLogs.babyId, babyId),
        kinds?.length ? inArray(babyLogs.kind, kinds) : undefined,
        lt(babyLogs.startedAt, to),
        or(gte(babyLogs.startedAt, from), and(eq(babyLogs.kind, "sleep"), or(isNull(babyLogs.endedAt), gte(babyLogs.endedAt, from)))),
      ),
    )
    .orderBy(desc(babyLogs.startedAt));
}

/** Everything of some kinds, newest first. */
export function logsOfKinds(babyId: string, kinds: BabyLogKind[], limit = 200) {
  return db.select().from(babyLogs).where(and(eq(babyLogs.babyId, babyId), inArray(babyLogs.kind, kinds))).orderBy(desc(babyLogs.startedAt)).limit(limit);
}

/** The most recent log of each kind. */
export async function lastOfEach(babyId: string, kinds: BabyLogKind[]) {
  const rows = await Promise.all(kinds.map((k) => db.select().from(babyLogs).where(and(eq(babyLogs.babyId, babyId), eq(babyLogs.kind, k))).orderBy(desc(babyLogs.startedAt)).limit(1)));
  return new Map(rows.flat().map((r) => [r.kind, r]));
}

/** Timers still running (nursing, sleep, tummy time). */
export function runningTimers(babyId: string) {
  return db.select().from(babyLogs).where(and(eq(babyLogs.babyId, babyId), isNull(babyLogs.endedAt), inArray(babyLogs.kind, ["nursing", "sleep", "tummy"]))).orderBy(asc(babyLogs.startedAt));
}

export function scheduleFor(babyId: string) {
  return db.select().from(babySchedule).where(eq(babySchedule.babyId, babyId)).orderBy(asc(babySchedule.time));
}

export const familyToday = (viewer: Viewer) => todayIn(viewer.family.timezone);
