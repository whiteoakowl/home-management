import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Dumbbell, Flame, Medal, Target, Timer } from "lucide-react";
import { deleteWorkoutLog } from "@/app/actions/fitness";
import { LineChart } from "@/components/charts";
import { DeleteButton } from "@/components/forms/inline";
import { LogWorkoutModal, MetricModal, PlanModal } from "@/components/fitness/fitness-forms";
import { GoalFormModal } from "@/components/goals/goal-forms";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader, ProgressBar } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { addDays, formatShortDate, startOfWeek, todayIn } from "@/lib/dates";
import { fitnessSubject, logsFor, metricsFor, plansFor, recordsFor, templateFor } from "@/lib/fitness";
import { listGoals, progressOf } from "@/lib/goals";
import { memberOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { FitnessNav } from "./fitness-header";

export const metadata: Metadata = { title: "Fitness" };

export default async function FitnessPage({ searchParams }: PageProps<"/fitness">) {
  const viewer = await getViewer();
  if (!viewer.can("fitness")) notFound();
  const sp = await searchParams;
  const subject = await fitnessSubject(viewer, sp.member);
  const today = todayIn(viewer.family.timezone);
  const monday = startOfWeek(today, 1);
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const [members, plans, logs, weights, prs, goals] = await Promise.all([
    memberOptions(viewer),
    plansFor(subject.id),
    logsFor(subject.id, addDays(today, -89), today),
    metricsFor(subject.id, "weight"),
    recordsFor(subject.id),
    viewer.can("goals") ? listGoals(viewer, { kind: "fitness", ownerId: subject.id }) : Promise.resolve([]),
  ]);
  const canEdit = viewer.can("fitness", "edit") && (subject.id === viewer.member.id || viewer.isParent);
  const allWorkouts = plans.flatMap((p) => p.workouts.map((w) => ({ ...w, plan: p.name })));
  const workoutOpts = allWorkouts.map((w) => ({ id: w.id, name: w.name, template: templateFor(w.exercises) }));
  const thisWeek = logs.filter((l) => l.date >= monday);
  const minutes = thisWeek.reduce((s, l) => s + (l.durationMinutes ?? 0), 0);
  const scheduledThisWeek = week.reduce((n, d) => n + allWorkouts.filter((w) => w.days.includes(new Date(`${d}T12:00:00Z`).getUTCDay())).length, 0);
  // Streak: consecutive days (ending today/yesterday) with a workout.
  const days = new Set(logs.map((l) => l.date));
  let streak = 0;
  for (let d = days.has(today) ? today : addDays(today, -1); days.has(d); d = addDays(d, -1)) streak++;
  const weightSeries = [...weights].reverse().map((w) => ({ label: formatShortDate(w.date), value: Number(w.value) }));
  const first = subject.displayName.split(" ")[0];

  return (
    <>
      <PageHeader
        eyebrow="Personal"
        title={subject.id === viewer.member.id ? "My fitness" : `${first}'s fitness`}
        description="Plans, workouts, progress and personal records."
        actions={canEdit ? <LogWorkoutModal memberId={subject.id} today={today} workouts={workoutOpts} /> : undefined}
      />
      <FitnessNav active="overview" subjectId={subject.id} members={members} isParent={viewer.isParent} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <p className="flex items-center gap-2 text-sm text-muted">
            <Dumbbell className="size-4" /> This week
          </p>
          <p className="font-display text-3xl font-semibold">
            {thisWeek.length}
            {scheduledThisWeek > 0 && <span className="text-lg text-muted">/{scheduledThisWeek}</span>}
          </p>
          {scheduledThisWeek > 0 && <ProgressBar value={thisWeek.length} max={scheduledThisWeek} label="Workouts done this week" />}
        </Card>
        <Card>
          <p className="flex items-center gap-2 text-sm text-muted">
            <Timer className="size-4" /> Minutes
          </p>
          <p className="font-display text-3xl font-semibold">{minutes}</p>
        </Card>
        <Card>
          <p className="flex items-center gap-2 text-sm text-muted">
            <Flame className="size-4" /> Streak
          </p>
          <p className="font-display text-3xl font-semibold">
            {streak} <span className="text-lg text-muted">day{streak === 1 ? "" : "s"}</span>
          </p>
        </Card>
        <Card>
          <p className="flex items-center gap-2 text-sm text-muted">
            <Medal className="size-4" /> Personal records
          </p>
          <p className="font-display text-3xl font-semibold">{prs.length}</p>
        </Card>
      </div>

      <section className="mt-6">
        <h2 className="mb-3 text-xl font-semibold">This week&apos;s schedule</h2>
        <div className="grid gap-2 sm:grid-cols-7">
          {week.map((d) => {
            const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
            const scheduled = allWorkouts.filter((w) => w.days.includes(wd));
            const done = logs.filter((l) => l.date === d);
            return (
              <div key={d} className={cn("flex flex-col gap-2 rounded-2xl border bg-surface p-3", d === today ? "border-primary-300 ring-2 ring-primary-100" : "border-line")}>
                <p className="text-sm font-semibold">
                  {new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })}
                  <span className="ml-1 font-normal text-muted">{Number(d.slice(8))}</span>
                </p>
                {scheduled.length === 0 && done.length === 0 && <p className="text-sm text-muted">Rest</p>}
                {scheduled.map((w) => {
                  const isDone = done.some((l) => l.workoutId === w.id);
                  return (
                    <div key={w.id} className={cn("rounded-lg px-2 py-1.5 text-sm", isDone ? "bg-primary-600 text-white" : "bg-primary-50 text-primary-800")}>
                      <span className="flex items-center gap-1 font-medium">
                        {isDone && <Check className="size-3.5" />} {w.name}
                      </span>
                      {w.focus && <span className="text-xs opacity-80">{w.focus}</span>}
                    </div>
                  );
                })}
                {done
                  .filter((l) => !l.workoutId || !scheduled.some((w) => w.id === l.workoutId))
                  .map((l) => (
                    <div key={l.id} className="rounded-lg bg-olive-50 px-2 py-1.5 text-sm text-olive-700">
                      <Check className="mr-1 inline size-3.5" />
                      {l.title}
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Weight" action={canEdit ? <MetricModal memberId={subject.id} today={today} /> : undefined} />
            {weightSeries.length > 1 ? (
              <LineChart data={weightSeries} label="Weight over time" seriesName="Weight" valueFormat={{ suffix: weights[0]?.unit ?? "" }} />
            ) : (
              <p className="text-sm text-muted">{weightSeries.length === 1 ? `Latest: ${weightSeries[0]!.value} ${weights[0]!.unit}. Add another to see a trend.` : "Record measurements to track progress over time."}</p>
            )}
          </Card>
          <Card>
            <CardHeader title="Recent workouts" />
            {logs.length === 0 ? (
              <EmptyState compact icon={<Dumbbell />} title="No workouts logged" description="Log a workout to start tracking progress." />
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {logs.slice(0, 12).map((l) => (
                  <li key={l.id} className="flex items-center gap-3 py-2.5">
                    <span className="w-16 text-sm text-muted">{formatShortDate(l.date)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{l.title}</p>
                      <p className="text-sm text-muted">{[l.durationMinutes && `${l.durationMinutes} min`, l.distance && `${Number(l.distance)} ${l.distanceUnit ?? ""}`, l.effort && `effort ${l.effort}/5`].filter(Boolean).join(" · ")}</p>
                    </div>
                    {canEdit && <DeleteButton action={deleteWorkoutLog} fields={{ id: l.id }} what="this workout" />}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Plans" action={canEdit ? <PlanModal memberId={subject.id} /> : undefined} />
            {plans.length === 0 ? (
              <p className="text-sm text-muted">Create a plan with a weekly schedule. Scheduled workouts show up on the family calendar.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {plans.map((p) => (
                  <li key={p.id}>
                    <Link href={`/fitness/plans/${p.id}`} className="flex items-center justify-between rounded-xl border border-line p-3 hover:border-primary-300">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-sm text-muted">{p.workouts.length} workouts</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Personal records" icon={<Medal className="size-4" />} />
            {prs.length === 0 ? (
              <p className="text-sm text-muted">Log sets with weights (e.g. “Squat 3x5 @ 185”) and new bests are tracked automatically.</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-[15px]">
                {prs.map((r) => (
                  <li key={r.id} className="flex justify-between">
                    <span>{r.exercise}</span>
                    <span>
                      <strong>
                        {Number(r.value)} {r.unit}
                      </strong>{" "}
                      <span className="text-sm text-muted">{formatShortDate(r.achievedOn)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {viewer.can("goals") && (
            <Card>
              <CardHeader
                title="Fitness goals"
                icon={<Target className="size-4" />}
                action={viewer.can("goals", "edit") && canEdit ? <GoalFormModal members={members} me={subject.id} isParent={viewer.isParent} defaultKind="fitness" triggerLabel="Add" /> : undefined}
              />
              {goals.length === 0 ? (
                <p className="text-sm text-muted">Exercise consistently, build strength, run a 5K…</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {goals.map(({ g }) => {
                    const p = progressOf(g);
                    return (
                      <li key={g.id}>
                        <Link href={`/goals/${g.id}`} className="flex flex-col gap-1.5 hover:underline">
                          <span className="flex justify-between text-[15px]">
                            {g.name}
                            {g.status === "achieved" && <Badge tone="primary">Done</Badge>}
                          </span>
                          {p.target > 0 && <ProgressBar value={p.current} max={p.target} label={g.name} />}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
