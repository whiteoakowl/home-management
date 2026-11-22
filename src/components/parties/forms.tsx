"use client";

import type { ReactNode } from "react";
import { saveParty, savePartyGuest, savePartyItem } from "@/app/actions/parties";
import { FormModal } from "@/components/forms/action-form";
import { CheckboxField, DateField, FormRow, ImageField, NumberField, SelectField, TextAreaField, TextField, VisibilityField, type MemberOption } from "@/components/forms/fields";

const money = (c: number | null | undefined) => (c != null ? (c / 100).toFixed(2) : "");

export type PartyDefaults = {
  id: string;
  title: string;
  kind: string;
  honoreeMemberId: string | null;
  honoreeName: string | null;
  age: number | null;
  theme: string | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  venue: string | null;
  address: string | null;
  description: string | null;
  rsvpBy: string | null;
  budgetCents: number | null;
  visibility: "family" | "selected" | "parents" | "private";
  shared: string[];
  imageUrl: string | null;
};

/** Plan a party, or edit its details. */
export function PartyModal({ members, item, defaultOpen, triggerContent, triggerClassName }: { members: MemberOption[]; item?: PartyDefaults; defaultOpen?: boolean; triggerContent?: ReactNode; triggerClassName?: string }) {
  return (
    <FormModal title={item ? "Edit party" : "Plan a party"} triggerLabel="New party" triggerContent={triggerContent} triggerClassName={triggerClassName} action={saveParty} submitLabel={item ? "Save" : "Create party"} defaultOpen={defaultOpen}>
      {item && <input type="hidden" name="id" value={item.id} />}
      <FormRow>
        <SelectField
          name="kind"
          label="Type"
          defaultValue={item?.kind ?? "birthday"}
          options={[
            { value: "birthday", label: "Birthday party" },
            { value: "shower", label: "Baby or bridal shower" },
            { value: "graduation", label: "Graduation" },
            { value: "holiday", label: "Holiday party" },
            { value: "other", label: "Other celebration" },
          ]}
        />
        <SelectField name="honoreeMemberId" label="Whose party" defaultValue={item?.honoreeMemberId ?? ""} placeholder="Someone else" options={members.map((m) => ({ value: m.id, label: m.displayName }))} />
      </FormRow>
      <FormRow>
        <TextField name="honoreeName" label="Or their name" defaultValue={item?.honoreeName ?? ""} placeholder="Grandpa Joe" hint="If they're not in the family list." />
        <NumberField name="age" label="Turning" min={0} max={149} defaultValue={item?.age ?? ""} />
      </FormRow>
      <TextField name="title" label="Party name" defaultValue={item?.title} placeholder="Leave blank for “Jack's 8th birthday”" />
      <TextField name="theme" label="Theme" defaultValue={item?.theme ?? ""} placeholder="Dinosaurs, under the sea, glow party…" />
      <FormRow cols={3}>
        <DateField name="date" label="Date" defaultValue={item?.date ?? ""} />
        <TextField name="startTime" type="time" label="Starts" defaultValue={item?.startTime?.slice(0, 5) ?? ""} />
        <TextField name="endTime" type="time" label="Ends" defaultValue={item?.endTime?.slice(0, 5) ?? ""} />
      </FormRow>
      <FormRow>
        <TextField name="venue" label="Where" defaultValue={item?.venue ?? ""} placeholder="Home, the park, a trampoline park…" />
        <TextField name="address" label="Address" defaultValue={item?.address ?? ""} />
      </FormRow>
      <FormRow>
        <DateField name="rsvpBy" label="RSVP by" defaultValue={item?.rsvpBy ?? ""} />
        <TextField name="budget" label="Budget ($)" inputMode="decimal" defaultValue={money(item?.budgetCents)} />
      </FormRow>
      <TextAreaField name="description" label="Notes" rows={3} defaultValue={item?.description ?? ""} placeholder="Ideas, what to tell guests, allergies to plan around…" />
      {!item && <CheckboxField name="checklist" label="Start with a party checklist" description="Invitations, cake, decorations, RSVPs and more, with due dates counted back from the party." defaultChecked />}
      <ImageField currentUrl={item?.imageUrl} label="Invitation or cover photo" />
      <VisibilityField members={members} defaultValue={item?.visibility ?? "family"} defaultSelected={item?.shared ?? []} privateHint="Only you will see this party. Handy for a surprise!" />
    </FormModal>
  );
}

export type GuestDefaults = { id: string; name: string; contact: string | null; adults: number; kids: number; rsvp: string; gift: string | null; thankYouSent: boolean; notes: string | null };

export const RSVP_OPTIONS = [
  { value: "not_sent", label: "Not invited yet" },
  { value: "invited", label: "Invited, waiting to hear" },
  { value: "yes", label: "Coming" },
  { value: "maybe", label: "Maybe" },
  { value: "no", label: "Can't come" },
];

