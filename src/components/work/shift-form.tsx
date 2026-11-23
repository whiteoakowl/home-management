"use client";

import type { ReactNode } from "react";
import { CalendarOff, Eye, Pencil, Plus, Repeat } from "lucide-react";
import { savePattern, saveShift, saveTimeOff, saveWorkSharing } from "@/app/actions/work";
import { FormModal } from "@/components/forms/action-form";
import { ChipSelect, DateField, FormRow, SelectField, TextAreaField, TextField, VisibilityField, type MemberOption } from "@/components/forms/fields";
import { TIME_OFF_KINDS } from "@/lib/work-schedule";
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

const SHARE_LABEL: Record<string, string> = { family: "Whole family", selected: "Selected people", parents: "Parents & me", private: "Only me" };

/** "Who sees my schedule" — each person decides for their own shifts. */
export function WorkSharingModal({ members, visibility, shared }: { members: MemberOption[]; visibility: "family" | "selected" | "parents" | "private"; shared: string[] }) {
  return (
    <FormModal
      title="Who sees my work schedule"
      triggerContent={
        <>
          <Eye className="size-4" /> {SHARE_LABEL[visibility]}
        </>
      }
      triggerAriaLabel={`Who sees my work schedule: ${SHARE_LABEL[visibility]}`}
      triggerClassName="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-sm font-medium whitespace-nowrap hover:bg-sunken"
      action={saveWorkSharing}
      size="sm"
      description="Your shifts show on the Work page and the family calendar only for the people you choose."
    >
      <VisibilityField members={members} defaultValue={visibility} defaultSelected={shared} privateHint="Only you will see your schedule. Nobody else, parents included." />
    </FormModal>
  );
}

const WEEK = [1, 2, 3, 4, 5, 6, 0];

export type PatternDefaults = { id: string; memberId: string; weekdays: number[]; startTime: string; endTime: string; job: string | null; notes: string | null; startsOn: string; endsOn: string | null };

/** A regular schedule that repeats every week until it's changed or ended. */
export function PatternModal({ workers, defaultMember, item, jobs = [], today, triggerLabel = "Regular schedule" }: { workers: MemberOption[]; defaultMember?: string; item?: PatternDefaults; jobs?: string[]; today: string; triggerLabel?: string }) {
  return (
    <FormModal
      title={item ? "Edit regular schedule" : "Set a regular schedule"}
      description="Repeats every week until you change or end it. Days off skip it automatically."
      triggerLabel={triggerLabel}
      triggerVariant="secondary"
      triggerIcon={<Repeat className="size-4" />}
      triggerContent={item ? <Pencil className="mx-auto size-3.5" /> : undefined}
      triggerAriaLabel={item ? "Edit regular schedule" : undefined}
      triggerClassName="size-8 rounded-full text-muted hover:bg-sunken"
      action={savePattern}
      size="sm"
    >
      {item && <input type="hidden" name="id" value={item.id} />}
      {workers.length > 1 ? (
        <SelectField name="memberId" label="Who" defaultValue={item?.memberId ?? defaultMember ?? workers[0]?.id} options={workers.map((m) => ({ value: m.id, label: m.displayName }))} />
      ) : (
        <input type="hidden" name="memberId" value={workers[0]?.id ?? ""} />
      )}
      <Field label="Days they work">
        <ChipSelect name="weekdays" options={WEEK.map((d) => ({ value: String(d), label: DAY[d]! }))} defaultValue={(item?.weekdays ?? [1, 2, 3, 4, 5]).map(String)} />
      </Field>
      <FormRow>
        <TextField name="startTime" label="Start" type="time" required defaultValue={item?.startTime.slice(0, 5) ?? "09:00"} />
        <TextField name="endTime" label="End" type="time" required defaultValue={item?.endTime.slice(0, 5) ?? "17:00"} />
      </FormRow>
      <TextField name="job" label="Job / place" defaultValue={item?.job ?? (jobs[0] ?? "")} list="work-jobs-p" placeholder="Office, Hospital…" />
      <datalist id="work-jobs-p">
        {jobs.map((j) => (
          <option key={j} value={j} />
        ))}
      </datalist>
      <FormRow>
        <DateField name="startsOn" label="Starting" defaultValue={item?.startsOn ?? today} />
        <DateField name="endsOn" label="Until (optional)" defaultValue={item?.endsOn ?? ""} hint="Leave blank to keep it going." />
      </FormRow>
      <TextField name="notes" label="Notes" defaultValue={item?.notes ?? ""} placeholder="Lunch 12–1, hybrid Fridays…" />
    </FormModal>
  );
}

export type TimeOffDefaults = { id: string; memberId: string; kind: string; title: string | null; startDate: string; endDate: string; notes: string | null };

/** Vacation, sick days and holidays: the regular schedule is skipped on these days. */
export function TimeOffModal({ workers, defaultMember, item, triggerContent, triggerClassName }: { workers: MemberOption[]; defaultMember?: string; item?: TimeOffDefaults; triggerContent?: ReactNode; triggerClassName?: string }) {
  return (
    <FormModal
      title={item ? "Edit time off" : "Add time off"}
      description="Vacation, sick days, holidays. The regular schedule is skipped on these days, here and on the family calendar."
      triggerLabel="Time off"
      triggerVariant="secondary"
      triggerIcon={<CalendarOff className="size-4" />}
      triggerContent={triggerContent ?? (item ? <Pencil className="mx-auto size-3.5" /> : undefined)}
      triggerAriaLabel={item ? "Edit time off" : undefined}
      triggerClassName={triggerClassName ?? "size-8 rounded-full text-muted hover:bg-sunken"}
      action={saveTimeOff}
      size="sm"
    >
      {item && <input type="hidden" name="id" value={item.id} />}
      {workers.length > 1 ? (
        <SelectField name="memberId" label="Who" defaultValue={item?.memberId ?? defaultMember ?? workers[0]?.id} options={workers.map((m) => ({ value: m.id, label: m.displayName }))} />
      ) : (
        <input type="hidden" name="memberId" value={workers[0]?.id ?? ""} />
      )}
      <FormRow>
        <SelectField name="kind" label="Type" defaultValue={item?.kind ?? "vacation"} options={TIME_OFF_KINDS.map((k) => ({ value: k.value, label: `${k.emoji} ${k.label}` }))} />
        <TextField name="title" label="Name (optional)" defaultValue={item?.title ?? ""} placeholder="Beach trip, Thanksgiving" maxLength={80} />
      </FormRow>
      <FormRow>
        <DateField name="startDate" label="From" required defaultValue={item?.startDate ?? ""} />
        <DateField name="endDate" label="Through" defaultValue={item?.endDate ?? ""} hint="Leave blank for one day." />
      </FormRow>
      <TextAreaField name="notes" label="Notes" rows={2} defaultValue={item?.notes ?? ""} maxLength={300} />
    </FormModal>
  );
}
