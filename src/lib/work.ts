import "server-only";
import { and, eq, gte, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { familyMembers, recordAccess, workPatterns, workShifts, workTimeOff } from "@/db/schema";
import type { Viewer } from "./dal";
import { shiftsBetween } from "./work-schedule";

/**
 * Whose work schedules the viewer may see. Each person chooses: the whole
 * family, selected people, "Parents & me", or "Only me" (nobody else, parents
 * included). You always see your own.
 */
export async function visibleWorkers(viewer: Viewer): Promise<Set<string>> {
  const [members, shared] = await Promise.all([
    db.select({ id: familyMembers.id, vis: familyMembers.workVisibility }).from(familyMembers).where(eq(familyMembers.familyId, viewer.family.id)),
    db
      .select({ id: recordAccess.entityId })
      .from(recordAccess)
      .where(and(eq(recordAccess.familyId, viewer.family.id), eq(recordAccess.entityType, "work_schedule"), eq(recordAccess.memberId, viewer.member.id))),
  ]);
  const sharedWithMe = new Set(shared.map((s) => s.id));
  return new Set(
    members
      .filter((m) => m.id === viewer.member.id || m.vis === "family" || (m.vis === "parents" && viewer.isParent) || (m.vis === "selected" && sharedWithMe.has(m.id)))
      .map((m) => m.id),
  );
}

/** The viewer's own choice, for the "Who sees my schedule" form. */
export async function myWorkSharing(viewer: Viewer) {
  const rows = await db
    .select({ memberId: recordAccess.memberId })
    .from(recordAccess)
    .where(and(eq(recordAccess.familyId, viewer.family.id), eq(recordAccess.entityType, "work_schedule"), eq(recordAccess.entityId, viewer.member.id)));
  return { visibility: viewer.member.workVisibility, memberIds: rows.map((r) => r.memberId) };
}

/** Shifts, regular schedules and days off between two dates, for the people whose schedules the viewer may see. */
export async function workBetween(viewer: Viewer, from: string, to: string, memberId?: string | null) {
  const fid = viewer.family.id;
  const [see, oneOffs, patterns, off] = await Promise.all([
    visibleWorkers(viewer),
    db.select().from(workShifts).where(and(eq(workShifts.familyId, fid), gte(workShifts.date, from), lte(workShifts.date, to), memberId ? eq(workShifts.memberId, memberId) : undefined)),
    db.select().from(workPatterns).where(and(eq(workPatterns.familyId, fid), lte(workPatterns.startsOn, to), or(isNull(workPatterns.endsOn), gte(workPatterns.endsOn, from)), memberId ? eq(workPatterns.memberId, memberId) : undefined)),
    db.select().from(workTimeOff).where(and(eq(workTimeOff.familyId, fid), lte(workTimeOff.startDate, to), gte(workTimeOff.endDate, from), memberId ? eq(workTimeOff.memberId, memberId) : undefined)),
  ]);
  const mine = <T extends { memberId: string }>(xs: T[]) => xs.filter((x) => see.has(x.memberId));
  const p = mine(patterns);
  const o = mine(off);
  return { patterns: p, timeOff: o, shifts: shiftsBetween(p, mine(oneOffs), o, from, to), see };
}
