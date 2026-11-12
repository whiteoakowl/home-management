"use client";

import { useState, type ReactNode } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { saveChore } from "@/app/actions/chores";
import { FormModal } from "@/components/forms/action-form";
import {
  DateField,
  FormRow,
  MemberSelect,
  NumberField,
  RecurrenceField,
  SelectField,
  TextAreaField,
  TextField,
  type MemberOption,
  type RuleDefaults,
} from "@/components/forms/fields";
import { Select } from "@/components/ui/form";

type Opt = { id: string; name: string };
export type ChoreDefaults = {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  roomId: string | null;
  categoryId: string | null;
  cleaningCadence: string | null;
  priority: string;
  estimatedMinutes: number | null;
  defaultAssigneeId: string | null;
  dueDate: string | null;
  notes: string | null;
  rule: (RuleDefaults & { startsOn?: string }) | null;
  checklist: { text: string; assigneeId: string | null }[];
};

const KIND_LABEL = { chore: "chore", cleaning: "cleaning task", maintenance: "maintenance task", task: "task" } as const;

function ChecklistEditor({ members, initial }: { members: MemberOption[]; initial: { text: string; assigneeId: string | null }[] }) {
  const [rows, setRows] = useState(initial.length ? initial.map((r, i) => ({ ...r, key: i })) : []);
  const [next, setNext] = useState(initial.length);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-medium text-ink-soft">Checklist (optional)</legend>
      {rows.map((r, i) => (
        <div key={r.key} className="flex items-center gap-2">
          <span className="size-5 shrink-0 rounded-md border-2 border-line-strong" aria-hidden />
          <input
            name="item"
            defaultValue={r.text}
            aria-label={`Checklist item ${i + 1}`}
            placeholder="e.g. Clean refrigerator"
            className="h-10 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3 text-[15px] focus:border-primary-500 focus:outline-none"
          />
          <Select name="itemAssignee" defaultValue={r.assigneeId ?? ""} aria-label="Assigned to" className="h-10 w-36 text-sm">
            <option value="">Same as chore</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </Select>
          <button type="button" aria-label="Remove item" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="size-9 rounded-full text-muted hover:bg-sunken">
            <X className="mx-auto size-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          setRows((rs) => [...rs, { text: "", assigneeId: null, key: next }]);
          setNext((n) => n + 1);
        }}
        className="inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50"
      >
        <Plus className="size-4" /> Add checklist item
      </button>
    </fieldset>
  );
}

/** Create/edit form for every chore kind (chore, cleaning, maintenance, task). */
export function ChoreFormModal({
  kind,
  members,
  rooms,
  categories,
  defaults,
  trigger,
  defaultOpen,
}: {
  kind: keyof typeof KIND_LABEL;
  members: MemberOption[];
  rooms: Opt[];
  categories: Opt[];
  defaults?: ChoreDefaults;
  trigger?: (open: () => void) => ReactNode;
  defaultOpen?: boolean;
}) {
  const [cadence, setCadence] = useState(defaults?.cleaningCadence ?? "weekly");
  const editing = !!defaults;
  return (
    <FormModal
      title={editing ? `Edit ${KIND_LABEL[kind]}` : `New ${KIND_LABEL[kind]}`}
      triggerLabel={`Add ${KIND_LABEL[kind]}`}
      action={saveChore}
      submitLabel={editing ? "Save changes" : "Add"}
      size="lg"
      defaultOpen={defaultOpen}
      trigger={
        trigger ??
        (editing
          ? (open) => (
              <button type="button" onClick={open} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-sunken">
                <Pencil className="size-4" /> Edit
              </button>
            )
          : undefined)
      }
    >
      <input type="hidden" name="kind" value={kind} />
      {defaults && <input type="hidden" name="id" value={defaults.id} />}
      <TextField
        name="title"
        label="Name"
        required
        defaultValue={defaults?.title}
        placeholder={{ chore: "Empty the dishwasher", cleaning: "Kitchen deep clean", maintenance: "Replace HVAC filter", task: "Call the plumber" }[kind]}
      />
      <FormRow>
        <MemberSelect name="assigneeId" members={members} defaultValue={defaults?.defaultAssigneeId} />
        {rooms.length > 0 && (
          <SelectField name="roomId" label="Room" defaultValue={defaults?.roomId ?? ""} placeholder="No room" options={rooms.map((r) => ({ value: r.id, label: r.name }))} />
        )}
        {categories.length > 0 && (
          <SelectField name="categoryId" label="Category" defaultValue={defaults?.categoryId ?? ""} placeholder="None" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
        )}
        <SelectField
          name="priority"
          label="Priority"
          defaultValue={defaults?.priority ?? "normal"}
          options={[
            { value: "low", label: "Low" },
            { value: "normal", label: "Normal" },
            { value: "high", label: "High" },
          ]}
        />
      </FormRow>

      {kind === "cleaning" ? (
        <>
          <FormRow>
            <SelectField
              name="cadence"
              label="How often"
              value={cadence}
              onChange={(e) => setCadence(e.target.value)}
              options={[
                { value: "daily", label: "Daily" },
                { value: "weekly", label: "Weekly" },
                { value: "monthly", label: "Monthly" },
                { value: "seasonal", label: "Seasonal (4× a year)" },
                { value: "biannual", label: "Bi-annual (Apr & Oct)" },
                { value: "annual", label: "Annual" },
                { value: "custom", label: "Custom schedule" },
              ]}
            />
            <DateField name="dueDate" label="Starting" defaultValue={defaults?.rule?.startsOn ?? defaults?.dueDate ?? ""} hint="Weekly tasks repeat on this weekday." />
          </FormRow>
          {cadence === "custom" && <RecurrenceField defaults={defaults?.rule} />}
        </>
      ) : (
        <>
          <DateField
            name="dueDate"
            label={kind === "task" ? "Due date" : "Due / starting"}
            defaultValue={defaults?.rule?.startsOn ?? defaults?.dueDate ?? ""}
            className="sm:max-w-xs"
          />
          <RecurrenceField defaults={defaults?.rule} />
        </>
      )}

      <FormRow>
        <NumberField name="estimatedMinutes" label="Estimated minutes" min={0} defaultValue={defaults?.estimatedMinutes ?? ""} />
      </FormRow>
      <TextAreaField name="instructions" label="Instructions" rows={2} defaultValue={defaults?.instructions ?? ""} placeholder="How to do it well…" />
      <ChecklistEditor members={members} initial={defaults?.checklist ?? []} />
      <TextAreaField name="notes" label="Notes" rows={2} defaultValue={defaults?.notes ?? ""} />
    </FormModal>
  );
}
