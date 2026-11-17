import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { goals, planItems, plans } from "@/db/schema";
import { visibleTo, type Viewer } from "./dal";

/** Plans the viewer may see: their own, the family's, or ones shared with them. */
export const planVisible = (viewer: Viewer) => visibleTo(viewer, { id: plans.id, visibility: plans.visibility, author: plans.createdByMemberId }, "plan");

export async function listPlans(viewer: Viewer) {
  if (!viewer.can("plans")) return [];
  return db
    .select({ p: plans, goalName: goals.name, goalTarget: goals.targetCents, goalCurrent: goals.currentCents, items: sql<number>`(select count(*)::int from ${planItems} where ${planItems.planId} = ${plans.id})` })
    .from(plans)
    .leftJoin(goals, eq(goals.id, plans.savingsGoalId))
    .where(and(eq(plans.familyId, viewer.family.id), planVisible(viewer)))
    .orderBy(asc(plans.startDate), asc(plans.title));
}

export async function getPlan(viewer: Viewer, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !viewer.can("plans")) return null;
  const [row] = await db
    .select({ p: plans, goal: goals })
    .from(plans)
    .leftJoin(goals, eq(goals.id, plans.savingsGoalId))
    .where(and(eq(plans.id, id), eq(plans.familyId, viewer.family.id), planVisible(viewer)));
  if (!row) return null;
  const items = await db.select().from(planItems).where(eq(planItems.planId, id)).orderBy(asc(planItems.date), asc(planItems.startTime), asc(planItems.createdAt));
  return { ...row, items };
}

/** Whole days from today until the start (negative once it has started). */
export function daysUntil(today: string, start: string) {
  return Math.round((Date.parse(`${start}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
}

export function countdownText(today: string, start: string | null, end: string | null) {
  if (!start) return "Dates not set";
  const d = daysUntil(today, start);
  if (d > 1) return `${d} days to go`;
  if (d === 1) return "Tomorrow!";
  if (d === 0) return "Today!";
  if (end && today <= end) return "Happening now";
  return "Done";
}
