"use client";

import type { ReactNode } from "react";
import { saveFoodEntry } from "@/app/actions/food-journal";
import { FormModal } from "@/components/forms/action-form";
import { ChipSelect, DateField, FormRow, ImageField, SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { FOOD_FEELINGS, FOOD_MEALS, FULLNESS_LEVELS, HUNGER_LEVELS } from "@/lib/food-journal";

export type FoodEntryDefaults = { id: string; date: string; time: string | null; meal: string | null; food: string; portion: string | null; hunger: number | null; fullness: number | null; feelings: string[]; notes: string | null; imageUrl: string | null };

/** Quick food logging: meal + what you had is enough; everything else is optional. */
export function FoodEntryModal({ memberId, date, defaults, triggerLabel = "Add entry", triggerContent, defaultMeal }: { memberId: string; date: string; defaults?: FoodEntryDefaults; triggerLabel?: string; triggerContent?: ReactNode; defaultMeal?: string }) {
  const now = new Date();
  const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return (
    <FormModal title={defaults ? "Edit entry" : "Add to my food journal"} triggerLabel={triggerLabel} triggerContent={triggerContent} action={saveFoodEntry} submitLabel={defaults ? "Save" : "Add"}>
      <input type="hidden" name="memberId" value={memberId} />
      {defaults && <input type="hidden" name="id" value={defaults.id} />}
      <FormRow cols={3}>
        <SelectField name="meal" label="Meal" defaultValue={defaults?.meal ?? defaultMeal ?? "lunch"} options={FOOD_MEALS.map((m) => ({ value: m.key, label: m.label }))} />
        <DateField name="date" label="Date" defaultValue={defaults?.date ?? date} />
        <TextField name="time" label="Time" type="time" defaultValue={defaults?.time ?? nowTime} />
      </FormRow>
      <TextField name="food" label="Food or drink" required defaultValue={defaults?.food} placeholder="Turkey sandwich & an apple" />
      <TextField name="portion" label="Portion / serving (optional)" defaultValue={defaults?.portion ?? ""} placeholder="1 sandwich, 1 cup" />
      <FormRow>
        <SelectField name="hunger" label="Hunger before (optional)" defaultValue={defaults?.hunger ? String(defaults.hunger) : ""} placeholder="—" options={HUNGER_LEVELS.map((l, i) => ({ value: String(i + 1), label: l }))} />
        <SelectField name="fullness" label="Fullness after (optional)" defaultValue={defaults?.fullness ? String(defaults.fullness) : ""} placeholder="—" options={FULLNESS_LEVELS.map((l, i) => ({ value: String(i + 1), label: l }))} />
      </FormRow>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-soft">How did you feel? (optional)</legend>
        <ChipSelect name="feelings" options={[...new Set([...FOOD_FEELINGS, ...(defaults?.feelings ?? [])])].map((x) => ({ value: x, label: x }))} defaultValue={defaults?.feelings ?? []} />
      </fieldset>
      <TextAreaField name="notes" label="Notes (optional)" rows={2} defaultValue={defaults?.notes ?? ""} />
      <ImageField label="Photo (optional)" currentUrl={defaults?.imageUrl} />
    </FormModal>
  );
}