export function GuestModal({ partyId, item, triggerContent, triggerClassName }: { partyId: string; item?: GuestDefaults; triggerContent?: ReactNode; triggerClassName?: string }) {
  return (
    <FormModal title={item ? "Edit guest" : "Add guests"} triggerLabel="Add guests" triggerVariant="secondary" triggerSize="sm" triggerContent={triggerContent} triggerClassName={triggerClassName} action={savePartyGuest} submitLabel={item ? "Save" : "Add"}>
      <input type="hidden" name="partyId" value={partyId} />
      {item && <input type="hidden" name="id" value={item.id} />}
      {item ? (
        <TextField name="name" label="Name" required defaultValue={item.name} />
      ) : (
        <TextAreaField name="name" label="Names" required rows={3} placeholder={"The Smith family\nEmma\nLiam"} hint="One per line (or separated by commas) to add several at once." />
      )}
      <TextField name="contact" label="Phone or email" defaultValue={item?.contact ?? ""} />
      <FormRow cols={3}>
        <NumberField name="adults" label="Adults" min={0} defaultValue={item?.adults ?? 1} />
        <NumberField name="kids" label="Kids" min={0} defaultValue={item?.kids ?? 0} />
        <SelectField name="rsvp" label="RSVP" defaultValue={item?.rsvp ?? "invited"} options={RSVP_OPTIONS} />
      </FormRow>
      <TextField name="gift" label="Gift they brought" defaultValue={item?.gift ?? ""} placeholder="For thank-you notes" />
      {item && <CheckboxField name="thankYouSent" label="Thank-you note sent" defaultChecked={item.thankYouSent} />}
      <TextAreaField name="notes" label="Notes" rows={2} defaultValue={item?.notes ?? ""} placeholder="Allergies, siblings coming, needs a ride…" />
    </FormModal>
  );
}

export type PartyItemDefaults = { id: string; kind: string; title: string; date: string | null; time: string | null; quantity: string | null; costCents: number | null; assignedMemberId: string | null; notes: string | null; done: boolean };

const ITEM_COPY: Record<string, { add: string; title: string; placeholder: string }> = {
  todo: { add: "Add to-do", title: "To-do", placeholder: "Order the cake" },
  food: { add: "Add food", title: "Food or drink", placeholder: "Pizza, cupcakes, juice boxes" },
  decor: { add: "Add decoration", title: "Decoration", placeholder: "Balloon arch, banner" },
  supply: { add: "Add supply", title: "Supply or favor", placeholder: "Plates, candles, goodie bags" },
  activity: { add: "Add activity", title: "Game or activity", placeholder: "Piñata, scavenger hunt" },
  schedule: { add: "Add to schedule", title: "What happens", placeholder: "Guests arrive, cake & candles, open presents" },
  expense: { add: "Add expense", title: "What you paid for", placeholder: "Venue deposit" },
};

export function PartyItemModal({ partyId, kind, members, item, triggerContent, triggerClassName }: { partyId: string; kind: string; members: MemberOption[]; item?: PartyItemDefaults; triggerContent?: ReactNode; triggerClassName?: string }) {
  const k = item?.kind ?? kind;
  const copy = ITEM_COPY[k] ?? ITEM_COPY.todo!;
  const buyable = k === "food" || k === "decor" || k === "supply";
  return (
    <FormModal title={item ? `Edit ${copy.title.toLowerCase()}` : copy.add} triggerLabel={copy.add} triggerVariant="secondary" triggerSize="sm" triggerContent={triggerContent} triggerClassName={triggerClassName} action={savePartyItem} submitLabel={item ? "Save" : "Add"} size="sm">
      <input type="hidden" name="partyId" value={partyId} />
      <input type="hidden" name="kind" value={k} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <TextField name="title" label={copy.title} required defaultValue={item?.title} placeholder={copy.placeholder} />
      {k === "schedule" ? (
        <TextField name="time" type="time" label="Time" defaultValue={item?.time?.slice(0, 5) ?? ""} />
      ) : k === "todo" ? (
        <FormRow>
          <DateField name="date" label="Due" defaultValue={item?.date ?? ""} />
          <SelectField name="assignedMemberId" label="Who's doing it" defaultValue={item?.assignedMemberId ?? ""} placeholder="Anyone" options={members.map((m) => ({ value: m.id, label: m.displayName }))} />
        </FormRow>
      ) : buyable ? (
        <FormRow>
          <TextField name="quantity" label="How many" defaultValue={item?.quantity ?? ""} placeholder="3 large, 24…" />
          <TextField name="cost" label="Cost ($)" inputMode="decimal" defaultValue={money(item?.costCents)} />
        </FormRow>
      ) : k === "expense" ? (
        <FormRow>
          <TextField name="cost" label="Amount ($)" inputMode="decimal" required defaultValue={money(item?.costCents)} />
          <DateField name="date" label="Paid on" defaultValue={item?.date ?? ""} />
        </FormRow>
      ) : (
        <SelectField name="assignedMemberId" label="Who's running it" defaultValue={item?.assignedMemberId ?? ""} placeholder="Anyone" options={members.map((m) => ({ value: m.id, label: m.displayName }))} />
      )}
      {buyable && item && <CheckboxField name="done" label="Bought / ready" defaultChecked={item.done} />}
      {buyable && !item && <input type="hidden" name="done" value="" />}
      <TextAreaField name="notes" label="Notes" rows={2} defaultValue={item?.notes ?? ""} />
    </FormModal>
  );
}
