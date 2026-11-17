"use client";

import type { ReactNode } from "react";
import { CalendarOff, Pencil, Plus, Star, Trophy } from "lucide-react";
import { saveDanceClass, saveDanceEvent, saveDayOff, saveEnrollment } from "@/app/actions/dance";
import { FormModal } from "@/components/forms/action-form";
import { ChipSelect, DateField, FormRow, MemberChips, SelectField, TextAreaField, TextField, type MemberOption } from "@/components/forms/fields";
import { Field } from "@/components/ui/form";

const editIcon = <Pencil className="mx-auto size-4" />;
const iconBtn = "size-9 rounded-full text-muted hover:bg-sunken";

/** Dancer picker: everyone for people who manage Dance, otherwise just yourself. */
function DancerField({ dancers, defaultValue }: { dancers: MemberOption[]; defaultValue?: string }) {
  if (dancers.length === 1) return <input type="hidden" name="memberId" value={dancers[0]!.id} />;
  return <SelectField name="memberId" label="Dancer" defaultValue={defaultValue ?? dancers[0]?.id} options={dancers.map((m) => ({ value: m.id, label: m.displayName }))} />;
}

export type EnrollmentDefaults = { id: string; memberId: string; name: string; kind: string; level: string | null; studio: string | null; style: string | null; season: string | null; active: boolean; notes: string | null };

export function EnrollmentModal({ dancers, item, defaultMember }: { dancers: MemberOption[]; item?: EnrollmentDefaults; defaultMember?: string }) {
  return (
    <FormModal
      title={item ? `Edit ${item.name}` : "Add a team or level"}
      triggerLabel="Team / level"
      triggerVariant="secondary"
      triggerIcon={<Star className="size-4" />}
      triggerContent={item ? editIcon : undefined}
      triggerAriaLabel={item ? `Edit ${item.name}` : undefined}
      triggerClassName={iconBtn}
      action={saveEnrollment}
      size="sm"
    >
      {item && <input type="hidden" name="id" value={item.id} />}
      <DancerField dancers={dancers} defaultValue={item?.memberId ?? defaultMember} />
      <FormRow>
        <TextField name="name" label="Name" required defaultValue={item?.name} placeholder="Junior Competition Team" />
        <SelectField name="kind" label="Type" defaultValue={item?.kind ?? "team"} options={[{ value: "team", label: "Team" }, { value: "level", label: "Level" }, { value: "class", label: "Class" }, { value: "company", label: "Company" }]} />
      </FormRow>
      <FormRow>
        <TextField name="level" label="Level" defaultValue={item?.level ?? ""} placeholder="Level 3, Intermediate…" />
        <TextField name="style" label="Style(s)" defaultValue={item?.style ?? ""} placeholder="Ballet, Jazz, Hip hop" />
      </FormRow>
      <FormRow>
        <TextField name="studio" label="Studio" defaultValue={item?.studio ?? ""} />
        <TextField name="season" label="Season" defaultValue={item?.season ?? ""} placeholder="2026–27" />
      </FormRow>
      {item && <SelectField name="active" label="Status" defaultValue={item.active ? "yes" : "no"} options={[{ value: "yes", label: "Current" }, { value: "no", label: "Past" }]} />}
      <TextField name="notes" label="Notes" defaultValue={item?.notes ?? ""} placeholder="Coach, dues, uniform…" />
    </FormModal>
  );
}

export type ClassDefaults = { id: string; memberId: string; enrollmentId: string | null; title: string; weekday: number; startTime: string; endTime: string | null; location: string | null; startsOn: string | null; endsOn: string | null; notes: string | null };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function DanceClassModal({ dancers, enrollments, item, defaultMember, defaultOpen }: { dancers: MemberOption[]; enrollments: { id: string; memberId: string; name: string }[]; item?: ClassDefaults; defaultMember?: string; defaultOpen?: boolean }) {
  return (
    <FormModal
      title={item ? `Edit ${item.title}` : "Add a weekly class"}
      triggerLabel="Class"
      triggerIcon={<Plus className="size-4" />}
      triggerContent={item ? editIcon : undefined}
      triggerAriaLabel={item ? `Edit ${item.title}` : undefined}
      triggerClassName={iconBtn}
      action={saveDanceClass}
      defaultOpen={defaultOpen}
    >
      {item && <input type="hidden" name="id" value={item.id} />}
      <DancerField dancers={dancers} defaultValue={item?.memberId ?? defaultMember} />
      <FormRow>
        <TextField name="title" label="Class" required defaultValue={item?.title} placeholder="Jazz · Team rehearsal" />
        {enrollments.length > 0 && <SelectField name="enrollmentId" label="Team / level" defaultValue={item?.enrollmentId ?? ""} placeholder="None" options={enrollments.map((e) => ({ value: e.id, label: `${dancers.find((d) => d.id === e.memberId)?.displayName.split(" ")[0] ?? ""}: ${e.name}` }))} />}
      </FormRow>
      <Field label={item ? "Day" : "Day(s)"}>
        {item ? (
          <SelectField name="weekday" label="" defaultValue={String(item.weekday)} options={DAYS.map((d, i) => ({ value: String(i), label: d }))} />
        ) : (
          <ChipSelect name="weekday" options={DAYS.map((d, i) => ({ value: String(i), label: d }))} />
        )}
      </Field>
      <FormRow>
        <TextField name="startTime" label="Starts" type="time" required defaultValue={item?.startTime?.slice(0, 5) ?? ""} />
        <TextField name="endTime" label="Ends" type="time" defaultValue={item?.endTime?.slice(0, 5) ?? ""} />
      </FormRow>
      <TextField name="location" label="Studio / room" defaultValue={item?.location ?? ""} />
      <FormRow>
        <DateField name="startsOn" label="Season starts" defaultValue={item?.startsOn ?? ""} />
        <DateField name="endsOn" label="Season ends" defaultValue={item?.endsOn ?? ""} />
      </FormRow>
      <TextField name="notes" label="Notes" defaultValue={item?.notes ?? ""} placeholder="Bring jazz shoes" />
    </FormModal>
  );
}

