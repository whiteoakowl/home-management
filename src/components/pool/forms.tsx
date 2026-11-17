"use client";

import type { ReactNode } from "react";
import { FlaskConical, Pencil, Plus, Wrench } from "lucide-react";
import { saveAddition, saveEquipment, savePool, saveTest } from "@/app/actions/pool";
import { FormModal } from "@/components/forms/action-form";
import { CheckboxField, DateField, FormRow, ImageField, NumberField, SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { CHLORINE_PRODUCTS, READING_META, type ReadingKey } from "@/lib/pool";

export type PoolDefaults = { id: string; name: string; kind: string; gallons: number; sanitizer: string; surface: string; chlorineProduct: string; saltTarget: number | null; filterType: string | null; isOpen: boolean; notes: string | null };

export function PoolModal({ pool, defaultOpen, trigger }: { pool?: PoolDefaults; defaultOpen?: boolean; trigger?: "add" | "edit" }) {
  return (
    <FormModal
      title={pool ? `Edit ${pool.name}` : "Add a pool or spa"}
      triggerLabel={pool ? "Settings" : "Add pool or spa"}
      triggerVariant={trigger === "edit" || pool ? "secondary" : "primary"}
      triggerIcon={pool ? <Pencil className="size-4" /> : <Plus className="size-4" />}
      action={savePool}
      submitLabel={pool ? "Save" : "Add"}
      defaultOpen={defaultOpen}
    >
      {pool && <input type="hidden" name="id" value={pool.id} />}
      <TextField name="name" label="Name" required defaultValue={pool?.name} placeholder="Backyard pool" />
      <FormRow>
        <SelectField name="kind" label="Type" defaultValue={pool?.kind ?? "pool"} options={[{ value: "pool", label: "Pool" }, { value: "spa", label: "Spa / hot tub" }]} />
        <NumberField name="gallons" label="Volume (gallons)" required min={50} defaultValue={pool?.gallons ?? ""} hint="Rectangle: L × W × avg depth (ft) × 7.5" />
      </FormRow>
      <FormRow>
        <SelectField name="sanitizer" label="Sanitizer" defaultValue={pool?.sanitizer ?? "chlorine"} options={[{ value: "chlorine", label: "Chlorine" }, { value: "salt", label: "Saltwater (chlorine generator)" }, { value: "bromine", label: "Bromine" }]} />
        <SelectField name="surface" label="Surface" defaultValue={pool?.surface ?? "plaster"} options={[{ value: "plaster", label: "Plaster / pebble / concrete" }, { value: "vinyl", label: "Vinyl liner" }, { value: "fiberglass", label: "Fiberglass / acrylic" }]} />
      </FormRow>
      <FormRow>
        <SelectField name="chlorineProduct" label="Chlorine you use" defaultValue={pool?.chlorineProduct ?? "liquid10"} options={Object.entries(CHLORINE_PRODUCTS).map(([value, p]) => ({ value, label: p.label }))} hint="Doses are worked out for this product." />
        <NumberField name="saltTarget" label="Salt target (ppm)" min={0} defaultValue={pool?.saltTarget ?? ""} placeholder="3200" hint="Saltwater only: from your cell's manual." />
      </FormRow>
      <FormRow>
        <TextField name="filterType" label="Filter" defaultValue={pool?.filterType ?? ""} placeholder="Cartridge, sand or DE" />
        <SelectField name="isOpen" label="Season" defaultValue={pool?.isOpen === false ? "closed" : "open"} options={[{ value: "open", label: "Open" }, { value: "closed", label: "Closed for the season" }]} />
      </FormRow>
      <TextAreaField name="notes" label="Notes" rows={2} defaultValue={pool?.notes ?? ""} />
    </FormModal>
  );
}

/** Readings shown for this pool's sanitizer (bromine: no CC/CYA; salt only for saltwater). */
function readingKeys(sanitizer: string): ReadingKey[] {
  const keys: ReadingKey[] = ["fc", "cc", "ph", "ta", "ch", "cya", "salt", "tempF", "phosphates"];
  return keys.filter((k) => (k === "salt" ? sanitizer === "salt" : sanitizer === "bromine" ? k !== "cc" && k !== "cya" : true));
}

export type TestDefaults = Partial<Record<ReadingKey, number | null>> & { id: string; date: string; notes: string | null };

export function TestModal({ poolId, sanitizer, today, test, defaultOpen, triggerContent }: { poolId: string; sanitizer: string; today: string; test?: TestDefaults; defaultOpen?: boolean; triggerContent?: ReactNode }) {
  const keys = readingKeys(sanitizer);
  return (
    <FormModal
      title={test ? "Edit water test" : "Log a water test"}
      triggerLabel="Log test"
      triggerIcon={<FlaskConical className="size-4" />}
      triggerContent={triggerContent}
      triggerAriaLabel={test ? "Edit test" : undefined}
      triggerClassName="size-9 rounded-full text-muted hover:bg-sunken"
      action={saveTest}
      submitLabel="Save test"
      defaultOpen={defaultOpen}
      description="Fill in what you tested. Leave the rest blank."
    >
      <input type="hidden" name="poolId" value={poolId} />
      {test && <input type="hidden" name="id" value={test.id} />}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {keys.map((k) => {
          const m = READING_META[k];
          const label = k === "fc" && sanitizer === "bromine" ? "Bromine (ppm)" : `${m.short}${m.unit ? ` (${m.unit})` : ""}`;
          return <NumberField key={k} name={k} label={label} step="any" inputMode="decimal" min={0} defaultValue={test?.[k] ?? ""} title={m.label} />;
        })}
      </div>
      <FormRow>
        <DateField name="date" label="Date" defaultValue={test?.date ?? today} />
        <TextField name="time" label="Time (optional)" type="time" />
      </FormRow>
      <ImageField name="photo" label="Photo of the strip or kit (optional)" />
      <TextAreaField name="notes" label="Notes" rows={2} defaultValue={test?.notes ?? ""} placeholder="Cloudy after the party, heavy rain…" />
    </FormModal>
  );
}

export const COMMON_CHEMICALS = [
  "Liquid chlorine",
  "Cal-hypo shock",
  "Dichlor",
  "Trichlor tablets",
  "Non-chlorine shock (MPS)",
  "Bromine tablets",
  "Muriatic acid",
  "Dry acid",
  "Soda ash",
  "Baking soda",
  "Calcium chloride",
  "Stabilizer (CYA)",
  "Pool salt",
  "Algaecide",
  "Clarifier",
  "Phosphate remover",
];

export function AdditionModal({ poolId, today, canBudget, defaults, label, triggerVariant = "secondary", triggerContent }: { poolId: string; today: string; canBudget: boolean; defaults?: { id?: string; chemical?: string; amount?: string | null; date?: string; cost?: number | null; notes?: string | null }; label?: string; triggerVariant?: "primary" | "secondary" | "soft" | "ghost"; triggerContent?: ReactNode }) {
  return (
    <FormModal
      title={defaults?.id ? "Edit chemical added" : "Log a chemical added"}
      triggerLabel={label ?? "Add chemical"}
      triggerVariant={triggerVariant}
      triggerSize={label ? "sm" : "md"}
      triggerIcon={<Plus className="size-4" />}
      triggerContent={triggerContent}
      triggerAriaLabel={defaults?.id ? "Edit" : undefined}
      triggerClassName="size-9 rounded-full text-muted hover:bg-sunken"
      action={saveAddition}
      submitLabel="Save"
      size="sm"
    >
      <input type="hidden" name="poolId" value={poolId} />
      {defaults?.id && <input type="hidden" name="id" value={defaults.id} />}
      <TextField name="chemical" label="Chemical" required defaultValue={defaults?.chemical ?? ""} list="pool-chemicals" placeholder="Liquid chlorine" />
      <datalist id="pool-chemicals">
        {COMMON_CHEMICALS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <FormRow>
        <TextField name="amount" label="Amount" defaultValue={defaults?.amount ?? ""} placeholder="64 fl oz" />
        <DateField name="date" label="Date" defaultValue={defaults?.date ?? today} />
      </FormRow>
      <NumberField name="cost" label="Cost ($, optional)" min={0} step="0.01" defaultValue={defaults?.cost ?? ""} />
      {canBudget && !defaults?.id && <CheckboxField name="addToBudget" label="Also record the cost in the family budget (Pool)" />}
      <TextField name="notes" label="Notes" defaultValue={defaults?.notes ?? ""} />
    </FormModal>
  );
}

export type EquipmentDefaults = { id: string; name: string; kind: string; model: string | null; installedOn: string | null; lastServicedOn: string | null; serviceEveryMonths: number | null; notes: string | null };

export function EquipmentModal({ poolId, item }: { poolId: string; item?: EquipmentDefaults }) {
  return (
    <FormModal
      title={item ? `Edit ${item.name}` : "Add equipment"}
      triggerLabel="Add"
      triggerVariant="ghost"
      triggerSize="sm"
      triggerIcon={<Wrench className="size-4" />}
      triggerContent={item ? <Pencil className="mx-auto size-4" /> : undefined}
      triggerAriaLabel={item ? `Edit ${item.name}` : undefined}
      triggerClassName="size-9 rounded-full text-muted hover:bg-sunken"
      action={saveEquipment}
      size="sm"
    >
      <input type="hidden" name="poolId" value={poolId} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <FormRow>
        <TextField name="name" label="Name" required defaultValue={item?.name} placeholder="Pump" />
        <SelectField name="kind" label="Type" defaultValue={item?.kind ?? "pump"} options={["pump", "filter", "heater", "salt cell", "cleaner", "chlorinator", "cover", "other"].map((k) => ({ value: k, label: k[0]!.toUpperCase() + k.slice(1) }))} />
      </FormRow>
      <TextField name="model" label="Brand / model" defaultValue={item?.model ?? ""} />
      <FormRow>
        <DateField name="installedOn" label="Installed" defaultValue={item?.installedOn ?? ""} />
        <DateField name="lastServicedOn" label="Last serviced" defaultValue={item?.lastServicedOn ?? ""} />
      </FormRow>
      <NumberField name="serviceEveryMonths" label="Service every (months)" min={1} defaultValue={item?.serviceEveryMonths ?? ""} hint="We'll flag it when it's due." />
      <TextField name="notes" label="Notes" defaultValue={item?.notes ?? ""} placeholder="Filter cartridge part #, warranty…" />
    </FormModal>
  );
}
