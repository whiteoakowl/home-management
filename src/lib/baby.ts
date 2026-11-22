import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { babies, babyLogs, babyReminders, babySchedule, babySupplies, familyMembers, memberPermissions } from "@/db/schema";
import { MODULE_META } from "./modules";
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
  return db.select().from(babyLogs).where(and(eq(babyLogs.babyId, babyId), isNull(babyLogs.endedAt), inArray(babyLogs.kind, ["nursing", "sleep", "tummy", "pump"]))).orderBy(asc(babyLogs.startedAt));
}

export function scheduleFor(babyId: string) {
  return db.select().from(babySchedule).where(eq(babySchedule.babyId, babyId)).orderBy(asc(babySchedule.time));
}

export const familyToday = (viewer: Viewer) => todayIn(viewer.family.timezone);

// ─── Caregivers, supplies, reminders, memories ──────────────────────────────

/** Household members who can open the Baby tracker, with their access level. */
export async function caregivers(viewer: Viewer) {
  const rows = await db
    .select({ id: familyMembers.id, name: familyMembers.displayName, role: familyMembers.role, color: familyMembers.color, level: memberPermissions.level })
    .from(familyMembers)
    .leftJoin(memberPermissions, and(eq(memberPermissions.memberId, familyMembers.id), eq(memberPermissions.module, "baby")))
    .where(and(eq(familyMembers.familyId, viewer.family.id), eq(familyMembers.isActive, true)));
  const def = MODULE_META.baby.defaultMemberAccess;
  return rows
    .map((r) => ({ ...r, level: r.role === "parent" ? ("edit" as const) : (r.level ?? def) }))
    .filter((r) => r.level !== "none")
    .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "parent" ? -1 : 1));
}

/** Supplies for this baby (and the shared ones). Breast milk that's been used is left out. */
export function suppliesFor(viewer: Viewer, babyId: string) {
  return db
    .select()
    .from(babySupplies)
    .where(and(eq(babySupplies.familyId, viewer.family.id), isNull(babySupplies.usedAt), or(eq(babySupplies.babyId, babyId), isNull(babySupplies.babyId))))
    .orderBy(asc(babySupplies.kind), asc(babySupplies.expiresOn), asc(babySupplies.name));
}

export function remindersFor(babyId: string) {
  return db.select().from(babyReminders).where(eq(babyReminders.babyId, babyId)).orderBy(desc(babyReminders.enabled), asc(babyReminders.createdAt));
}

/** Appointments, check-ups and vaccine visits still to come. */
export function upcomingAppointments(babyId: string, now = new Date()) {
  return db
    .select()
    .from(babyLogs)
    .where(and(eq(babyLogs.babyId, babyId), inArray(babyLogs.kind, ["appointment", "doctor", "vaccine"]), gte(babyLogs.startedAt, now)))
    .orderBy(asc(babyLogs.startedAt))
    .limit(10);
}

/** Every log with a photo (for Memories and growth photos). */
export function photoLogs(babyId: string, limit = 200) {
  return db.select().from(babyLogs).where(and(eq(babyLogs.babyId, babyId), isNotNull(babyLogs.imageFileId))).orderBy(desc(babyLogs.startedAt)).limit(limit);
}

/** All logs between two instants, oldest first (reports and exports). */
export function logsInRange(babyId: string, from: Date, to: Date) {
  return db
    .select()
    .from(babyLogs)
    .where(and(eq(babyLogs.babyId, babyId), gte(babyLogs.startedAt, from), lt(babyLogs.startedAt, to)))
    .orderBy(asc(babyLogs.startedAt));
}
