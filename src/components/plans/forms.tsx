"use client";

import type { ReactNode } from "react";
import { BedDouble, Car, MapPin, NotebookPen, Pencil, Plane, Ticket } from "lucide-react";
import { savePlan, savePlanItem } from "@/app/actions/trips";
import { FormModal } from "@/components/forms/action-form";
import { DateField, FormRow, ImageField, MemberChips, SelectField, TextAreaField, TextField, VisibilityField, type MemberOption } from "@/components/forms/fields";
import { Field } from "@/components/ui/form";

const money = (c: number | null | undefined) => (c != null ? (c / 100).toFixed(2) : "");

export type PlanDefaults = {
  id: string;
  title: string;
  kind: string;
  destination: string | null;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  memberIds: string[];
  savingsGoalId: string | null;
  budgetCents: number | null;
  visibility: "family" | "selected" | "parents" | "private";
  shared: string[];
  imageUrl: string | null;
};

/** Create or edit a plan: what, where, when, who's going, who sees it, and its savings goal. */
export function PlanModal({ members, goals, item, defaultOpen, triggerContent, triggerClassName }: { members: MemberOption[]; goals: { id: string; name: string }[]; item?: PlanDefaults; defaultOpen?: boolean; triggerContent?: ReactNode; triggerClassName?: string }) {
  return (
    <FormModal
      title={item ? "Edit plan" : "Start a plan"}
      triggerLabel="New plan"
      triggerContent={triggerContent}
      triggerClassName={triggerClassName}
      action={savePlan}
      submitLabel={item ? "Save" : "Create plan"}
      defaultOpen={defaultOpen}
    >
      {item && <input type="hidden" name="id" value={item.id} />}
      <FormRow>
        <TextField name="title" label="Name" required defaultValue={item?.title} placeholder="Disney World 2027, Beach week, Grandma's 80th" />
        <SelectField name="kind" label="Type" defaultValue={item?.kind ?? "vacation"} options={[{ value: "vacation", label: "Vacation" }, { value: "trip", label: "Trip" }, { value: "event", label: "Event" }, { value: "other", label: "Other" }]} />
      </FormRow>
      <TextField name="destination" label="Where" defaultValue={item?.destination ?? ""} placeholder="Orlando, FL" />
      <FormRow>
        <DateField name="startDate" label="Starts" defaultValue={item?.startDate ?? ""} />
        <DateField name="endDate" label="Ends" defaultValue={item?.endDate ?? ""} />
      </FormRow>
      <TextAreaField name="description" label="About this plan" rows={3} defaultValue={item?.description ?? ""} placeholder="What it is, what to pack, the big moments…" />
      <Field label="Who's going">
        <MemberChips name="memberIds" members={members} defaultValue={item?.memberIds ?? []} />
      </Field>
      <FormRow>
        <SelectField name="savingsGoalId" label="Savings goal" defaultValue={item?.savingsGoalId ?? ""} placeholder="None" options={goals.map((g) => ({ value: g.id, label: g.name }))} hint={goals.length ? undefined : "Make a savings goal in Goals to link it here."} />
        <TextField name="budget" label="Budget ($)" inputMode="decimal" defaultValue={money(item?.budgetCents)} />
      </FormRow>
      <ImageField currentUrl={item?.imageUrl} label="Cover photo" />
      <VisibilityField members={members} defaultValue={item?.visibility ?? "family"} defaultSelected={item?.shared ?? []} privateHint="Only you will see this plan. Nobody else, parents included." />
    </FormModal>
  );
}

export type PlanItemDefaults = {
  id: string;
  kind: string;
  title: string;
  date: string | null;
  startTime: string | null;
  endDate: string | null;
  endTime: string | null;
  location: string | null;
  fromPlace: string | null;
  toPlace: string | null;
  provider: string | null;
  confirmation: string | null;
  phone: string | null;
  link: string | null;
  costCents: number | null;
  notes: string | null;
};

const KIND_UI = {
  itinerary: { label: "Itinerary", icon: MapPin, title: "Add to the itinerary" },
  flight: { label: "Flight", icon: Plane, title: "Add a flight" },
  hotel: { label: "Hotel", icon: BedDouble, title: "Add a place to stay" },
  vehicle: { label: "Vehicle", icon: Car, title: "Add a car or transport" },
  reservation: { label: "Reservation", icon: Ticket, title: "Add a reservation" },
  note: { label: "Note", icon: NotebookPen, title: "Add a note" },
} as const;
type ItemKind = keyof typeof KIND_UI;

