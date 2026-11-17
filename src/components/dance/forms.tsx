"use client";

import type { ReactNode } from "react";
import { CalendarOff, Pencil, Plus, Star, Trophy } from "lucide-react";
import { saveDanceClass, saveDanceEvent, saveDayOff, saveEnrollment, savePointeFavorite, savePointeShoe } from "@/app/actions/dance";
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

export type DanceEventDefaults = { id: string; memberIds: string[]; kind: string; title: string; date: string; endDate: string | null; callTime: string | null; startTime: string | null; endTime: string | null; location: string | null; details: string | null; costCents: number | null; ticketCents: number | null; link: string | null };

const money = (c: number | null | undefined) => (c != null ? (c / 100).toFixed(2) : "");
const KIND_TITLE: Record<string, string> = { audition: "Add an audition", photos: "Add a picture day" };

export function DanceEventModal({ dancers, item, defaultMember, defaultKind = "performance", triggerLabel = "Performance", triggerIcon }: { dancers: MemberOption[]; item?: DanceEventDefaults; defaultMember?: string; defaultKind?: string; triggerLabel?: string; triggerIcon?: ReactNode }) {
  const kind = item?.kind ?? defaultKind;
  return (
    <FormModal
      title={item ? `Edit ${item.title}` : (KIND_TITLE[defaultKind] ?? "Add a performance or competition")}
      triggerLabel={triggerLabel}
      triggerVariant="secondary"
      triggerIcon={triggerIcon ?? <Trophy className="size-4" />}
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
        <TextField name="title" label="Name" required defaultValue={item?.title} placeholder={kind === "audition" ? "Nutcracker auditions" : kind === "photos" ? "Recital picture day" : "Spring Recital"} />
        <SelectField name="kind" label="Type" defaultValue={kind} options={[{ value: "performance", label: "Performance" }, { value: "competition", label: "Competition" }, { value: "recital", label: "Recital" }, { value: "rehearsal", label: "Dress rehearsal" }, { value: "audition", label: "Audition" }, { value: "photos", label: "Picture day" }, { value: "other", label: "Other" }]} />
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
      <TextAreaField name="details" label={kind === "audition" ? "What to prepare & bring" : kind === "photos" ? "Costume, hair & photo package" : "Costume, hair & what to bring"} rows={3} defaultValue={item?.details ?? ""} placeholder="Red costume, high bun, tan tights, bobby pins…" />
      <FormRow cols={3}>
        <TextField name="cost" label="Our cost ($)" inputMode="decimal" defaultValue={money(item?.costCents)} placeholder="Entry, costume, photos" />
        <TextField name="ticket" label="Ticket price ($)" inputMode="decimal" defaultValue={money(item?.ticketCents)} placeholder="Per seat" />
        <TextField name="link" label="Link" inputMode="url" defaultValue={item?.link ?? ""} placeholder="Tickets or info page" />
      </FormRow>
    </FormModal>
  );
}

// ─── Pointe shoes ────────────────────────────────────────────────────────────

export type PointeShoeDefaults = {
  id: string;
  memberId: string;
  brand: string;
  model: string | null;
  size: string | null;
  width: string | null;
  shank: string | null;
  wings: string | null;
  status: string;
  store: string | null;
  priceCents: number | null;
  orderedOn: string | null;
  receivedOn: string | null;
  firstWornOn: string | null;
  retiredOn: string | null;
  reorderBy: string | null;
  notes: string | null;
};
type Fit = { brand: string; model: string | null; size: string | null; width: string | null; shank: string | null; wings: string | null };

function FitFields({ item }: { item?: Partial<Fit> }) {
  return (
    <>
      <FormRow>
        <TextField name="brand" label="Brand" required defaultValue={item?.brand ?? ""} placeholder="Gaynor Minden, Bloch, Freed…" />
        <TextField name="model" label="Model" defaultValue={item?.model ?? ""} placeholder="Classic, Jetstream…" />
      </FormRow>
      <FormRow cols={4}>
        <TextField name="size" label="Size" defaultValue={item?.size ?? ""} placeholder="6" />
        <TextField name="width" label="Width" defaultValue={item?.width ?? ""} placeholder="X, 3, C" />
        <TextField name="shank" label="Shank" defaultValue={item?.shank ?? ""} placeholder="Hard, 3/4" />
        <TextField name="wings" label="Wings" defaultValue={item?.wings ?? ""} placeholder="Medium" />
      </FormRow>
    </>
  );
}

