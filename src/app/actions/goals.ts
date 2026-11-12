"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { goalContributions, goalHorizon, goalKind, goalMilestones, goals } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { AuthorizationError, requireModule, type Viewer } from "@/lib/dal";
import { todayIn } from "@/lib/dates";
import { logActivity } from "@/lib/family";
import { recordContribution } from "@/lib/goals";
import { f, familyMemberIdOrNull, saveRecordAccess, visibilityFromForm } from "@/lib/records";

const KINDS = goalKind.enumValues;
const HORIZONS = goalHorizon.enumValues;

function revalidateGoals() {
  revalidatePath("/goals", "layout");
  revalidatePath("/fitness");
  revalidatePath("/budget", "layout");
  revalidatePath("/");
}

/** Members may edit their own goals and family goals; parents edit everything. */
async function editableGoal(viewer: Viewer, id: string) {
  const [g] = await db.select().from(goals).where(and(eq(goals.id, id), eq(goals.familyId, viewer.family.id)));
  if (!g) throw new AuthorizationError("Goal not found.");
  if (!viewer.isParent && g.ownerMemberId && g.ownerMemberId !== viewer.member.id) throw new AuthorizationError("That's someone else's goal.");
  return g;
}

export async function saveGoal(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("goals", "edit");
    const name = f.str(fd, "name");
    if (!name) return fail("Name your goal.", "name");
    const kind = f.str(fd, "kind") as (typeof KINDS)[number];
    const horizon = f.str(fd, "horizon") as (typeof HORIZONS)[number];
    const ownerRaw = f.str(fd, "ownerMemberId");
    let owner = ownerRaw === "family" ? null : await familyMemberIdOrNull(viewer.family.id, ownerRaw);
    if (!viewer.isParent && owner !== viewer.member.id && owner !== null) owner = viewer.member.id;
    const money = kind === "savings";
    const { visibility, memberIds } = visibilityFromForm(fd);
    const values = {
      familyId: viewer.family.id,
      name,
      description: f.str(fd, "description"),
      kind: KINDS.includes(kind) ? kind : "personal",
      horizon: HORIZONS.includes(horizon) ? horizon : "1y",
      ownerMemberId: owner,
      targetCents: money ? f.cents(fd, "target") : null,
      monthlyContributionCents: money ? f.cents(fd, "monthly") : null,
      targetValue: !money && f.num(fd, "target") !== null ? String(f.num(fd, "target")) : null,
      unit: money ? null : f.str(fd, "unit"),
      targetDate: f.date(fd, "targetDate"),
      notes: f.str(fd, "notes"),
      visibility,
    };
    const id = f.str(fd, "id");
    let goalId = id;
    await db.transaction(async (tx) => {
      if (id) {
        await editableGoal(viewer, id);
        await tx.update(goals).set(values).where(eq(goals.id, id));
      } else {
        const start = f.num(fd, "current");
        const [row] = await tx
          .insert(goals)
          .values({ ...values, currentCents: money ? Math.round((start ?? 0) * 100) : 0, currentValue: !money && start !== null ? String(start) : null })
          .returning({ id: goals.id });
        goalId = row!.id;
      }
      // Milestones (new goals): "milestone" lines like "Halfway: 5000"
      const lines = String(fd.get("milestones") ?? "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 20);
      if (!id && lines.length) {
        await tx.insert(goalMilestones).values(
          lines.map((line, position) => {
            const m = line.match(/^(.*?)[:\-–]\s*\$?([\d,.]+)\s*$/);
            const title = (m ? m[1]! : line).trim() || line;
            const amount = m ? Number(m[2]!.replace(/,/g, "")) : null;
            return { goalId: goalId!, title, position, targetCents: money && amount ? Math.round(amount * 100) : null, targetValue: !money && amount ? String(amount) : null };
          }),
        );
      }
      await saveRecordAccess(tx, viewer.family.id, "goal", goalId!, memberIds);
    });
    if (!id) await logActivity(db, viewer.family.id, viewer.member.id, "goal.created", `set a goal: ${name}`, { module: "goals", entityId: goalId! });
    revalidateGoals();
    if (!id) redirect(`/goals/${goalId}`);
    return ok("Saved.");
  });
}

