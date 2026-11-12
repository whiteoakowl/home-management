"use client";

import { useState } from "react";
import { logMetric, logWorkout, saveExercise, saveFoodEntry, savePlan, saveWorkout } from "@/app/actions/fitness";
import { FormModal } from "@/components/forms/action-form";
import { DateField, FormRow, ImageField, NumberField, SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { Field } from "@/components/ui/form";
import { cn } from "@/lib/utils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function PlanModal({ memberId, plan, triggerLabel = "New plan" }: { memberId: string; plan?: { id: string; name: string; description: string | null; startsOn: string | null; endsOn: string | null }; triggerLabel?: string }) {
  return (
    <FormModal title={plan ? "Edit plan" : "New fitness plan"} triggerLabel={triggerLabel} triggerVariant={plan ? "ghost" : "secondary"} triggerSize={plan ? "sm" : "md"} action={savePlan} size="sm" submitLabel={plan ? "Save" : "Create plan"}>
      {plan ? <input type="hidden" name="id" value={plan.id} /> : <input type="hidden" name="memberId" value={memberId} />}
      <TextField name="name" label="Plan name" required defaultValue={plan?.name} placeholder="Fall strength program" />
      <TextAreaField name="description" label="Description" rows={2} defaultValue={plan?.description ?? ""} />
      <FormRow>
        <DateField name="startsOn" label="Starts" defaultValue={plan?.startsOn ?? ""} />
        <DateField name="endsOn" label="Ends" defaultValue={plan?.endsOn ?? ""} />
      </FormRow>
    </FormModal>
  );
}

function DayPicker({ defaultValue = [] }: { defaultValue?: number[] }) {
  const [days, setDays] = useState<number[]>(defaultValue);
  return (
    <div className="flex gap-1.5" role="group" aria-label="Days">
      {DAYS.map((d, i) => (
        <button
          key={d}
          type="button"
          aria-pressed={days.includes(i)}
          onClick={() => setDays((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]))}
          className={cn("h-10 w-11 rounded-xl text-sm font-semibold", days.includes(i) ? "bg-primary-600 text-white" : "bg-sunken text-ink-soft")}
        >
          {d}
          {days.includes(i) && <input type="hidden" name="weekday" value={i} />}
        </button>
      ))}
    </div>
  );
}

export function WorkoutModal({ planId, workout }: { planId: string; workout?: { id: string; name: string; focus: string | null; notes: string | null; days: number[] } }) {
  return (
    <FormModal title={workout ? "Edit workout" : "Add workout"} triggerLabel={workout ? "Edit" : "Add workout"} triggerVariant={workout ? "ghost" : "primary"} triggerSize="sm" action={saveWorkout} size="sm">
      {workout ? <input type="hidden" name="id" value={workout.id} /> : <input type="hidden" name="planId" value={planId} />}
      <FormRow>
        <TextField name="name" label="Workout" required defaultValue={workout?.name} placeholder="Strength" />
        <TextField name="focus" label="Focus" defaultValue={workout?.focus ?? ""} placeholder="Legs & core" />
      </FormRow>
      <Field label="Scheduled on">
        <DayPicker defaultValue={workout?.days} />
      </Field>
      <TextAreaField name="notes" label="Notes" rows={2} defaultValue={workout?.notes ?? ""} />
    </FormModal>
  );
}

export function ExerciseModal({ workoutId }: { workoutId: string }) {
  return (
    <FormModal title="Add exercise" triggerLabel="Exercise" triggerVariant="ghost" triggerSize="sm" action={saveExercise} size="sm">
      <input type="hidden" name="workoutId" value={workoutId} />
      <TextField name="name" label="Exercise" required placeholder="Goblet squat" />
      <FormRow cols={3}>
        <NumberField name="sets" label="Sets" min={0} />
        <NumberField name="reps" label="Reps" min={0} />
        <NumberField name="minutes" label="Minutes" min={0} />
      </FormRow>
      <FormRow>
        <NumberField name="distance" label="Distance" min={0} />
        <TextField name="distanceUnit" label="Unit" placeholder="mi, km" />
      </FormRow>
      <TextField name="videoUrl" label="Video link" type="url" placeholder="https://youtube.com/…" />
      <TextField name="notes" label="Notes" />
    </FormModal>
  );
}

