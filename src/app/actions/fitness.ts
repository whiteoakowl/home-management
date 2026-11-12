"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  bodyMetrics,
  fitnessPlans,
  foodJournalEntries,
  mealPlanEntries,
  mealSlot,
  personalRecords,
  recipes,
  workoutExercises,
  workoutLogSets,
  workoutLogs,
  workouts,
} from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { AuthorizationError, requireModule, type Viewer } from "@/lib/dal";
import { todayIn } from "@/lib/dates";
import { logActivity } from "@/lib/family";
import { deleteFamilyFile, saveUpload } from "@/lib/files";
import { f, familyMemberIdOrNull, upsertRule } from "@/lib/records";

function revalidateFitness() {
  revalidatePath("/fitness", "layout");
  revalidatePath("/calendar");
  revalidatePath("/");
}

/** You can manage your own fitness data; parents can manage anyone's. */
async function subject(viewer: Viewer, memberId: string | null) {
  const id = (await familyMemberIdOrNull(viewer.family.id, memberId)) ?? viewer.member.id;
  if (id !== viewer.member.id && !viewer.isParent) throw new AuthorizationError("You can only change your own fitness data.");
  return id;
}

async function ownPlan(viewer: Viewer, planId: string) {
  const [p] = await db.select().from(fitnessPlans).where(and(eq(fitnessPlans.id, planId), eq(fitnessPlans.familyId, viewer.family.id)));
  if (!p) throw new AuthorizationError("Plan not found.");
  await subject(viewer, p.memberId);
  return p;
}

async function ownWorkout(viewer: Viewer, workoutId: string) {
  const [w] = await db.select().from(workouts).where(eq(workouts.id, workoutId));
  if (!w) throw new AuthorizationError("Workout not found.");
  const plan = await ownPlan(viewer, w.planId);
  return { w, plan };
}

// ─── Plans, workouts, exercises ──────────────────────────────────────────────

export async function savePlan(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("fitness", "edit");
    const name = f.str(fd, "name");
    if (!name) return fail("Name the plan.", "name");
    const id = f.str(fd, "id");
    const values = { name, description: f.str(fd, "description"), startsOn: f.date(fd, "startsOn"), endsOn: f.date(fd, "endsOn") };
    if (id) {
      await ownPlan(viewer, id);
      await db.update(fitnessPlans).set(values).where(eq(fitnessPlans.id, id));
      revalidateFitness();
      return ok("Saved.");
    }
    const memberId = await subject(viewer, f.str(fd, "memberId"));
    const [row] = await db.insert(fitnessPlans).values({ ...values, familyId: viewer.family.id, memberId }).returning({ id: fitnessPlans.id });
    revalidateFitness();
    redirect(`/fitness/plans/${row!.id}`);
  });
}

export async function deletePlan(fd: FormData) {
  const viewer = await requireModule("fitness", "edit");
  const p = await ownPlan(viewer, String(fd.get("id")));
  await db.delete(fitnessPlans).where(eq(fitnessPlans.id, p.id));
  revalidateFitness();
  redirect("/fitness");
}

export async function saveWorkout(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("fitness", "edit");
    const name = f.str(fd, "name");
    if (!name) return fail("Name the workout (e.g. Strength, Cardio).", "name");
    const days = f
      .list(fd, "weekday")
      .map(Number)
      .filter((d) => d >= 0 && d <= 6);
    const id = f.str(fd, "id");
    const plan = id ? (await ownWorkout(viewer, id)).plan : await ownPlan(viewer, String(fd.get("planId")));
    const existing = id ? (await ownWorkout(viewer, id)).w : null;
    const rule = days.length ? { freq: "weekly" as const, interval: 1, byWeekday: days, startsOn: plan.startsOn ?? todayIn(viewer.family.timezone), until: plan.endsOn } : null;
    const ruleId = await upsertRule(db, viewer.family.id, rule, existing?.recurrenceRuleId);
    const values = { name, focus: f.str(fd, "focus"), notes: f.str(fd, "notes"), recurrenceRuleId: ruleId };
    if (existing) await db.update(workouts).set(values).where(eq(workouts.id, existing.id));
    else await db.insert(workouts).values({ ...values, planId: plan.id, position: 999 });
    revalidateFitness();
    return ok();
  });
}

