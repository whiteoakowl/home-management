"use client";

import { useState, type ReactNode } from "react";
import { createFarmPlan, logFeed, logProduction, saveAnimal, saveHealthRecord } from "@/app/actions/farm";
import { FormModal } from "@/components/forms/action-form";
import { CheckboxField, DateField, FormRow, ImageField, NumberField, SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { LOCATION_OPTIONS } from "@/components/kitchen/inventory-form";

type AnimalOpt = { id: string; name: string; species: string };
export const SPECIES = ["Chicken", "Duck", "Goat", "Cow", "Sheep", "Pig", "Rabbit", "Bee", "Horse", "Turkey", "Dog", "Cat", "Other"];

export type AnimalDefaults = {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  sex: string;
  groupName: string | null;
  headCount: number;
  birthDate: string | null;
  acquiredOn: string | null;
  feed: string | null;
  status: string;
  notes: string | null;
  imageUrl: string | null;
};

export function AnimalFormModal({ defaults, defaultOpen, triggerContent }: { defaults?: AnimalDefaults; defaultOpen?: boolean; triggerContent?: ReactNode }) {
  return (
    <FormModal
      title={defaults ? "Edit animal" : "Add an animal"}
      triggerLabel="Add animal"
      action={saveAnimal}
      submitLabel={defaults ? "Save" : "Add animal"}
      defaultOpen={defaultOpen}
      triggerContent={triggerContent}
      triggerClassName="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-sunken"
    >
      {defaults && <input type="hidden" name="id" value={defaults.id} />}
      <FormRow>
        <TextField name="name" label="Name" required defaultValue={defaults?.name} placeholder="Henrietta, or “Layer flock”" />
        <SelectField name="species" label="Type" defaultValue={defaults?.species ?? "Chicken"} options={SPECIES.map((s) => ({ value: s, label: s }))} />
        <TextField name="breed" label="Breed" defaultValue={defaults?.breed ?? ""} placeholder="Buff Orpington" />
        <SelectField name="sex" label="Sex" defaultValue={defaults?.sex ?? "unknown"} options={[{ value: "female", label: "Female" }, { value: "male", label: "Male" }, { value: "unknown", label: "Unknown / mixed" }]} />
        <NumberField name="headCount" label="How many" min={1} defaultValue={defaults?.headCount ?? 1} hint="Track a whole flock or hive as one record." />
        <TextField name="groupName" label="Group" defaultValue={defaults?.groupName ?? ""} placeholder="Layer flock, Dairy herd…" />
        <DateField name="birthDate" label="Born" defaultValue={defaults?.birthDate ?? ""} />
        <DateField name="acquiredOn" label="Acquired" defaultValue={defaults?.acquiredOn ?? ""} />
      </FormRow>
      <ImageField currentUrl={defaults?.imageUrl} />
      <FormRow>
        <TextField name="feed" label="Feed" defaultValue={defaults?.feed ?? ""} placeholder="16% layer pellets" />
        {defaults && <SelectField name="status" label="Status" defaultValue={defaults.status} options={[{ value: "active", label: "Active" }, { value: "sold", label: "Sold" }, { value: "deceased", label: "Deceased" }, { value: "processed", label: "Processed" }]} />}
      </FormRow>
      <TextAreaField name="notes" label="Notes" rows={2} defaultValue={defaults?.notes ?? ""} />
    </FormModal>
  );
}

export function HealthRecordModal({ animalId }: { animalId: string }) {
  return (
    <FormModal title="Add health record" triggerLabel="Health record" triggerVariant="secondary" triggerSize="sm" action={saveHealthRecord} size="sm">
      <input type="hidden" name="animalId" value={animalId} />
      <FormRow>
        <SelectField name="kind" label="Type" defaultValue="Vaccination" options={["Vaccination", "Deworming", "Vet visit", "Treatment", "Hoof trim", "Weight check", "Injury", "Other"].map((k) => ({ value: k, label: k }))} />
        <DateField name="date" label="Date" />
        <DateField name="nextDueOn" label="Next due" hint="Creates a reminder." />
        <NumberField name="cost" label="Cost ($)" min={0} />
      </FormRow>
      <TextAreaField name="description" label="Details" rows={2} />
    </FormModal>
  );
}

export function FeedModal({ animals }: { animals: AnimalOpt[] }) {
  return (
    <FormModal title="Log feed" triggerLabel="Log feed" triggerVariant="secondary" action={logFeed} size="sm">
      <FormRow>
        <TextField name="feed" label="Feed" required placeholder="Layer pellets" />
        <DateField name="date" label="Date" />
        <NumberField name="quantity" label="Amount" min={0} required />
        <TextField name="unit" label="Unit" defaultValue="lb" />
        <SelectField name="animalId" label="For" placeholder="Whole farm" options={animals.map((a) => ({ value: a.id, label: `${a.name} (${a.species})` }))} />
        <NumberField name="cost" label="Cost ($)" min={0} />
      </FormRow>
    </FormModal>
  );
}

export function ProductionModal({ animals, canKitchen, defaultKind = "eggs", triggerLabel = "Record production", defaultAnimal }: { animals: AnimalOpt[]; canKitchen: boolean; defaultKind?: string; triggerLabel?: string; defaultAnimal?: string }) {
  const [kind, setKind] = useState(defaultKind);
  const unit = { eggs: "each", milk: "gal", honey: "lb", meat: "lb", wool: "lb", produce: "lb", other: "" }[kind] ?? "";
  return (
    <FormModal title="Record production" triggerLabel={triggerLabel} action={logProduction} size="sm">
      <FormRow>
        <SelectField
          name="kind"
          label="Product"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          options={[
            { value: "eggs", label: "Eggs" },
            { value: "milk", label: "Milk" },
            { value: "honey", label: "Honey" },
            { value: "meat", label: "Meat" },
            { value: "wool", label: "Wool / fiber" },
            { value: "produce", label: "Produce" },
            { value: "other", label: "Other" },
          ]}
        />
        <DateField name="date" label="Date" />
        <NumberField name="quantity" label="Amount" min={0} required />
        <TextField key={kind} name="unit" label="Unit" defaultValue={unit} />
      </FormRow>
      <SelectField name="animalId" label="From" defaultValue={defaultAnimal ?? ""} placeholder="Whole flock / herd" options={animals.map((a) => ({ value: a.id, label: `${a.name} (${a.species})` }))} />
      {canKitchen && kind !== "wool" && (
        <>
          <CheckboxField name="addToKitchen" label="Add to kitchen inventory" defaultChecked />
          <SelectField name="location" label="Store in" defaultValue={kind === "honey" ? "pantry" : "fridge"} options={LOCATION_OPTIONS} />
        </>
      )}
      <TextAreaField name="notes" label="Notes" rows={2} />
    </FormModal>
  );
}

export function NewFarmPlanModal() {
  return (
    <FormModal title="New farm map" triggerLabel="New farm map" triggerVariant="secondary" action={createFarmPlan} submitLabel="Create & open" size="sm">
      <TextField name="name" label="Name" required defaultValue="Our farm" />
      <FormRow>
        <NumberField name="width" label="Width (ft)" defaultValue={300} min={20} />
        <NumberField name="height" label="Depth (ft)" defaultValue={200} min={20} />
      </FormRow>
    </FormModal>
  );
}
