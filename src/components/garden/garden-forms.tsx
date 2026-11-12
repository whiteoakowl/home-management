"use client";

import { useState, type ReactNode } from "react";
import { createGardenPlan, logGarden, savePlant, saveSeed, updatePlanting } from "@/app/actions/garden";
import { FormModal } from "@/components/forms/action-form";
import { CheckboxField, DateField, FormRow, ImageField, NumberField, SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { LOCATION_OPTIONS } from "@/components/kitchen/inventory-form";

type PlantOpt = { id: string; name: string; variety: string | null };
type PlantingOpt = { id: string; label: string };

export function NewGardenPlanModal({ defaultOpen, year }: { defaultOpen?: boolean; year: number }) {
  return (
    <FormModal title="New garden plan" triggerLabel="New plan" action={createGardenPlan} submitLabel="Create & open" size="sm" defaultOpen={defaultOpen}>
      <TextField name="name" label="Name" required defaultValue={`${year + 1} Garden Plan`} />
      <FormRow cols={3}>
        <NumberField name="year" label="Year" defaultValue={year + 1} />
        <NumberField name="width" label="Width (ft)" defaultValue={40} min={5} />
        <NumberField name="height" label="Depth (ft)" defaultValue={30} min={5} />
      </FormRow>
      <TextAreaField name="notes" label="Notes (soil tests, goals…)" rows={2} />
    </FormModal>
  );
}

export function LogGardenModal({ plantings, plants, canKitchen, defaultKind = "harvest", triggerLabel = "Log activity" }: { plantings: PlantingOpt[]; plants: PlantOpt[]; canKitchen: boolean; defaultKind?: string; triggerLabel?: string }) {
  const [kind, setKind] = useState(defaultKind);
  return (
    <FormModal title="Log garden activity" triggerLabel={triggerLabel} action={logGarden} submitLabel="Save to log">
      <FormRow>
        <SelectField
          name="kind"
          label="What happened"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          options={[
            { value: "harvest", label: "Harvest" },
            { value: "sown", label: "Planted / sown" },
            { value: "germinated", label: "Germinated" },
            { value: "transplanted", label: "Transplanted" },
            { value: "watered", label: "Watered" },
            { value: "fertilized", label: "Fertilized" },
            { value: "pest", label: "Pest problem" },
            { value: "disease", label: "Disease" },
            { value: "seed_saved", label: "Seeds collected" },
            { value: "note", label: "Note" },
          ]}
        />
        <DateField name="date" label="Date" />
      </FormRow>
      {plantings.length > 0 ? (
        <SelectField name="plantingId" label="Planting" placeholder="Choose a planting…" options={plantings.map((p) => ({ value: p.id, label: p.label }))} />
      ) : null}
      <SelectField name="plantId" label={plantings.length ? "…or any plant" : "Plant"} placeholder="—" options={plants.map((p) => ({ value: p.id, label: p.variety ? `${p.name} (${p.variety})` : p.name }))} />
      {kind === "harvest" && (
        <>
          <FormRow>
            <NumberField name="quantity" label="Amount" min={0} required />
            <TextField name="unit" label="Unit" placeholder="lb, each, bunch…" defaultValue="lb" />
          </FormRow>
          {canKitchen && (
            <>
              <CheckboxField name="addToKitchen" label="Add to kitchen inventory" defaultChecked />
              <SelectField name="location" label="Store in" defaultValue="fridge" options={LOCATION_OPTIONS} />
            </>
          )}
        </>
      )}
      {kind === "seed_saved" && (
        <FormRow>
          <NumberField name="quantity" label="Amount" min={0} />
          <TextField name="unit" label="Unit" placeholder="seeds, packets…" />
        </FormRow>
      )}
      <TextAreaField name="notes" label="Notes" rows={2} />
      <ImageField label="Photo" />
    </FormModal>
  );
}

export function PlantingModal({
  planting,
  triggerContent,
}: {
  planting: { id: string; status: string; plantedOn: string | null; expectedHarvestOn: string | null; quantity: number; notes: string | null };
  triggerContent: ReactNode;
}) {
  return (
    <FormModal title="Update planting" action={updatePlanting} size="sm" triggerContent={triggerContent} triggerClassName="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-sm font-medium text-ink-soft hover:bg-sunken">
      <input type="hidden" name="id" value={planting.id} />
      <FormRow>
        <SelectField
          name="status"
          label="Status"
          defaultValue={planting.status}
          options={["planned", "sown", "growing", "harvesting", "finished", "failed"].map((s) => ({ value: s, label: s[0]!.toUpperCase() + s.slice(1) }))}
        />
        <NumberField name="quantity" label="Plants" min={1} defaultValue={planting.quantity} />
        <DateField name="plantedOn" label="Planted on" defaultValue={planting.plantedOn ?? ""} />
        <DateField name="expectedHarvestOn" label="Expected harvest" defaultValue={planting.expectedHarvestOn ?? ""} hint="Leave blank to calculate from days to maturity." />
      </FormRow>
      <TextAreaField name="notes" label="Notes" rows={2} defaultValue={planting.notes ?? ""} />
    </FormModal>
  );
}

export type PlantDefaults = Partial<Record<string, string | number | null | string[]>> & { id?: string };

export function PlantFormModal({ defaults, triggerLabel = "Add plant", triggerContent, title, defaultOpen }: { defaults?: PlantDefaults; triggerLabel?: string; triggerContent?: ReactNode; title?: string; defaultOpen?: boolean }) {
  const d = (k: string) => {
    const v = defaults?.[k];
    return Array.isArray(v) ? v.join(", ") : (v ?? "");
  };
  return (
    <FormModal title={title ?? (defaults?.id ? "Edit plant" : "Add a plant")} triggerLabel={triggerLabel} triggerContent={triggerContent} triggerClassName="inline-flex h-11 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-4 text-[15px] font-medium hover:bg-sunken" action={savePlant} submitLabel="Save plant" size="lg" defaultOpen={defaultOpen}>
      {defaults?.id && <input type="hidden" name="id" value={defaults.id} />}
      {typeof defaults?.imageUrl === "string" && defaults.imageUrl.startsWith("emoji:") && !defaults.id && <input type="hidden" name="emojiImage" value={defaults.imageUrl} />}
      <FormRow>
        <TextField name="name" label="Plant" required defaultValue={d("name") as string} />
        <TextField name="variety" label="Variety" defaultValue={d("variety") as string} />
        <SelectField name="category" label="Category" defaultValue={(d("category") as string) || "Vegetable"} options={["Vegetable", "Herb", "Fruit", "Flower", "Tree", "Other"].map((c) => ({ value: c, label: c }))} />
        <SelectField
          name="sun"
          label="Sun"
          defaultValue={(d("sun") as string) || "full_sun"}
          options={[
            { value: "full_sun", label: "Full sun" },
            { value: "partial_sun", label: "Partial sun" },
            { value: "partial_shade", label: "Partial shade" },
            { value: "full_shade", label: "Full shade" },
          ]}
        />
      </FormRow>
      <ImageField label="Photo" currentUrl={(defaults?.photoUrl as string) ?? null} />
      <FormRow cols={3}>
        <NumberField name="spacingIn" label="Spacing (in)" defaultValue={d("spacingIn") as string} />
        <NumberField name="plantingDepthIn" label="Depth (in)" defaultValue={d("plantingDepthIn") as string} />
        <TextField name="growingZones" label="Zones" defaultValue={d("growingZones") as string} placeholder="3–9" />
        <TextField name="germinationDays" label="Germination" defaultValue={d("germinationDays") as string} placeholder="7–10 days" />
        <TextField name="daysToMaturity" label="Days to maturity" defaultValue={d("daysToMaturity") as string} placeholder="70 days" />
      </FormRow>
      <FormRow>
        <TextField name="soil" label="Soil" defaultValue={d("soil") as string} />
        <TextField name="water" label="Water" defaultValue={d("water") as string} />
        <TextField name="plantingWindow" label="When to plant" defaultValue={d("plantingWindow") as string} />
        <TextField name="harvestWindow" label="When to harvest" defaultValue={d("harvestWindow") as string} />
        <TextField name="companionPlants" label="Companion plants" defaultValue={d("companionPlants") as string} hint="Comma separated" />
        <TextField name="avoidPlants" label="Plants to avoid" defaultValue={d("avoidPlants") as string} hint="Comma separated" />
        <TextField name="soilAmendments" label="Soil amendments" defaultValue={d("soilAmendments") as string} />
        <TextField name="fertilizer" label="Fertilizer" defaultValue={d("fertilizer") as string} />
      </FormRow>
      <TextField name="seedInfo" label="Seed information" defaultValue={d("seedInfo") as string} placeholder="Seed source, saving tips…" />
      <TextAreaField name="notes" label="Notes" rows={2} defaultValue={d("notes") as string} />
    </FormModal>
  );
}

export function SeedFormModal({ plants, seed, triggerContent }: { plants: PlantOpt[]; seed?: { id: string; name: string; plantId: string | null; quantity: string | null; source: string | null; packedFor: string | null; purchasedOn: string | null; notes: string | null }; triggerContent?: ReactNode }) {
  return (
    <FormModal title={seed ? "Edit seeds" : "Add seeds"} triggerLabel="Add seeds" action={saveSeed} triggerContent={triggerContent} triggerClassName="size-9 rounded-full text-muted hover:bg-sunken">
      {seed && <input type="hidden" name="id" value={seed.id} />}
      <TextField name="name" label="Seeds" required defaultValue={seed?.name} placeholder="Sungold tomato" />
      <FormRow>
        <SelectField name="plantId" label="Plant" defaultValue={seed?.plantId ?? ""} placeholder="—" options={plants.map((p) => ({ value: p.id, label: p.variety ? `${p.name} (${p.variety})` : p.name }))} />
        <TextField name="quantity" label="Quantity" defaultValue={seed?.quantity ?? ""} placeholder="1 packet, ~50 seeds" />
        <TextField name="source" label="Source" defaultValue={seed?.source ?? ""} placeholder="Baker Creek, saved…" />
        <TextField name="packedFor" label="Packed for (year)" defaultValue={seed?.packedFor ?? ""} />
        <DateField name="purchasedOn" label="Acquired" defaultValue={seed?.purchasedOn ?? ""} />
      </FormRow>
      <TextAreaField name="notes" label="Notes" rows={2} defaultValue={seed?.notes ?? ""} />
    </FormModal>
  );
}