/** Add or edit a pair of pointe shoes (or start an order from a favourite fit). */
export function PointeShoeModal({ dancers, item, fit, defaultMember, defaultStatus = "on_hand", triggerLabel = "Add pair", triggerContent, triggerClassName }: { dancers: MemberOption[]; item?: PointeShoeDefaults; fit?: Fit & { memberId: string }; defaultMember?: string; defaultStatus?: string; triggerLabel?: string; triggerContent?: ReactNode; triggerClassName?: string }) {
  return (
    <FormModal
      title={item ? `Edit ${item.brand}` : defaultStatus === "ordered" ? "Order pointe shoes" : "Add a pair of pointe shoes"}
      triggerLabel={triggerLabel}
      triggerVariant="secondary"
      triggerIcon={<Plus className="size-4" />}
      triggerContent={triggerContent ?? (item ? editIcon : undefined)}
      triggerAriaLabel={item ? `Edit ${item.brand}` : undefined}
      triggerClassName={triggerClassName ?? (item ? iconBtn : undefined)}
      action={savePointeShoe}
    >
      {item && <input type="hidden" name="id" value={item.id} />}
      <DancerField dancers={dancers} defaultValue={item?.memberId ?? fit?.memberId ?? defaultMember} />
      <FitFields item={item ?? fit} />
      <FormRow>
        <SelectField name="status" label="Status" defaultValue={item?.status ?? defaultStatus} options={[{ value: "ordered", label: "Ordered" }, { value: "on_hand", label: "On hand (spare)" }, { value: "in_use", label: "Wearing now" }, { value: "retired", label: "Dead / retired" }]} />
        <TextField name="price" label="Price ($)" inputMode="decimal" defaultValue={money(item?.priceCents)} />
      </FormRow>
      <TextField name="store" label="Bought from" defaultValue={item?.store ?? ""} placeholder="Discount Dance, local studio shop…" />
      <FormRow>
        <DateField name="orderedOn" label="Ordered" defaultValue={item?.orderedOn ?? ""} />
        <DateField name="receivedOn" label="Received / bought" defaultValue={item?.receivedOn ?? ""} />
      </FormRow>
      <FormRow>
        <DateField name="firstWornOn" label="Started wearing" defaultValue={item?.firstWornOn ?? ""} />
        <DateField name="retiredOn" label="Died / retired" defaultValue={item?.retiredOn ?? ""} />
      </FormRow>
      <DateField name="reorderBy" label="Order next pair by (optional)" defaultValue={item?.reorderBy ?? ""} hint="Leave blank and we'll work it out from how long pairs last." />
      <TextField name="notes" label="Notes" defaultValue={item?.notes ?? ""} placeholder="Darned the platform, new ribbons…" />
    </FormModal>
  );
}

export type PointeFavoriteDefaults = Fit & { id: string; memberId: string; notes: string | null };

/** A favourite brand / fit to reorder from. */
export function PointeFavoriteModal({ dancers, item, defaultMember }: { dancers: MemberOption[]; item?: PointeFavoriteDefaults; defaultMember?: string }) {
  return (
    <FormModal
      title={item ? `Edit ${item.brand}` : "Add a favourite brand"}
      triggerLabel="Favourite"
      triggerVariant="ghost"
      triggerSize="sm"
      triggerIcon={<Star className="size-4" />}
      triggerContent={item ? editIcon : undefined}
      triggerAriaLabel={item ? `Edit ${item.brand}` : undefined}
      triggerClassName={item ? iconBtn : undefined}
      action={savePointeFavorite}
      size="sm"
    >
      {item && <input type="hidden" name="id" value={item.id} />}
      <DancerField dancers={dancers} defaultValue={item?.memberId ?? defaultMember} />
      <FitFields item={item} />
      <TextField name="notes" label="Notes" defaultValue={item?.notes ?? ""} placeholder="Fitter: Jen at Allegro · needs gel toe pads" />
    </FormModal>
  );
}
