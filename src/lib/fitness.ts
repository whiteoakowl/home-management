import "server-only";
import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { bodyMetrics, fitnessPlans, personalRecords, recurrenceRules, workoutExercises, workoutLogs, workouts } from "@/db/schema";
import { getFamilyMember, type Viewer } from "./dal";

/** Whose fitness are we looking at? Members: themselves. Parents: anyone. */
export async function fitnessSubject(viewer: Viewer, requested: unknown) {
  if (typeof requested === "string" && requested !== viewer.member.id && viewer.isParent) {
    const m = await getFamilyMember(viewer, requested);
    if (m) return m;
  }
  return viewer.member;
}

export async function plansFor(memberId: string) {
  const plans = await db.select().from(fitnessPlans).where(eq(fitnessPlans.memberId, memberId)).orderBy(desc(fitnessPlans.createdAt));
  const ws = plans.length
    ? await db
        .select({ w: workouts, rule: recurrenceRules })
        .from(workouts)
        .leftJoin(recurrenceRules, eq(recurrenceRules.id, workouts.recurrenceRuleId))
        .where(inArray(workouts.planId, plans.map((p) => p.id)))
        .orderBy(asc(workouts.position), asc(workouts.createdAt))
    : [];
  const ex = ws.length ? await db.select().from(workoutExercises).where(inArray(workoutExercises.workoutId, ws.map((x) => x.w.id))).orderBy(asc(workoutExercises.position), asc(workoutExercises.id)) : [];
  const exBy = Map.groupBy(ex, (e) => e.workoutId);
  const wBy = Map.groupBy(
    ws.map((x) => ({ ...x.w, days: x.rule?.byWeekday ?? [], exercises: exBy.get(x.w.id) ?? [] })),
    (w) => w.planId,
  );
  return plans.map((p) => ({ ...p, workouts: wBy.get(p.id) ?? [] }));
}

export function templateFor(exercises: { name: string; sets: number | null; reps: number | null }[]) {
  return exercises
    .filter((e) => e.sets && e.reps)
    .map((e) => `${e.name} ${e.sets}x${e.reps}`)
    .join("\n");
}

export async function logsFor(memberId: string, from: string, to: string) {
  return db
    .select()
    .from(workoutLogs)
    .where(and(eq(workoutLogs.memberId, memberId), gte(workoutLogs.date, from), lte(workoutLogs.date, to)))
    .orderBy(desc(workoutLogs.date), desc(workoutLogs.createdAt));
}

export async function metricsFor(memberId: string, metric: string, limit = 60) {
  return db.select().from(bodyMetrics).where(and(eq(bodyMetrics.memberId, memberId), eq(bodyMetrics.metric, metric))).orderBy(desc(bodyMetrics.date)).limit(limit);
}

export async function recordsFor(memberId: string) {
  const rows = await db.select().from(personalRecords).where(eq(personalRecords.memberId, memberId)).orderBy(desc(personalRecords.value));
  const best = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!best.has(r.exercise.toLowerCase())) best.set(r.exercise.toLowerCase(), r);
  return [...best.values()];
}
