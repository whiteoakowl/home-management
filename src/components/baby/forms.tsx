"use client";

import { useEffect, useState, type ReactNode } from "react";
import { applySchedulePreset, saveBaby, saveBabyLog, saveBabyScheduleItem } from "@/app/actions/baby";
import { FormModal } from "@/components/forms/action-form";
import { CheckboxField, ChipSelect, DateField, FormRow, ImageField, NumberField, SelectField, TextAreaField, TextField, type MemberOption } from "@/components/forms/fields";
import { BABY_KINDS, SCHEDULE_KINDS, SCHEDULE_PRESETS, type BabyLogKind } from "@/lib/baby-kinds";

export type BabyDefaults = { id: string; name: string; memberId: string | null; birthDate: string | null; volumeUnit: string; weightUnit: string; notes: string | null; imageUrl: string | null };

export function BabyModal({ members, item, defaultOpen, triggerContent, triggerClassName }: { members: MemberOption[]; item?: BabyDefaults; defaultOpen?: boolean; triggerContent?: ReactNode; triggerClassName?: string }) {
  return (
    <FormModal title={item ? "Edit baby" : "Add a baby"} triggerLabel="Add baby" triggerContent={triggerContent} triggerClassName={triggerClassName} action={saveBaby} submitLabel={item ? "Save" : "Start tracking"} defaultOpen={defaultOpen}>
      {item && <input type="hidden" name="id" value={item.id} />}
      <SelectField name="memberId" label="Family member" defaultValue={item?.memberId ?? ""} placeholder="Not in the family list yet" options={members.map((m) => ({ value: m.id, label: m.displayName }))} hint="Pick the baby from your family, or type a name below." />
      <FormRow>
        <TextField name="name" label="Name" defaultValue={item?.name ?? ""} placeholder="Baby's name" />
        <DateField name="birthDate" label="Birthday (or due date)" defaultValue={item?.birthDate ?? ""} />
      </FormRow>
      <FormRow>
        <SelectField name="volumeUnit" label="Bottles in" defaultValue={item?.volumeUnit ?? "oz"} options={[{ value: "oz", label: "Ounces (oz)" }, { value: "ml", label: "Millilitres (ml)" }]} />
        <SelectField name="weightUnit" label="Weight in" defaultValue={item?.weightUnit ?? "lb"} options={[{ value: "lb", label: "Pounds (lb)" }, { value: "kg", label: "Kilograms (kg)" }]} />
      </FormRow>
      <TextAreaField name="notes" label="Notes" rows={2} defaultValue={item?.notes ?? ""} placeholder="Pediatrician, allergies, formula brand…" />
      <ImageField currentUrl={item?.imageUrl} />
    </FormModal>
  );
}

export type LogDefaults = {
  id: string;
  kind: string;
  date: string;
  time: string;
  endTime: string | null;
  minutes: number | null;
  amount: string | null;
  data: Record<string, unknown>;
  notes: string | null;
  imageUrl: string | null;
};

const str = (v: unknown) => (v == null ? "" : String(v));

