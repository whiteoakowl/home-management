"use client";

import { Pencil, Plus } from "lucide-react";
import { saveShift } from "@/app/actions/work";
import { FormModal } from "@/components/forms/action-form";
import { ChipSelect, DateField, FormRow, SelectField, TextField, type MemberOption } from "@/components/forms/fields";
import { Field } from "@/components/ui/form";

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type ShiftDefaults = { id: string; memberId: string; date: string; startTime: string; endTime: string; job: string | null; notes: string | null };

/** Add shifts for this week (pick the days, same times) or edit one shift. */
export function ShiftModal({ workers, weekDays, defaultMember, item, jobs = [], defaultOpen }: { workers: MemberOption[]; weekDays: string[]; defaultMember?: string; item?: ShiftDefaults; jobs?: string[]; defaultOpen?: boolean }) {
  return (
    <FormModal
      title={item ? "Edit shift" : "Add shifts"}
      triggerLabel="Add shifts"
      triggerIcon={<Plus className="size-4" />}
      triggerContent={item ? <Pencil className="mx-auto size-3.5" /> : undefined}
      triggerAriaLabel={item ? "Edit shift" : undefined}
      triggerClassName="size-8 rounded-full text-muted hover:bg-sunken"
      action={saveShift}
      size="sm"
      defaultOpen={defaultOpen}
    >
      {item && <input type="hidden" name="id" value={item.id} />}
      {workers.length > 1 ? (
        <SelectField name="memberId" label="Who" defaultValue={item?.memberId ?? defaultMember ?? workers[0]?.id} options={workers.map((m) => ({ value: m.id, label: m.displayName }))} />
      ) : (
        <input type="hidden" name="memberId" value={workers[0]?.id ?? ""} />
      )}
      {item ? (
        <DateField name="date" label="Date" defaultValue={item.date} />
      ) : (
        <Field label="Days this week">
          <ChipSelect name="dates" options={weekDays.map((d) => ({ value: d, label: `${DAY[new Date(`${d}T12:00:00Z`).getUTCDay()]} ${Number(d.slice(8))}` }))} />
        </Field>
      )}
      <FormRow>
        <TextField name="startTime" label="Start" type="time" required defaultValue={item?.startTime.slice(0, 5) ?? ""} />
        <TextField name="endTime" label="End" type="time" required defaultValue={item?.endTime.slice(0, 5) ?? ""} />
      </FormRow>
      <TextField name="job" label="Job / place" defaultValue={item?.job ?? (jobs[0] ?? "")} list="work-jobs" placeholder="Café, Hospital…" />
      <datalist id="work-jobs">
        {jobs.map((j) => (
          <option key={j} value={j} />
        ))}
      </datalist>
      <TextField name="notes" label="Notes" defaultValue={item?.notes ?? ""} placeholder="Opening shift, on call…" />
    </FormModal>
  );
}
