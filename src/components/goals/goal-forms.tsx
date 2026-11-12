"use client";

import { useState, type ReactNode } from "react";
import { contributeToGoal, saveGoal, saveMilestone } from "@/app/actions/goals";
import { FormModal } from "@/components/forms/action-form";
import { DateField, FormRow, NumberField, SelectField, TextAreaField, TextField, VisibilityField, type MemberOption } from "@/components/forms/fields";

export type GoalDefaults = {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  horizon: string;
  ownerMemberId: string | null;
  target: number | null;
  monthly: number | null;
  unit: string | null;
  targetDate: string | null;
  notes: string | null;
  visibility: "family" | "private" | "selected";
  sharedWith: string[];
};

const KIND_OPTS = [
  { value: "savings", label: "Savings" },
  { value: "family", label: "Family goal" },
  { value: "personal", label: "Personal goal" },
  { value: "fitness", label: "Fitness goal" },
];
const HORIZON_OPTS = [
  { value: "6m", label: "6 months" },
  { value: "1y", label: "1 year" },
  { value: "5y", label: "5 years" },
  { value: "10y", label: "10 years" },
  { value: "20y", label: "20 years" },
  { value: "custom", label: "Other" },
];

export function GoalFormModal({
  members,
  me,
  isParent,
  defaults,
  defaultKind = "savings",
  defaultOpen,
  triggerContent,
  triggerLabel = "New goal",
}: {
  members: MemberOption[];
  me: string;
  isParent: boolean;
  defaults?: GoalDefaults;
  defaultKind?: string;
  defaultOpen?: boolean;
  triggerContent?: ReactNode;
  triggerLabel?: string;
}) {
  const [kind, setKind] = useState(defaults?.kind ?? defaultKind);
  const money = kind === "savings";
  const owners = [{ value: "family", label: "The whole family" }, ...(isParent ? members : members.filter((m) => m.id === me)).map((m) => ({ value: m.id, label: m.displayName }))];
  return (
    <FormModal
      title={defaults ? "Edit goal" : "New goal"}
      triggerLabel={triggerLabel}
      action={saveGoal}
      submitLabel={defaults ? "Save" : "Create goal"}
      size="lg"
      defaultOpen={defaultOpen}
      triggerContent={triggerContent}
      triggerClassName="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-sunken"
    >
      {defaults && <input type="hidden" name="id" value={defaults.id} />}
      <TextField name="name" label="Goal" required defaultValue={defaults?.name} placeholder={money ? "Emergency fund" : "Run a 5K"} />
      <FormRow cols={3}>
        <SelectField name="kind" label="Type" value={kind} onChange={(e) => setKind(e.target.value)} options={KIND_OPTS} />
        <SelectField name="horizon" label="Timeframe" defaultValue={defaults?.horizon ?? "1y"} options={HORIZON_OPTS} />
        <SelectField name="ownerMemberId" label="Whose goal" defaultValue={defaults ? (defaults.ownerMemberId ?? "family") : money ? "family" : me} options={owners} />
      </FormRow>
      <FormRow cols={3}>
        <NumberField name="target" label={money ? "Target ($)" : "Target"} min={0} defaultValue={defaults?.target ?? ""} />
        {money ? <NumberField name="monthly" label="Monthly contribution ($)" min={0} defaultValue={defaults?.monthly ?? ""} /> : <TextField name="unit" label="Unit" defaultValue={defaults?.unit ?? ""} placeholder="miles, workouts, books…" />}
        <DateField name="targetDate" label="Target date" defaultValue={defaults?.targetDate ?? ""} />
      </FormRow>
      {!defaults && (
        <>
          <NumberField name="current" label={money ? "Already saved ($)" : "Progress so far"} min={0} className="sm:max-w-xs" />
          <TextAreaField name="milestones" label="Milestones (optional)" rows={3} placeholder={money ? "First $1,000: 1000\nHalfway: 5000" : "First mile: 1\nHalfway: 13"} hint="One per line: name and amount." />
        </>
      )}
      <TextAreaField name="description" label="Why it matters" rows={2} defaultValue={defaults?.description ?? ""} />
      <TextAreaField name="notes" label="Notes" rows={2} defaultValue={defaults?.notes ?? ""} />
      <VisibilityField members={members} defaultValue={defaults?.visibility} defaultSelected={defaults?.sharedWith} />
    </FormModal>
  );
}

export function ContributeModal({ goalId, money, unit }: { goalId: string; money: boolean; unit: string | null }) {
  return (
    <FormModal title={money ? "Add to savings" : "Log progress"} triggerLabel={money ? "Add money" : "Log progress"} action={contributeToGoal} size="sm" submitLabel="Add">
      <input type="hidden" name="goalId" value={goalId} />
      <FormRow>
        <NumberField name="amount" label={money ? "Amount ($)" : `Amount${unit ? ` (${unit})` : ""}`} required />
        <DateField name="date" label="Date" />
      </FormRow>
      <TextField name="notes" label="Note" placeholder={money ? "Birthday money" : "Felt great!"} />
    </FormModal>
  );
}

export function MilestoneModal({ goalId, money }: { goalId: string; money: boolean }) {
  return (
    <FormModal title="Add milestone" triggerLabel="Milestone" triggerVariant="ghost" triggerSize="sm" action={saveMilestone} size="sm">
      <input type="hidden" name="goalId" value={goalId} />
      <TextField name="title" label="Milestone" required placeholder="Halfway there" />
      <FormRow>
        <NumberField name="target" label={money ? "At amount ($)" : "At value"} />
        <DateField name="dueOn" label="By (optional)" />
      </FormRow>
    </FormModal>
  );
}