export async function deleteGoal(fd: FormData) {
  const viewer = await requireModule("goals", "edit");
  const g = await editableGoal(viewer, String(fd.get("id")));
  await db.delete(goals).where(eq(goals.id, g.id));
  revalidateGoals();
  redirect("/goals");
}

export async function setGoalStatus(fd: FormData) {
  const viewer = await requireModule("goals", "edit");
  const g = await editableGoal(viewer, String(fd.get("id")));
  const status = String(fd.get("status"));
  if (!["active", "achieved", "paused", "abandoned"].includes(status)) return;
  await db.update(goals).set({ status: status as "active" }).where(eq(goals.id, g.id));
  if (status === "achieved") await logActivity(db, viewer.family.id, viewer.member.id, "goal.achieved", `achieved a goal: ${g.name} 🎉`, { module: "goals", entityId: g.id });
  revalidateGoals();
}

/**
 * Add progress to a goal. Updates the running total, checks off milestones,
 * celebrates achievement and notifies the family. Used by Budget too.
 */
export async function contributeToGoal(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("goals", "edit");
    const g = await editableGoal(viewer, String(fd.get("goalId")));
    const amount = f.num(fd, "amount");
    if (amount === null || amount === 0) return fail("Enter an amount.", "amount");
    await recordContribution(viewer, g.id, amount, f.date(fd, "date") ?? todayIn(viewer.family.timezone), f.str(fd, "notes"), null);
    revalidateGoals();
    return ok("Progress added.");
  });
}

export async function saveMilestone(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("goals", "edit");
    const g = await editableGoal(viewer, String(fd.get("goalId")));
    const title = f.str(fd, "title");
    if (!title) return fail("Name the milestone.", "title");
    const amount = f.num(fd, "target");
    const money = g.kind === "savings";
    await db.insert(goalMilestones).values({ goalId: g.id, title, dueOn: f.date(fd, "dueOn"), targetCents: money && amount ? Math.round(amount * 100) : null, targetValue: !money && amount !== null ? String(amount) : null, position: 999 });
    revalidateGoals();
    return ok();
  });
}

export async function toggleMilestone(fd: FormData) {
  const viewer = await requireModule("goals", "edit");
  const [m] = await db
    .select({ m: goalMilestones })
    .from(goalMilestones)
    .innerJoin(goals, eq(goals.id, goalMilestones.goalId))
    .where(and(eq(goalMilestones.id, String(fd.get("id"))), eq(goals.familyId, viewer.family.id)));
  if (!m) return;
  await editableGoal(viewer, m.m.goalId);
  await db.update(goalMilestones).set({ achievedAt: fd.get("done") === "true" ? new Date() : null }).where(eq(goalMilestones.id, m.m.id));
  revalidateGoals();
}

export async function deleteMilestone(fd: FormData) {
  const viewer = await requireModule("goals", "edit");
  const [m] = await db
    .select({ id: goalMilestones.id, goalId: goalMilestones.goalId })
    .from(goalMilestones)
    .innerJoin(goals, eq(goals.id, goalMilestones.goalId))
    .where(and(eq(goalMilestones.id, String(fd.get("id"))), eq(goals.familyId, viewer.family.id)));
  if (!m) return;
  await editableGoal(viewer, m.goalId);
  await db.delete(goalMilestones).where(eq(goalMilestones.id, m.id));
  revalidateGoals();
}

export async function deleteContribution(fd: FormData) {
  const viewer = await requireModule("goals", "edit");
  const [c] = await db
    .select({ c: goalContributions, kind: goals.kind })
    .from(goalContributions)
    .innerJoin(goals, eq(goals.id, goalContributions.goalId))
    .where(and(eq(goalContributions.id, String(fd.get("id"))), eq(goals.familyId, viewer.family.id)));
  if (!c) return;
  await editableGoal(viewer, c.c.goalId);
  await db.delete(goalContributions).where(eq(goalContributions.id, c.c.id));
  await db
    .update(goals)
    .set(c.kind === "savings" ? { currentCents: sql`${goals.currentCents} - ${c.c.amountCents ?? 0}` } : { currentValue: sql`coalesce(${goals.currentValue},0) - ${Number(c.c.value ?? 0)}` })
    .where(eq(goals.id, c.c.goalId));
  revalidateGoals();
}