/** One itinerary stop, flight, hotel, vehicle or note. */
export function PlanItemModal({ planId, item, defaultKind = "itinerary", defaultDate, triggerLabel }: { planId: string; item?: PlanItemDefaults; defaultKind?: ItemKind; defaultDate?: string | null; triggerLabel?: string }) {
  // Which card's "Add" was pressed decides the type (editing keeps the item's own).
  const kind: ItemKind = (item?.kind as ItemKind) ?? defaultKind;
  const Icon = KIND_UI[defaultKind].icon;
  const t = (k: string) => (item?.[k as keyof PlanItemDefaults] as string | null | undefined) ?? "";
  return (
    <FormModal
      title={item ? `Edit ${item.title}` : KIND_UI[kind].title}
      triggerLabel={triggerLabel ?? KIND_UI[defaultKind].label}
      triggerVariant={item ? undefined : "secondary"}
      triggerSize="sm"
      triggerIcon={item ? undefined : <Icon className="size-4" />}
      triggerContent={item ? <Pencil className="mx-auto size-4" /> : undefined}
      triggerAriaLabel={item ? `Edit ${item.title}` : undefined}
      triggerClassName={item ? "size-9 rounded-full text-muted hover:bg-sunken" : undefined}
      action={savePlanItem}
    >
      <input type="hidden" name="planId" value={planId} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <input type="hidden" name="kind" value={kind} />
      {kind === "flight" ? (
        <>
          <FormRow>
            <TextField name="fromPlace" label="From" defaultValue={t("fromPlace")} placeholder="CLT" />
            <TextField name="toPlace" label="To" defaultValue={t("toPlace")} placeholder="MCO" />
          </FormRow>
          <TextField name="provider" label="Airline & flight number" defaultValue={t("provider")} placeholder="Delta 1234" />
          <TextField name="title" label="Name (optional)" defaultValue={item?.title ?? ""} placeholder="Flight down" />
        </>
      ) : kind === "hotel" || kind === "vehicle" ? (
        <>
          <TextField name="provider" label={kind === "hotel" ? "Hotel / rental" : "Company or vehicle"} defaultValue={t("provider")} placeholder={kind === "hotel" ? "Disney's Pop Century Resort" : "Enterprise · Minivan, or our Honda Pilot"} />
          <TextField name="title" label="Name (optional)" defaultValue={item?.title ?? ""} placeholder={kind === "hotel" ? "Hotel" : "Rental car"} />
        </>
      ) : (
        <TextField
          name="title"
          label={kind === "note" ? "Title" : kind === "reservation" ? "Reservation" : "What"}
          required
          defaultValue={item?.title ?? ""}
          placeholder={kind === "note" ? "Packing list" : kind === "reservation" ? "Dinner at Be Our Guest, park tickets, character breakfast…" : "Magic Kingdom, dinner reservation, beach day…"}
        />
      )}
      {kind !== "note" && (
        <>
          <FormRow>
            <DateField name="date" label={kind === "hotel" ? "Check in" : kind === "vehicle" ? "Pick up" : kind === "flight" ? "Departs" : "Date"} defaultValue={t("date") || defaultDate || ""} />
            <TextField name="startTime" label="Time" type="time" defaultValue={item?.startTime?.slice(0, 5) ?? ""} />
          </FormRow>
          <FormRow>
            <DateField name="endDate" label={kind === "hotel" ? "Check out" : kind === "vehicle" ? "Drop off" : kind === "flight" ? "Arrives" : "Until (optional)"} defaultValue={t("endDate")} />
            <TextField name="endTime" label="Time" type="time" defaultValue={item?.endTime?.slice(0, 5) ?? ""} />
          </FormRow>
          <TextField name="location" label={kind === "flight" ? "Terminal / gate" : "Address / place"} defaultValue={t("location")} />
          <FormRow cols={3}>
            <TextField name="confirmation" label="Confirmation #" defaultValue={t("confirmation")} />
            <TextField name="phone" label="Phone" type="tel" defaultValue={t("phone")} />
            <TextField name="cost" label="Cost ($)" inputMode="decimal" defaultValue={money(item?.costCents)} />
          </FormRow>
          <TextField name="link" label="Link" inputMode="url" defaultValue={t("link")} placeholder="Booking or tickets page" />
        </>
      )}
      <TextAreaField name="notes" label="Notes" rows={kind === "note" ? 6 : 2} defaultValue={t("notes")} />
    </FormModal>
  );
}