/** Log (or edit) anything for the baby. Fields change with the kind. */
export function BabyLogModal({
  babyId,
  kind,
  units,
  now,
  item,
  triggerContent,
  triggerClassName,
  triggerLabel,
  suggestedSide,
  defaultTitle,
}: {
  babyId: string;
  kind: BabyLogKind;
  units: { volume: string; weight: string };
  /** Family-local date and time to prefill. */
  now: { date: string; time: string };
  item?: LogDefaults;
  triggerContent?: ReactNode;
  triggerClassName?: string;
  triggerLabel?: string;
  suggestedSide?: string | null;
  defaultTitle?: string;
}) {
  const meta = BABY_KINDS[kind];
  const d = item?.data ?? {};
  const lengthUnit = units.weight === "kg" ? "cm" : "in";
  return (
    <FormModal
      title={item ? `Edit ${meta.label.toLowerCase()}` : meta.add}
      triggerLabel={triggerLabel ?? meta.add}
      triggerVariant="secondary"
      triggerContent={triggerContent}
      triggerClassName={triggerClassName}
      action={saveBabyLog}
      submitLabel={item ? "Save" : "Log it"}
      size="sm"
    >
      <input type="hidden" name="babyId" value={babyId} />
      <input type="hidden" name="kind" value={kind} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <FormRow>
        <DateField name="date" label="Date" defaultValue={item?.date ?? now.date} />
        <TextField name="time" type="time" label={meta.timer ? "Started" : "Time"} defaultValue={item?.time ?? now.time} />
      </FormRow>

      {kind === "nursing" && (
        <FormRow>
          <SelectField name="side" label="Side" defaultValue={str(d.side) || suggestedSide || "left"} options={[{ value: "left", label: "Left" }, { value: "right", label: "Right" }, { value: "both", label: "Both" }]} />
          <NumberField name="minutes" label="Minutes" min={0} defaultValue={item?.minutes ?? ""} />
        </FormRow>
      )}
      {kind === "tummy" && <NumberField name="minutes" label="Minutes" min={0} defaultValue={item?.minutes ?? ""} />}
      {kind === "sleep" && (
        <FormRow>
          <TextField name="endTime" type="time" label="Woke up" defaultValue={item?.endTime ?? ""} hint="Overnight is fine." />
          <SelectField name="where" label="Where" defaultValue={str(d.where)} placeholder="—" options={["crib", "bassinet", "bed", "arms", "car", "stroller", "other"].map((v) => ({ value: v, label: v[0]!.toUpperCase() + v.slice(1) }))} />
        </FormRow>
      )}
      {kind === "bottle" && (
        <FormRow>
          <NumberField name="amount" label={`Amount (${units.volume})`} min={0} step="0.5" defaultValue={item?.amount ?? ""} />
          <SelectField name="milk" label="What" defaultValue={str(d.milk) || "formula"} options={[{ value: "breast", label: "Breast milk" }, { value: "formula", label: "Formula" }, { value: "mixed", label: "Mixed" }, { value: "other", label: "Other (water, juice…)" }]} />
        </FormRow>
      )}
      {kind === "pump" && (
        <FormRow>
          <NumberField name="amount" label={`Total (${units.volume})`} min={0} step="0.5" defaultValue={item?.amount ?? ""} />
          <SelectField name="side" label="Side" defaultValue={str(d.side) || "both"} options={[{ value: "left", label: "Left" }, { value: "right", label: "Right" }, { value: "both", label: "Both" }]} />
        </FormRow>
      )}
      {kind === "solids" && (
        <>
          <TextField name="title" label="Food" defaultValue={str(d.title)} placeholder="Mashed banana, oatmeal…" />
          <FormRow>
            <TextField name="amount" label="How much" inputMode="decimal" defaultValue={item?.amount ?? ""} placeholder="Spoonfuls" />
            <SelectField name="reaction" label="Liked it?" defaultValue={str(d.reaction)} placeholder="—" options={[{ value: "loved", label: "😋 Loved it" }, { value: "ok", label: "🙂 It was OK" }, { value: "refused", label: "🙅 Refused" }]} />
          </FormRow>
          <CheckboxField name="firstTry" label="First time trying this food" defaultChecked={!!d.firstTry} />
          <CheckboxField name="allergy" label="Possible allergic reaction (rash, hives, vomiting)" defaultChecked={!!d.allergy} />
        </>
      )}
      {kind === "diaper" && (
        <>
          <ChipSelectSingle name="type" defaultValue={str(d.type) || "wet"} options={[{ value: "wet", label: "💧 Wet" }, { value: "dirty", label: "💩 Dirty" }, { value: "both", label: "Both" }, { value: "dry", label: "Dry" }]} />
          <SelectField name="color" label="Color (dirty)" defaultValue={str(d.color)} placeholder="—" options={["yellow", "green", "brown", "black", "red", "white", "other"].map((v) => ({ value: v, label: v[0]!.toUpperCase() + v.slice(1) }))} hint="Call the doctor about red, black (after the first days) or white stools." />
          <CheckboxField name="rash" label="Diaper rash" defaultChecked={!!d.rash} />
        </>
      )}
      {kind === "growth" && (
        <>
          <input type="hidden" name="lengthUnit" value={lengthUnit} />
          <FormRow cols={3}>
            <NumberField name="amount" label={`Weight (${units.weight})`} min={0} step="0.01" defaultValue={item?.amount ?? ""} />
            <NumberField name="height" label={`Length (${lengthUnit})`} min={0} step="0.1" defaultValue={str(d.height)} />
            <NumberField name="head" label={`Head (${lengthUnit})`} min={0} step="0.1" defaultValue={str(d.head)} />
          </FormRow>
        </>
      )}
      {kind === "temperature" && (
        <FormRow cols={3}>
          <NumberField name="amount" label="Temperature" step="0.1" defaultValue={item?.amount ?? ""} required />
          <SelectField name="tempUnit" label="Unit" defaultValue={str(d.unit) || "F"} options={[{ value: "F", label: "°F" }, { value: "C", label: "°C" }]} />
          <SelectField name="method" label="How" defaultValue={str(d.method)} placeholder="—" options={["forehead", "ear", "underarm", "rectal", "oral"].map((v) => ({ value: v, label: v[0]!.toUpperCase() + v.slice(1) }))} />
        </FormRow>
      )}
      {kind === "medicine" && (
        <FormRow>
          <TextField name="title" label="Medicine" required defaultValue={str(d.title)} placeholder="Infant Tylenol, vitamin D drops" />
          <TextField name="dose" label="Dose" defaultValue={str(d.dose)} placeholder="2.5 ml" />
        </FormRow>
      )}
      {kind === "symptom" && (
        <FormRow>
          <TextField name="title" label="Symptom" required defaultValue={str(d.title)} placeholder="Cough, fussy, spit up, rash" />
          <SelectField name="severity" label="How bad" defaultValue={str(d.severity)} placeholder="—" options={[{ value: "mild", label: "Mild" }, { value: "moderate", label: "Moderate" }, { value: "severe", label: "Severe" }]} />
        </FormRow>
      )}
      {kind === "vaccine" && <TextField name="title" label="Vaccine" required defaultValue={str(d.title)} placeholder="2-month shots: DTaP, Hib, IPV, PCV, RV, Hep B" />}
      {kind === "doctor" && <TextField name="title" label="Visit" defaultValue={str(d.title)} placeholder="4-month well visit, Dr. Patel" />}
      {kind === "teeth" && <TextField name="title" label="Which tooth" required defaultValue={str(d.title) || defaultTitle} placeholder="Bottom front (left)" />}
      {kind === "milestone" && <TextField name="title" label="Milestone" required defaultValue={str(d.title) || defaultTitle} placeholder="First smile" />}
      {kind === "activity" && <TextField name="title" label="Activity" required defaultValue={str(d.title)} placeholder="Story time, walk, baby class" />}

      <TextAreaField name="notes" label="Notes" rows={2} defaultValue={item?.notes ?? ""} required={kind === "note"} />
      {(kind === "milestone" || kind === "teeth" || kind === "note" || kind === "symptom" || kind === "solids") && <ImageField currentUrl={item?.imageUrl} />}
    </FormModal>
  );
}

