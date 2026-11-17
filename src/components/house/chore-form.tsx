"use client";

import { useState, type ReactNode } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { saveChore } from "@/app/actions/chores";
import { FormModal } from "@/components/forms/action-form";
import {
  DateField,
  FormRow,
  MemberChips,
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
  estimatedCostCents?: number | null;
  points?: number | null;
  rotationMemberIds?: string[];
};

const KIND_LABEL = { chore: "chore", cleaning: "cleaning task", maintenance: "maintenance task", task: "task", farm: "farm chore" } as const;

function ChecklistEditor({ members, initial, limited }: { members: MemberOption[]; initial: { text: string; assigneeId: string | null }[]; limited?: boolean }) {
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
          <Select name="itemAssignee" defaultValue={r.assigneeId ?? ""} aria-label="Assigned to" className={limited ? "hidden" : "h-10 w-36 text-sm"}>
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

/** Create/edit form for every chore kind (chore, cleaning, maintenance, task, farm). */
export function ChoreFormModal({
  kind,
  members,
  rooms,
  categories,
  defaults,
  trigger,
  defaultOpen,
  links,
  showCost,
  label,
  presetRoomId,
  limited,
}: {
  /** A member with Use adding their own: it's theirs, with no points or turns. */
  limited?: boolean;
  kind: keyof typeof KIND_LABEL;
  members: MemberOption[];
  rooms: Opt[];
  categories: Opt[];
  defaults?: ChoreDefaults;
  trigger?: (open: () => void) => ReactNode;
  defaultOpen?: boolean;
  /** Hidden links to other modules (pet care, remodeling project tasks). */
  links?: { petId?: string; projectId?: string; projectStageId?: string };
  /** Show an estimated-cost field (maintenance). */
  showCost?: boolean;
  /** Custom trigger label (server-safe alternative to `trigger`). */
  label?: string;
  /** Pre-select a room for new items. */
  presetRoomId?: string;
}) {
  const [cadence, setCadence] = useState(defaults?.cleaningCadence ?? "weekly");
  const editing = !!defaults;
  // While editing, the type can be switched (chore ↔ cleaning ↔ task); the fields follow it.
  const [type, setType] = useState<keyof typeof KIND_LABEL>(kind);
  const sameCategories = (type === "chore" || type === "task") === (kind === "chore" || kind === "task");
  return (
    <FormModal
      title={editing ? `Edit ${KIND_LABEL[type]}` : `New ${KIND_LABEL[kind]}`}
      triggerLabel={label ?? `Add ${KIND_LABEL[kind]}`}
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
      {editing ? (
        <SelectField
          name="kind"
          label="Type"
          value={type}
          onChange={(e) => setType(e.target.value as keyof typeof KIND_LABEL)}
          options={[
            { value: "chore", label: "Chore" },
            { value: "cleaning", label: "Cleaning" },
            { value: "task", label: "Task" },
            { value: "farm", label: "Farm chore" },
            ...(kind === "maintenance" ? [{ value: "maintenance", label: "Maintenance" }] : []),
          ]}
          hint={type !== kind ? `Saving moves this from ${KIND_LABEL[kind]} to ${KIND_LABEL[type]}. Its history comes along.` : undefined}
        />
      ) : (
        <input type="hidden" name="kind" value={kind} />
      )}
      {defaults && <input type="hidden" name="id" value={defaults.id} />}
      {Object.entries(links ?? {}).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
      <TextField
        name="title"
        label="Name"
        required
        defaultValue={defaults?.title}
        placeholder={{ chore: "Empty the dishwasher", cleaning: "Kitchen deep clean", maintenance: "Replace HVAC filter", task: "Call the plumber", farm: "Feed the chickens and collect eggs" }[type]}
      />
      <FormRow>
        {!limited && <MemberSelect name="assigneeId" members={members} defaultValue={defaults?.defaultAssigneeId} />}
        {rooms.length > 0 && (
          <SelectField name="roomId" label="Room" defaultValue={defaults?.roomId ?? presetRoomId ?? ""} placeholder="No room" options={rooms.map((r) => ({ value: r.id, label: r.name }))} />
        )}
        {categories.length > 0 && sameCategories && (
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

      {type === "cleaning" ? (
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
            label={type === "task" ? "Due date" : "Due / starting"}
            defaultValue={defaults?.rule?.startsOn ?? defaults?.dueDate ?? ""}
            className="sm:max-w-xs"
          />
          <RecurrenceField defaults={defaults?.rule} />
        </>
      )}

      <FormRow>
        <NumberField name="estimatedMinutes" label="Estimated minutes" min={0} defaultValue={defaults?.estimatedMinutes ?? ""} />
        {!limited && (type === "chore" || type === "cleaning" || type === "task" || type === "farm") && (
          <NumberField name="points" label="Reward points" min={0} max={1000} defaultValue={defaults?.points ?? ""} hint="Earned by whoever completes it." />
        )}
        {(showCost || type === "maintenance") && (
          <NumberField name="estimatedCost" label="Estimated cost ($)" min={0} step="0.01" defaultValue={defaults?.estimatedCostCents != null ? defaults.estimatedCostCents / 100 : ""} />
        )}
      </FormRow>
      <TextAreaField name="instructions" label="Instructions" rows={2} defaultValue={defaults?.instructions ?? ""} placeholder="How to do it well…" />
      {!limited && type !== "task" && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium text-ink-soft">Take turns (optional)</legend>
          <MemberChips name="rotation" members={members} defaultValue={defaults?.rotationMemberIds ?? []} />
          <p className="text-xs text-muted">Pick two or more people and they take turns evenly. On any day, everyone gets one chore before anyone gets a second. Change who&apos;s on a day and the turns after it follow on. Leave empty to use the assignee above.</p>
        </fieldset>
      )}
      <ChecklistEditor members={members} initial={defaults?.checklist ?? []} limited={limited} />
      <TextAreaField name="notes" label="Notes" rows={2} defaultValue={defaults?.notes ?? ""} />
    </FormModal>
  );
}