export function LogWorkoutModal({
  memberId,
  today,
  workouts,
  preset,
  triggerLabel = "Log workout",
  triggerVariant = "primary",
}: {
  memberId: string;
  today: string;
  workouts: { id: string; name: string; template: string }[];
  preset?: string;
  triggerLabel?: string;
  triggerVariant?: "primary" | "secondary" | "soft" | "ghost";
}) {
  const [wid, setWid] = useState(preset ?? "");
  const w = workouts.find((x) => x.id === wid);
  return (
    <FormModal title="Log a workout" triggerLabel={triggerLabel} triggerVariant={triggerVariant} triggerSize={triggerVariant === "primary" ? "md" : "sm"} action={logWorkout} submitLabel="Save workout">
      <input type="hidden" name="memberId" value={memberId} />
      {workouts.length > 0 && (
        <SelectField name="workoutId" label="From plan" value={wid} onChange={(e) => setWid(e.target.value)} placeholder="Something else" options={workouts.map((x) => ({ value: x.id, label: x.name }))} />
      )}
      <FormRow>
        <TextField key={`t${wid}`} name="title" label="Workout" required defaultValue={w?.name ?? ""} placeholder="Morning run" />
        <DateField name="date" label="Date" defaultValue={today} />
        <NumberField name="durationMinutes" label="Minutes" min={0} />
        <SelectField name="effort" label="Effort" defaultValue="3" options={[{ value: "1", label: "1 · Easy" }, { value: "2", label: "2" }, { value: "3", label: "3 · Moderate" }, { value: "4", label: "4" }, { value: "5", label: "5 · All out" }]} />
        <NumberField name="distance" label="Distance" min={0} />
        <TextField name="distanceUnit" label="Unit" defaultValue="mi" />
      </FormRow>
      <TextAreaField key={`s${wid}`} name="sets" label="Sets (optional)" rows={4} defaultValue={w?.template ?? ""} placeholder={"Squat 3x10 @ 135 lb\nPush-up 3x15"} hint="One exercise per line: name sets×reps @ weight. New bests become personal records." />
      <TextAreaField name="notes" label="Notes" rows={2} />
    </FormModal>
  );
}

export function MetricModal({ memberId, today }: { memberId: string; today: string }) {
  const [metric, setMetric] = useState("weight");
  return (
    <FormModal title="Record a measurement" triggerLabel="Measurement" triggerVariant="secondary" triggerSize="sm" action={logMetric} size="sm">
      <input type="hidden" name="memberId" value={memberId} />
      <FormRow>
        <SelectField name="metric" label="What" value={metric} onChange={(e) => setMetric(e.target.value)} options={[{ value: "weight", label: "Weight" }, { value: "waist", label: "Waist" }, { value: "resting_hr", label: "Resting heart rate" }, { value: "steps", label: "Steps" }]} />
        <DateField name="date" label="Date" defaultValue={today} />
        <NumberField name="value" label="Value" required min={0} />
        <TextField key={metric} name="unit" label="Unit" defaultValue={{ weight: "lb", waist: "in", resting_hr: "bpm", steps: "steps" }[metric]} />
      </FormRow>
    </FormModal>
  );
}

export function FoodModal({ memberId, date }: { memberId: string; date: string }) {
  return (
    <FormModal title="Add to food journal" triggerLabel="Add food" action={saveFoodEntry} size="sm">
      <input type="hidden" name="memberId" value={memberId} />
      <FormRow>
        <SelectField name="slot" label="Meal" defaultValue="lunch" options={[{ value: "breakfast", label: "Breakfast" }, { value: "lunch", label: "Lunch" }, { value: "dinner", label: "Dinner" }, { value: "snack", label: "Snack" }]} />
        <DateField name="date" label="Date" defaultValue={date} />
      </FormRow>
      <TextField name="food" label="Food" required placeholder="Turkey sandwich & apple" />
      <TextAreaField name="notes" label="Notes" rows={2} placeholder="How did you feel?" />
      <ImageField label="Photo (optional)" />
    </FormModal>
  );
}