/** Big tap targets for one choice (diaper type). */
function ChipSelectSingle({ name, options, defaultValue }: { name: string; options: { value: string; label: string }[]; defaultValue: string }) {
  return (
    <fieldset className="flex flex-wrap gap-2">
      <legend className="sr-only">Type</legend>
      {options.map((o) => (
        <label key={o.value} className="cursor-pointer">
          <input type="radio" name={name} value={o.value} defaultChecked={o.value === defaultValue} className="peer sr-only" />
          <span className="inline-flex h-11 items-center rounded-full border border-line-strong bg-surface px-4 text-[15px] peer-checked:border-primary-500 peer-checked:bg-primary-50 peer-checked:text-primary-700 peer-focus-visible:ring-4 peer-focus-visible:ring-primary-100">{o.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

export type ScheduleDefaults = { id: string; time: string; kind: string; title: string; minutes: number | null; days: number[]; notes: string | null };

const DAY_OPTS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((l, i) => ({ value: String(i), label: l }));

export function ScheduleItemModal({ babyId, item, triggerContent, triggerClassName }: { babyId: string; item?: ScheduleDefaults; triggerContent?: ReactNode; triggerClassName?: string }) {
  return (
    <FormModal title={item ? "Edit routine item" : "Add to the routine"} triggerLabel="Add to routine" triggerContent={triggerContent} triggerClassName={triggerClassName} action={saveBabyScheduleItem} submitLabel={item ? "Save" : "Add"} size="sm">
      <input type="hidden" name="babyId" value={babyId} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <FormRow>
        <TextField name="time" type="time" label="Time" required defaultValue={item?.time.slice(0, 5) ?? ""} />
        <SelectField name="kind" label="What" defaultValue={item?.kind ?? "feed"} options={SCHEDULE_KINDS.map((k) => ({ value: k.value, label: `${k.emoji} ${k.label}` }))} />
      </FormRow>
      <FormRow>
        <TextField name="title" label="Name (optional)" defaultValue={item?.title ?? ""} placeholder="Morning nap" />
        <NumberField name="minutes" label="Lasts (minutes)" min={0} defaultValue={item?.minutes ?? ""} />
      </FormRow>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink-soft">Days (none = every day)</span>
        <ChipSelect name="days" options={DAY_OPTS} defaultValue={(item?.days ?? []).map(String)} />
      </div>
      <TextAreaField name="notes" label="Notes" rows={2} defaultValue={item?.notes ?? ""} placeholder="White noise on, room dark, 4 oz" />
    </FormModal>
  );
}

export function SchedulePresetModal({ babyId, hasItems, suggested }: { babyId: string; hasItems: boolean; suggested?: string }) {
  return (
    <FormModal title="Start from a routine" triggerLabel="Use a sample routine" triggerVariant="secondary" action={applySchedulePreset} submitLabel="Add routine" size="sm">
      <input type="hidden" name="babyId" value={babyId} />
      <SelectField name="preset" label="Routine" defaultValue={suggested ?? "newborn"} options={Object.entries(SCHEDULE_PRESETS).map(([k, v]) => ({ value: k, label: v.label }))} />
      {hasItems && <CheckboxField name="replace" label="Replace the current routine" description="Otherwise these are added to what's there." defaultChecked />}
      <p className="text-sm text-muted">Every baby is different: these are common starting points. Change any time to fit yours.</p>
    </FormModal>
  );
}

/** A running timer that ticks every second. */
export function TimerClock({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  const secs = now === null ? 0 : Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return <span className="font-semibold tabular-nums">{now === null ? "…" : `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(s).padStart(2, "0")}`}</span>;
}

export type { MemberOption };
