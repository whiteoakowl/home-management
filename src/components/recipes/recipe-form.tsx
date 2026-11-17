"use client";

import type { ReactNode } from "react";
import { saveRecipe } from "@/app/actions/recipes";
import { FormModal } from "@/components/forms/action-form";
import { CheckboxField, ChipSelect, FormRow, ImageField, NumberField, TextAreaField, TextField } from "@/components/forms/fields";
import { Field } from "@/components/ui/form";

export type RecipeDefaults = {
  id: string;
  name: string;
  description: string | null;
  ingredients: string;
  instructions: string;
  prepTime: string | null;
  cookTime: string | null;
  servings: number | null;
  temperature: string | null;
  recipeBy: string | null;
  makingSince: string | null;
  tags: string[];
  notes: string | null;
  source: string | null;
  isFavorite: boolean;
  imageUrl: string | null;
  collections: string[];
};

export function RecipeFormModal({
  collections,
  defaults,
  defaultOpen,
  triggerContent,
  privateSpace,
}: {
  collections: { id: string; name: string }[];
  defaults?: RecipeDefaults;
  defaultOpen?: boolean;
  triggerContent?: ReactNode;
  /** New recipe goes into My Recipes. */
  privateSpace?: boolean;
}) {
  return (
    <FormModal
      title={defaults ? "Edit recipe" : privateSpace ? "New private recipe" : "New family recipe"}
      triggerLabel="Add recipe"
      action={saveRecipe}
      submitLabel={defaults ? "Save recipe" : "Add recipe"}
      size="lg"
      defaultOpen={defaultOpen}
      triggerContent={triggerContent}
      triggerClassName="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-sunken"
    >
      {defaults && <input type="hidden" name="id" value={defaults.id} />}
      {!defaults && privateSpace && <input type="hidden" name="space" value="mine" />}
      <TextField name="name" label="Recipe name" required defaultValue={defaults?.name} placeholder="Grandma's chicken parmesan" />
      <FormRow>
        <TextField name="recipeBy" label="Recipe by" defaultValue={defaults?.recipeBy ?? ""} placeholder="Grandma Rose" />
        <TextField name="makingSince" label="Making since" defaultValue={defaults?.makingSince ?? ""} placeholder="1985 or Christmas 1992" />
      </FormRow>
      <ImageField currentUrl={defaults?.imageUrl} />
      <TextAreaField name="description" label="Description" rows={2} defaultValue={defaults?.description ?? ""} />
      <FormRow>
        <TextField name="prepTime" label="Prep time" defaultValue={defaults?.prepTime ?? ""} placeholder="15 minutes" />
        <TextField name="cookTime" label="Cook time" defaultValue={defaults?.cookTime ?? ""} placeholder="35-40 minutes" />
      </FormRow>
      <FormRow>
        <TextField name="temperature" label="Temperature" defaultValue={defaults?.temperature ?? ""} placeholder="350°F" />
        <NumberField name="servings" label="Servings" min={1} defaultValue={defaults?.servings ?? ""} />
      </FormRow>
      <TextAreaField
        name="ingredients"
        label="Ingredients"
        rows={7}
        defaultValue={defaults?.ingredients ?? ""}
        placeholder={"Batter:\n2 eggs\n1 cup flour\n1 cup milk\n\nGlaze:\n1 cup powdered sugar\n2 tbsp milk"}
        hint="One per line. To group them, add a title line ending in a colon, like “Batter:” or “For the glaze:”."
      />
      <TextAreaField name="instructions" label="Instructions" rows={7} defaultValue={defaults?.instructions ?? ""} placeholder={"Preheat oven to 400°F.\nBread the chicken…"} hint="One step per line." />
      <FormRow>
        <TextField name="tags" label="Tags" defaultValue={defaults?.tags.join(", ") ?? ""} placeholder="quick, kid-friendly, garden" hint="Comma separated" />
        <TextField name="source" label="Source" defaultValue={defaults?.source ?? ""} placeholder="Grandma / a website" />
      </FormRow>
      {collections.length > 0 && (
        <Field label="Collections">
          <ChipSelect name="collections" options={collections.map((c) => ({ value: c.id, label: c.name }))} defaultValue={defaults?.collections} />
        </Field>
      )}
      <TextAreaField name="notes" label="Special notes" rows={3} defaultValue={defaults?.notes ?? ""} placeholder="Use real butter. Doubles well. Grandma always added a pinch of nutmeg." hint="Shown in a highlighted box on the recipe and when printed." />
      <CheckboxField name="isFavorite" label="Family favorite" defaultChecked={defaults?.isFavorite} />
    </FormModal>
  );
}
