import "server-only";
import { and, desc, eq, gte, inArray, isNull, lt, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { choreOccurrences, chores } from "@/db/schema";
import { planRotation, type RotationSlot } from "./rotation";

/**
 * Re-plan who has each rotating chore (chores, cleaning, tasks, farm) from a
 * date on, so turns stay even and everyone gets one chore a day before anyone
 * gets a second. Done days and days changed by hand are kept as they are.
 */
export async function rebalanceRotations(familyId: string, from: string) {
  const rotating = (
    await db
      .select({ id: chores.id, rotation: chores.rotationMemberIds })
      .from(chores)
      .where(and(eq(chores.familyId, familyId), isNull(chores.archivedAt), isNull(chores.deletedAt), sql`cardinality(${chores.rotationMemberIds}) > 1`))
  ).filter((c) => c.rotation.length > 1);
  if (!rotating.length) return;
  const ids = rotating.map((c) => c.id);

  const [occ, others, before] = await Promise.all([
    db
      .select({ id: choreOccurrences.id, choreId: choreOccurrences.choreId, date: choreOccurrences.dueDate, assigneeId: choreOccurrences.assigneeId, status: choreOccurrences.status, manual: choreOccurrences.assignedManually })
      .from(choreOccurrences)
      .where(and(eq(choreOccurrences.familyId, familyId), inArray(choreOccurrences.choreId, ids), gte(choreOccurrences.dueDate, from))),
    // Everything else already on those days (one-off chores, tasks with an assignee…).
    db
      .select({ date: choreOccurrences.dueDate, assigneeId: choreOccurrences.assigneeId, n: sql<number>`count(*)::int` })
      .from(choreOccurrences)
      .where(and(eq(choreOccurrences.familyId, familyId), notInArray(choreOccurrences.choreId, ids), gte(choreOccurrences.dueDate, from), sql`${choreOccurrences.status} <> 'skipped'`))
      .groupBy(choreOccurrences.dueDate, choreOccurrences.assigneeId),
    // Who had each chore last before the start date.
    db
      .selectDistinctOn([choreOccurrences.choreId], { choreId: choreOccurrences.choreId, assigneeId: choreOccurrences.assigneeId })
      .from(choreOccurrences)
      .where(and(eq(choreOccurrences.familyId, familyId), inArray(choreOccurrences.choreId, ids), lt(choreOccurrences.dueDate, from)))
      .orderBy(choreOccurrences.choreId, desc(choreOccurrences.dueDate)),
  ]);

  const otherLoad = new Map<string, Map<string, number>>();
  for (const o of others) {
    if (!o.assigneeId) continue;
    const m = otherLoad.get(o.date) ?? otherLoad.set(o.date, new Map()).get(o.date)!;
    m.set(o.assigneeId, (m.get(o.assigneeId) ?? 0) + o.n);
  }
  const slots: RotationSlot[] = occ
    .filter((o) => o.status !== "skipped")
    .map((o) => ({ id: o.id, choreId: o.choreId, date: o.date, assigneeId: o.assigneeId, fixed: o.manual || o.status !== "pending" }));
  const plan = planRotation({ chores: rotating, slots, lastBefore: new Map(before.map((b) => [b.choreId, b.assigneeId])), otherLoad });

  const current = new Map(occ.map((o) => [o.id, o.assigneeId]));
  for (const [id, who] of plan) {
    if (current.get(id) !== who) await db.update(choreOccurrences).set({ assigneeId: who }).where(eq(choreOccurrences.id, id));
  }
}
