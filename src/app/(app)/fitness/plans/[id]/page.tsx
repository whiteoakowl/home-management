import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, PlayCircle, Trash2 } from "lucide-react";
import { db } from "@/db";
import { fitnessPlans } from "@/db/schema";
import { deleteExercise, deletePlan, deleteWorkout } from "@/app/actions/fitness";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { ExerciseModal, LogWorkoutModal, PlanModal, WorkoutModal } from "@/components/fitness/fitness-forms";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { formatShortDate, todayIn } from "@/lib/dates";
import { plansFor, templateFor } from "@/lib/fitness";

export const metadata: Metadata = { title: "Fitness plan" };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function PlanPage({ params }: PageProps<"/fitness/plans/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const viewer = await getViewer();
  if (!viewer.can("fitness")) notFound();
  const [row] = await db.select().from(fitnessPlans).where(and(eq(fitnessPlans.id, id), eq(fitnessPlans.familyId, viewer.family.id)));
  if (!row || (row.memberId !== viewer.member.id && !viewer.isParent)) notFound();
  const plan = (await plansFor(row.memberId)).find((p) => p.id === id)!;
  const canEdit = viewer.can("fitness", "edit");
  const today = todayIn(viewer.family.timezone);
  const opts = plan.workouts.map((w) => ({ id: w.id, name: w.name, template: templateFor(w.exercises) }));
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <Link href={`/fitness?member=${row.memberId}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Fitness
      </Link>
      <PageHeader
        eyebrow="Fitness plan"
        title={plan.name}
        description={[plan.description, plan.startsOn && `From ${formatShortDate(plan.startsOn)}`, plan.endsOn && `to ${formatShortDate(plan.endsOn)}`].filter(Boolean).join(" · ") || undefined}
        actions={
          canEdit ? (
            <>
              <WorkoutModal planId={plan.id} />
              <PlanModal memberId={row.memberId} plan={plan} triggerLabel="Edit plan" />
              <ActionButton action={deletePlan} fields={{ id }} confirm="Delete this plan and its workouts?" label="Delete plan" className="size-9 rounded-lg text-muted hover:bg-wine-50 hover:text-wine-500">
                <Trash2 className="size-4" />
              </ActionButton>
            </>
          ) : undefined
        }
      />
      <div className="grid grid-cols-7 gap-1.5 rounded-2xl border border-line bg-surface p-3 text-center">
        {DAYS.map((d, i) => {
          const ws = plan.workouts.filter((w) => w.days.includes(i));
          return (
            <div key={d} className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted uppercase">{d}</span>
              {ws.length ? ws.map((w) => <span key={w.id} className="truncate rounded-md bg-primary-50 px-1 py-1 text-xs font-medium text-primary-700">{w.name}</span>) : <span className="py-1 text-xs text-muted">Rest</span>}
            </div>
          );
        })}
      </div>
      {plan.workouts.length === 0 ? (
        <Card>
          <EmptyState icon={<PlayCircle />} title="No workouts in this plan" description="Add workouts like Strength or Cardio, pick their days, then add exercises." action={canEdit ? <WorkoutModal planId={plan.id} /> : undefined} />
        </Card>
      ) : (
        plan.workouts.map((w) => (
          <Card key={w.id}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">{w.name}</h2>
              {w.focus && <Badge>{w.focus}</Badge>}
              <span className="text-sm text-muted">{w.days.length ? w.days.sort().map((d) => DAYS[d]).join(", ") : "Not scheduled"}</span>
              <div className="ml-auto flex items-center gap-1">
                {canEdit && <LogWorkoutModal memberId={row.memberId} today={today} workouts={opts} preset={w.id} triggerLabel="Log it" triggerVariant="soft" />}
                {canEdit && <ExerciseModal workoutId={w.id} />}
                {canEdit && <WorkoutModal planId={plan.id} workout={{ id: w.id, name: w.name, focus: w.focus, notes: w.notes, days: w.days }} />}
                {canEdit && <DeleteButton action={deleteWorkout} fields={{ id: w.id }} what={w.name} />}
              </div>
            </div>
            {w.exercises.length === 0 ? (
              <p className="text-sm text-muted">No exercises yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {w.exercises.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 py-2">
                    <span className="flex-1 font-medium">{e.name}</span>
                    <span className="text-sm text-muted">
                      {[e.sets && e.reps && `${e.sets} × ${e.reps}`, e.durationSeconds && `${Math.round(e.durationSeconds / 60)} min`, e.distance && `${Number(e.distance)} ${e.distanceUnit ?? ""}`].filter(Boolean).join(" · ")}
                    </span>
                    {e.videoUrl && (
                      <a href={e.videoUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:underline">
                        <PlayCircle className="size-4" /> Video
                      </a>
                    )}
                    {canEdit && <DeleteButton action={deleteExercise} fields={{ id: e.id }} what={e.name} />}
                  </li>
                ))}
              </ul>
            )}
            {w.notes && <p className="mt-2 text-sm text-muted">{w.notes}</p>}
          </Card>
        ))
      )}
    </div>
  );
}
