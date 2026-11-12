"use client";

import type { ReactNode } from "react";
import { saveRecipe } from "@/app/actions/recipes";
import { FormModal } from "@/components/forms/action-form";
import { CheckboxField, ChipSelect, FormRow, ImageField, NumberField, SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { Field } from "@/components/ui/form";

export type RecipeDefaults = {
  id: string;
  name: string;
  description: string | null;
  ingredients: string;
  instructions: string;
  prepMinutes: number | null;
  cookMinutes: number | null;
  servings: number | null;
  categoryId: string | null;
  tags: string[];
  notes: string | null;
  source: string | null;
  isFavorite: boolean;
  imageUrl: string | null;
  collections: string[];
};

export function RecipeFormModal({
  categories,
  collections,
  defaults,
  defaultOpen,
  triggerContent,
}: {
  categories: { id: string; name: string }[];
  collections: { id: string; name: string }[];
  defaults?: RecipeDefaults;
  defaultOpen?: boolean;
  triggerContent?: ReactNode;
}) {
  return (
    <FormModal
      title={defaults ? "Edit recipe" : "New recipe"}
      triggerLabel="Add recipe"
      action={saveRecipe}
      submitLabel={defaults ? "Save recipe" : "Add recipe"}
      size="lg"
      defaultOpen={defaultOpen}
      triggerContent={triggerContent}
      triggerClassName="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-sunken"
    >
      {defaults && <input type="hidden" name="id" value={defaults.id} />}
      <TextField name="name" label="Recipe name" required defaultValue={defaults?.name} placeholder="Grandma's chicken parmesan" />
      <ImageField currentUrl={defaults?.imageUrl} />
      <TextAreaField name="description" label="Description" rows={2} defaultValue={defaults?.description ?? ""} />
      <FormRow cols={3}>
        <NumberField name="prepMinutes" label="Prep (min)" min={0} defaultValue={defaults?.prepMinutes ?? ""} />
        <NumberField name="cookMinutes" label="Cook (min)" min={0} defaultValue={defaults?.cookMinutes ?? ""} />
        <NumberField name="servings" label="Servings" min={1} defaultValue={defaults?.servings ?? ""} />
      </FormRow>
      <TextAreaField
        name="ingredients"
        label="Ingredients"
        rows={7}
        defaultValue={defaults?.ingredients ?? ""}
        placeholder={"2 eggs\n1 cup flour\n1 lb chicken breast\n2 tomatoes, diced"}
        hint="One per line. Amounts and units are detected automatically so we can check your pantry."
      />
      <TextAreaField name="instructions" label="Instructions" rows={7} defaultValue={defaults?.instructions ?? ""} placeholder={"Preheat oven to 400°F.\nBread the chicken…"} hint="One step per line." />
      <FormRow>
        {categories.length > 0 && <SelectField name="categoryId" label="Category" defaultValue={defaults?.categoryId ?? ""} placeholder="None" options={categories.map((c) => ({ value: c.id, label: c.name }))} />}
        <TextField name="tags" label="Tags" defaultValue={defaults?.tags.join(", ") ?? ""} placeholder="quick, kid-friendly, garden" hint="Comma separated" />
        <TextField name="source" label="Source" defaultValue={defaults?.source ?? ""} placeholder="Grandma / a website" />
      </FormRow>
      {collections.length > 0 && (
        <Field label="Collections">
          <ChipSelect name="collections" options={collections.map((c) => ({ value: c.id, label: c.name }))} defaultValue={defaults?.collections} />
        </Field>
      )}
      <TextAreaField name="notes" label="Notes" rows={2} defaultValue={defaults?.notes ?? ""} />
      <CheckboxField name="isFavorite" label="Family favorite" defaultChecked={defaults?.isFavorite} />
    </FormModal>
  );
}