export function DayOffModal({ dancers, canAll, item, triggerContent }: { dancers: MemberOption[]; canAll: boolean; item?: { id: string; memberId: string | null; title: string; startDate: string; endDate: string }; triggerContent?: ReactNode }) {
  const options = [...(canAll ? [{ value: "all", label: "Everyone (studio closed)" }] : []), ...dancers.map((m) => ({ value: m.id, label: m.displayName }))];
  return (
    <FormModal
      title={item ? "Edit day off" : "Add days off / holiday"}
      triggerLabel="Day off"
      triggerVariant="secondary"
      triggerIcon={<CalendarOff className="size-4" />}
      triggerContent={triggerContent ?? (item ? editIcon : undefined)}
      triggerAriaLabel={item ? "Edit day off" : undefined}
      triggerClassName={iconBtn}
      action={saveDayOff}
      size="sm"
      description="Classes on these days are skipped on the schedule and calendar."
    >
      {item && <input type="hidden" name="id" value={item.id} />}
      <SelectField name="memberId" label="Who" defaultValue={item ? (item.memberId ?? "all") : options[0]?.value} options={options} />
      <TextField name="title" label="Reason" defaultValue={item?.title ?? ""} placeholder="Thanksgiving break, Recital week, Sick" />
      <FormRow>
        <DateField name="startDate" label="From" required defaultValue={item?.startDate ?? ""} />
        <DateField name="endDate" label="Through" defaultValue={item?.endDate ?? ""} />
      </FormRow>
    </FormModal>
  );
}

export type DanceEventDefaults = { id: string; memberIds: string[]; kind: string; title: string; date: string; endDate: string | null; callTime: string | null; startTime: string | null; endTime: string | null; location: string | null; details: string | null };

export function DanceEventModal({ dancers, item, defaultMember }: { dancers: MemberOption[]; item?: DanceEventDefaults; defaultMember?: string }) {
  return (
    <FormModal
      title={item ? `Edit ${item.title}` : "Add a performance or competition"}
      triggerLabel="Performance"
      triggerVariant="secondary"
      triggerIcon={<Trophy className="size-4" />}
      triggerContent={item ? editIcon : undefined}
      triggerAriaLabel={item ? `Edit ${item.title}` : undefined}
      triggerClassName={iconBtn}
      action={saveDanceEvent}
    >
      {item && <input type="hidden" name="id" value={item.id} />}
      {dancers.length === 1 ? (
        <input type="hidden" name="memberIds" value={dancers[0]!.id} />
      ) : (
        <Field label="Dancers">
          <MemberChips name="memberIds" members={dancers} defaultValue={item?.memberIds ?? (defaultMember ? [defaultMember] : [])} />
        </Field>
      )}
      <FormRow>
        <TextField name="title" label="Name" required defaultValue={item?.title} placeholder="Spring Recital" />
        <SelectField name="kind" label="Type" defaultValue={item?.kind ?? "performance"} options={[{ value: "performance", label: "Performance" }, { value: "competition", label: "Competition" }, { value: "recital", label: "Recital" }, { value: "rehearsal", label: "Dress rehearsal" }, { value: "photos", label: "Picture day" }, { value: "other", label: "Other" }]} />
      </FormRow>
      <FormRow>
        <DateField name="date" label="Date" required defaultValue={item?.date ?? ""} />
        <DateField name="endDate" label="Last day (multi-day)" defaultValue={item?.endDate ?? ""} />
      </FormRow>
      <FormRow cols={3}>
        <TextField name="callTime" label="Call time" type="time" defaultValue={item?.callTime?.slice(0, 5) ?? ""} />
        <TextField name="startTime" label="Starts" type="time" defaultValue={item?.startTime?.slice(0, 5) ?? ""} />
        <TextField name="endTime" label="Ends" type="time" defaultValue={item?.endTime?.slice(0, 5) ?? ""} />
      </FormRow>
      <TextField name="location" label="Venue" defaultValue={item?.location ?? ""} />
      <TextAreaField name="details" label="Costume, hair & what to bring" rows={3} defaultValue={item?.details ?? ""} placeholder="Red costume, high bun, tan tights, bobby pins…" />
    </FormModal>
  );
}