export async function deleteWorkout(fd: FormData) {
  const viewer = await requireModule("fitness", "edit");
  const { w } = await ownWorkout(viewer, String(fd.get("id")));
  await db.delete(workouts).where(eq(workouts.id, w.id));
  revalidateFitness();
}

export async function saveExercise(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("fitness", "edit");
    const name = f.str(fd, "name");
    if (!name) return fail("Name the exercise.", "name");
    const { w } = await ownWorkout(viewer, String(fd.get("workoutId")));
    const video = f.str(fd, "videoUrl");
    if (video && !/^https?:\/\//i.test(video)) return fail("Video links must start with http:// or https://", "videoUrl");
    const minutes = f.num(fd, "minutes");
    await db.insert(workoutExercises).values({
      workoutId: w.id,
      name,
      sets: f.int(fd, "sets"),
      reps: f.int(fd, "reps"),
      durationSeconds: minutes !== null ? Math.round(minutes * 60) : null,
      distance: f.num(fd, "distance") !== null ? String(f.num(fd, "distance")) : null,
      distanceUnit: f.str(fd, "distanceUnit"),
      videoUrl: video,
      notes: f.str(fd, "notes"),
      position: 999,
    });
    revalidateFitness();
    return ok();
  });
}

export async function deleteExercise(fd: FormData) {
  const viewer = await requireModule("fitness", "edit");
  const [ex] = await db.select().from(workoutExercises).where(eq(workoutExercises.id, String(fd.get("id"))));
  if (!ex) return;
  await ownWorkout(viewer, ex.workoutId);
  await db.delete(workoutExercises).where(eq(workoutExercises.id, ex.id));
  revalidateFitness();
}

// ─── Logging ─────────────────────────────────────────────────────────────────

/** "Squat 3x10 @ 135 lb" → { exercise, sets, reps, weight, unit } */
function parseSetLine(line: string) {
  const m = line.match(/^(.+?)\s+(\d+)\s*[x×]\s*(\d+)(?:\s*@\s*([\d.]+)\s*(lb|lbs|kg)?)?\s*$/i);
  if (!m) return null;
  return { exercise: m[1]!.trim(), sets: Number(m[2]), reps: Number(m[3]), weight: m[4] ? Number(m[4]) : null, unit: m[5] ? (m[5].toLowerCase().startsWith("kg") ? "kg" : "lb") : null };
}

export async function logWorkout(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("fitness", "edit");
    const memberId = await subject(viewer, f.str(fd, "memberId"));
    const title = f.str(fd, "title");
    if (!title) return fail("What did you do?", "title");
    const workoutId = f.str(fd, "workoutId");
    if (workoutId) await ownWorkout(viewer, workoutId);
    const effort = f.int(fd, "effort");
    const date = f.date(fd, "date") ?? todayIn(viewer.family.timezone);
    const [log] = await db
      .insert(workoutLogs)
      .values({
        familyId: viewer.family.id,
        memberId,
        workoutId,
        date,
        title,
        durationMinutes: f.int(fd, "durationMinutes"),
        distance: f.num(fd, "distance") !== null ? String(f.num(fd, "distance")) : null,
        distanceUnit: f.str(fd, "distanceUnit"),
        effort: effort ? Math.max(1, Math.min(5, effort)) : null,
        notes: f.str(fd, "notes"),
      })
      .returning({ id: workoutLogs.id });

    const sets = String(fd.get("sets") ?? "")
      .split("\n")
      .map((l) => parseSetLine(l.trim()))
      .filter((x): x is NonNullable<typeof x> => !!x)
      .slice(0, 40);
    const newPRs: string[] = [];
    for (const s of sets) {
      await db.insert(workoutLogSets).values(
        Array.from({ length: Math.min(s.sets, 20) }, (_, i) => ({ logId: log!.id, exercise: s.exercise, setNumber: i + 1, reps: s.reps, weight: s.weight !== null ? String(s.weight) : null, weightUnit: s.unit ?? (s.weight !== null ? "lb" : null) })),
      );
      if (s.weight !== null) {
        const [best] = await db
          .select()
          .from(personalRecords)
          .where(and(eq(personalRecords.memberId, memberId), sql`lower(${personalRecords.exercise}) = lower(${s.exercise})`))
          .orderBy(desc(personalRecords.value))
          .limit(1);
        if (!best || Number(best.value) < s.weight) {
          await db.insert(personalRecords).values({ memberId, exercise: s.exercise, value: String(s.weight), unit: s.unit ?? "lb", achievedOn: date, workoutLogId: log!.id });
          newPRs.push(`${s.exercise} ${s.weight} ${s.unit ?? "lb"}`);
        }
      }
    }
    await logActivity(db, viewer.family.id, memberId, "workout.logged", `finished a workout: ${title}${newPRs.length ? ` (new PR: ${newPRs.join(", ")} 💪)` : ""}`, { module: "fitness" });
    revalidateFitness();
    return ok(newPRs.length ? `Logged. New personal record: ${newPRs.join(", ")}!` : "Workout logged.");
  });
}

