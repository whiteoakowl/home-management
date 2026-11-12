import "server-only";
import { and, asc, desc, eq, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { familyMembers, goalContributions, goalMilestones, goals } from "@/db/schema";
import { notify } from "./automation";
import { visibleTo, type Viewer } from "./dal";
import { addDays, todayIn } from "./dates";
import { logActivity } from "./family";

export const HORIZONS = [
  { key: "6m", label: "6 months", months: 6 },
  { key: "1y", label: "1 year", months: 12 },
  { key: "5y", label: "5 years", months: 60 },
  { key: "10y", label: "10 years", months: 120 },
  { key: "20y", label: "20 years", months: 240 },
  { key: "custom", label: "Other", months: null },
] as const;

export async function listGoals(viewer: Viewer, opts: { kind?: string; ownerId?: string; includeDone?: boolean } = {}) {
  return db
    .select({ g: goals, owner: familyMembers.displayName, ownerColor: familyMembers.color })
    .from(goals)
    .leftJoin(familyMembers, eq(familyMembers.id, goals.ownerMemberId))
    .where(
      and(
        eq(goals.familyId, viewer.family.id),
        visibleTo(viewer, { id: goals.id, visibility: goals.visibility, author: goals.ownerMemberId }, "goal"),
        opts.kind ? eq(goals.kind, opts.kind as "savings") : undefined,
        opts.ownerId ? eq(goals.ownerMemberId, opts.ownerId) : undefined,
      ),
    )
    .orderBy(asc(goals.status), asc(goals.targetDate), asc(goals.createdAt));
}

export async function getGoal(viewer: Viewer, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = (await listGoals(viewer)).filter((r) => r.g.id === id);
  if (!row) return null;
  const [milestones, contributions] = await Promise.all([
    db.select().from(goalMilestones).where(eq(goalMilestones.goalId, id)).orderBy(asc(goalMilestones.position), asc(goalMilestones.targetCents), asc(goalMilestones.targetValue)),
    db
      .select({ c: goalContributions, who: familyMembers.displayName })
      .from(goalContributions)
      .leftJoin(familyMembers, eq(familyMembers.id, goalContributions.memberId))
      .where(eq(goalContributions.goalId, id))
      .orderBy(desc(goalContributions.date), desc(goalContributions.createdAt)),
  ]);
  return { ...row, milestones, contributions };
}

/** Progress numbers for a goal row (money in dollars). */
export function progressOf(g: typeof goals.$inferSelect) {
  const money = g.kind === "savings";
  const current = money ? g.currentCents / 100 : Number(g.currentValue ?? 0);
  const target = money ? (g.targetCents ?? 0) / 100 : Number(g.targetValue ?? 0);
  const monthly = money ? (g.monthlyContributionCents ?? 0) / 100 : 0;
  const remaining = Math.max(0, target - current);
  const monthsLeft = monthly > 0 && remaining > 0 ? Math.ceil(remaining / monthly) : null;
  return { money, current, target, pct: target > 0 ? Math.min(100, (current / target) * 100) : 0, remaining, monthly, monthsLeft };
}

export function projectedDate(today: string, monthsLeft: number | null) {
  return monthsLeft === null ? null : addDays(today, Math.round(monthsLeft * 30.44));
}

/** Shared by goal contributions and budget savings transfers (server-only helper). */
export async function recordContribution(viewer: Viewer, goalId: string, amount: number, date: string, notes: string | null, transactionId: string | null) {
  const [g] = await db.select().from(goals).where(eq(goals.id, goalId));
  if (!g) return;
  const money = g.kind === "savings";
  await db.insert(goalContributions).values({
    goalId,
    date,
    amountCents: money ? Math.round(amount * 100) : null,
    value: money ? null : String(amount),
    notes,
    transactionId,
    memberId: viewer.member.id,
  });
  const [updated] = await db
    .update(goals)
    .set(money ? { currentCents: sql`${goals.currentCents} + ${Math.round(amount * 100)}` } : { currentValue: sql`coalesce(${goals.currentValue},0) + ${amount}` })
    .where(eq(goals.id, goalId))
    .returning();
  const current = money ? updated!.currentCents : Number(updated!.currentValue ?? 0);
  // Milestones reached by this contribution.
  const reached = await db
    .update(goalMilestones)
    .set({ achievedAt: new Date() })
    .where(
      and(
        eq(goalMilestones.goalId, goalId),
        isNull(goalMilestones.achievedAt),
        money ? lte(goalMilestones.targetCents, current) : lte(goalMilestones.targetValue, String(current)),
      ),
    )
    .returning();
  const today = todayIn(viewer.family.timezone);
  for (const m of reached) {
    await notify(viewer.family.id, [g.ownerMemberId ?? viewer.member.id], { kind: "goal_milestone", title: `Milestone reached: ${m.title}`, body: g.name, href: `/goals/${goalId}` }, today);
  }
  const target = money ? updated!.targetCents : Number(updated!.targetValue ?? 0);
  if (target && current >= target && updated!.status === "active") {
    await db.update(goals).set({ status: "achieved" }).where(eq(goals.id, goalId));
    await logActivity(db, viewer.family.id, viewer.member.id, "goal.achieved", `reached the goal "${g.name}" 🎉`, { module: "goals", entityId: goalId });
  }
}

