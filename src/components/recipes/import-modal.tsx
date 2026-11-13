import { Download } from "lucide-react";
import { importRecipe } from "@/app/actions/recipes";
import { FormModal } from "@/components/forms/action-form";
import { TextAreaField, TextField } from "@/components/forms/fields";

export function ImportRecipeModal({ defaultOpen }: { defaultOpen?: boolean }) {
  return (
    <FormModal
      title="Import a recipe"
      description="Paste a link to a recipe page (most recipe sites work), or paste the recipe text. You can edit everything afterwards."
      action={importRecipe}
      triggerLabel="Import"
      triggerVariant="secondary"
      triggerIcon={<Download className="size-4" />}
      submitLabel="Import"
      defaultOpen={defaultOpen}
      size="lg"
    >
      <TextField name="url" label="Recipe link" type="url" placeholder="https://…" />
      <p className="text-center text-sm text-muted">or</p>
      <TextAreaField name="text" label="Paste the recipe" rows={8} placeholder={"Grandma's pancakes\nServes 4\n\nIngredients\n2 cups flour\n2 eggs\n\nDirections\n1. Whisk everything together…"} />
    </FormModal>
  );
}