export async function deleteWorkoutLog(fd: FormData) {
  const viewer = await requireModule("fitness", "edit");
  const [l] = await db.select().from(workoutLogs).where(and(eq(workoutLogs.id, String(fd.get("id"))), eq(workoutLogs.familyId, viewer.family.id)));
  if (!l) return;
  await subject(viewer, l.memberId);
  await db.delete(workoutLogs).where(eq(workoutLogs.id, l.id));
  revalidateFitness();
}

export async function logMetric(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("fitness", "edit");
    const memberId = await subject(viewer, f.str(fd, "memberId"));
    const value = f.num(fd, "value");
    if (value === null || value <= 0) return fail("Enter a value.", "value");
    const metric = f.str(fd, "metric") ?? "weight";
    await db.insert(bodyMetrics).values({ memberId, date: f.date(fd, "date") ?? todayIn(viewer.family.timezone), metric, value: String(value), unit: f.str(fd, "unit") ?? (metric === "weight" ? "lb" : "") });
    revalidateFitness();
    return ok("Recorded.");
  });
}

export async function deleteMetric(fd: FormData) {
  const viewer = await requireModule("fitness", "edit");
  const [m] = await db.select().from(bodyMetrics).where(eq(bodyMetrics.id, String(fd.get("id"))));
  if (!m) return;
  await subject(viewer, m.memberId);
  await db.delete(bodyMetrics).where(eq(bodyMetrics.id, m.id));
  revalidateFitness();
}

// ─── Food journal ────────────────────────────────────────────────────────────

const SLOTS = mealSlot.enumValues;

export async function saveFoodEntry(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("fitness", "edit");
    const memberId = await subject(viewer, f.str(fd, "memberId"));
    const food = f.str(fd, "food");
    if (!food) return fail("What did you eat?", "food");
    const slot = f.str(fd, "slot") as (typeof SLOTS)[number];
    const image = await saveUpload(viewer, fd.get("image"));
    await db.insert(foodJournalEntries).values({
      familyId: viewer.family.id,
      memberId,
      date: f.date(fd, "date") ?? todayIn(viewer.family.timezone),
      slot: SLOTS.includes(slot) ? slot : "snack",
      food,
      notes: f.str(fd, "notes"),
      imageFileId: image,
    });
    revalidateFitness();
    return ok();
  });
}

/** Meal plan → food journal in one tap. */
export async function logPlannedMeal(fd: FormData) {
  const viewer = await requireModule("fitness", "edit");
  const memberId = await subject(viewer, String(fd.get("memberId") || "") || null);
  const [e] = await db
    .select({ e: mealPlanEntries, name: recipes.name })
    .from(mealPlanEntries)
    .leftJoin(recipes, eq(recipes.id, mealPlanEntries.recipeId))
    .where(and(eq(mealPlanEntries.id, String(fd.get("id"))), eq(mealPlanEntries.familyId, viewer.family.id)));
  if (!e) return;
  await db.insert(foodJournalEntries).values({ familyId: viewer.family.id, memberId, date: e.e.date, slot: e.e.slot, food: e.name ?? e.e.title ?? "Meal", mealPlanEntryId: e.e.id });
  revalidateFitness();
}

export async function deleteFoodEntry(fd: FormData) {
  const viewer = await requireModule("fitness", "edit");
  const [e] = await db.select().from(foodJournalEntries).where(and(eq(foodJournalEntries.id, String(fd.get("id"))), eq(foodJournalEntries.familyId, viewer.family.id)));
  if (!e) return;
  await subject(viewer, e.memberId);
  await db.delete(foodJournalEntries).where(eq(foodJournalEntries.id, e.id));
  await deleteFamilyFile(viewer.family.id, e.imageFileId);
  revalidateFitness();
}
