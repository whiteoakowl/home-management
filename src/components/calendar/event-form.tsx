"use client";

import { useState, type ReactNode } from "react";
import { saveEvent } from "@/app/actions/calendar";
import { FormModal } from "@/components/forms/action-form";
import { DateField, FieldError, FormRow, MemberChips, RecurrenceField, SelectField, TextAreaField, TextField, VisibilityField, type MemberOption, type RuleDefaults } from "@/components/forms/fields";
import { ColorPicker } from "@/components/family/member-form";
import { Field, Input } from "@/components/ui/form";

export type EventDefaults = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  categoryId: string | null;
  color: string | null;
  reminderMinutes: number | null;
  notes: string | null;
  attendees: string[];
  visibility: "family" | "private" | "selected";
  sharedWith: string[];
  rule: RuleDefaults | null;
};

export function EventFormModal({
  members,
  categories,
  defaults,
  defaultDate,
  defaultOpen,
  trigger,
  triggerContent,
  me,
}: {
  members: MemberOption[];
  categories: { id: string; name: string }[];
  defaults?: EventDefaults;
  defaultDate: string;
  defaultOpen?: boolean;
  trigger?: (open: () => void) => ReactNode;
  /** Serializable trigger for Server Component callers. */
  triggerContent?: ReactNode;
  me: string;
}) {
  const [allDay, setAllDay] = useState(defaults?.allDay ?? false);
  const [startTime, setStartTime] = useState(defaults?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(defaults?.endTime ?? "10:00");
  // Keep the end after the start (default 1-hour events).
  const changeStart = (v: string) => {
    setStartTime(v);
    if (!endTime || endTime <= v) {
      const [h, m] = v.split(":").map(Number);
      setEndTime(`${String(Math.min(23, (h ?? 0) + 1)).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}`);
    }
  };
  return (
    <FormModal title={defaults ? "Edit event" : "New event"} triggerLabel="New event" action={saveEvent} submitLabel={defaults ? "Save" : "Add event"} size="lg" defaultOpen={defaultOpen} trigger={trigger}
      triggerContent={triggerContent}
      triggerClassName="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-sunken">
      {defaults && <input type="hidden" name="id" value={defaults.id} />}
      <TextField name="title" label="Event" required defaultValue={defaults?.title} placeholder="Doctor appointment" />
      <FormRow>
        <DateField name="date" label="Date" required defaultValue={defaults?.date ?? defaultDate} />
        <label className="flex items-center gap-3 self-end pb-2.5 text-[15px]">
          <input type="checkbox" name="allDay" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="size-5 accent-primary-600" />
          All day
        </label>
      </FormRow>
      {allDay ? (
        <DateField name="endDate" label="Ends (for multi-day events)" defaultValue={defaults?.endDate ?? ""} className="sm:max-w-xs" />
      ) : (
        <FormRow>
          <Field label="Starts" htmlFor="f-startTime">
            <Input id="f-startTime" name="startTime" type="time" value={startTime} onChange={(e) => changeStart(e.target.value)} />
          </Field>
          <Field label="Ends" htmlFor="f-endTime">
            <Input id="f-endTime" name="endTime" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            <FieldError name="endTime" />
          </Field>
        </FormRow>
      )}
      <FormRow>
        <TextField name="location" label="Location" defaultValue={defaults?.location ?? ""} />
        <SelectField name="categoryId" label="Category" defaultValue={defaults?.categoryId ?? ""} placeholder="None" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
      </FormRow>
      <Field label="Who's going">
        <MemberChips name="attendees" members={members} defaultValue={defaults?.attendees ?? [me]} />
      </Field>
      <Field label="Colour (optional, defaults to category or first person)">
        <ColorPicker defaultValue={defaults?.color ?? ""} />
      </Field>
      <RecurrenceField defaults={defaults?.rule} />
      <FormRow>
        <SelectField
          name="reminderMinutes"
          label="Reminder"
          defaultValue={defaults?.reminderMinutes?.toString() ?? ""}
          placeholder="None"
          options={[
            { value: "10", label: "10 minutes before" },
            { value: "30", label: "30 minutes before" },
            { value: "60", label: "1 hour before" },
            { value: "1440", label: "1 day before" },
          ]}
        />
        <Field label="Attachment" htmlFor="f-attachment">
          <input id="f-attachment" name="attachment" type="file" accept="application/pdf,image/*" className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-primary-700" />
        </Field>
      </FormRow>
      <TextAreaField name="description" label="Description" rows={2} defaultValue={defaults?.description ?? ""} />
      <TextAreaField name="notes" label="Notes" rows={2} defaultValue={defaults?.notes ?? ""} />
      <VisibilityField members={members} defaultValue={defaults?.visibility} defaultSelected={defaults?.sharedWith} />
    </FormModal>
  );
}
