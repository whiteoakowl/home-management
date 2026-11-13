import { saveCelebration } from "@/app/actions/craft";
import { RecordModal } from "@/components/forms/config-form";
import { ChipSelect } from "@/components/forms/fields";
import { CELEBRATION_FIELDS } from "@/lib/craft-config";
import type { FieldValue } from "@/lib/record-fields";

export function CelebrationModal({
  defaults,
  id,
  imageUrl,
  recipes,
  rituals,
  linked,
}: {
  defaults?: Record<string, FieldValue | undefined>;
  id?: string;
  imageUrl?: string | null;
  recipes?: { id: string; name: string }[];
  rituals?: { id: string; name: string }[];
  linked?: string[];
}) {
  return (
    <RecordModal
      title={id ? "Edit celebration" : "Plan a celebration"}
      triggerLabel={id ? "Edit" : "Plan celebration"}
      triggerVariant={id ? "secondary" : "primary"}
      action={saveCelebration}
      fields={CELEBRATION_FIELDS}
      defaults={defaults}
      hidden={id ? { id } : {}}
      imageUrls={{ image: imageUrl ?? null }}
      extra={
        (recipes || rituals) && (
          <>
            <input type="hidden" name="linksField" value="1" />
            {recipes && recipes.length > 0 && (
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium text-ink-soft">Recipes for the feast</legend>
                <ChipSelect name="recipeIds" options={recipes.map((r) => ({ value: r.id, label: r.name }))} defaultValue={linked} />
              </fieldset>
            )}
            {rituals && rituals.length > 0 && (
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium text-ink-soft">Rituals & spells</legend>
                <ChipSelect name="craftItemIds" options={rituals.map((r) => ({ value: r.id, label: r.name }))} defaultValue={linked} />
              </fieldset>
            )}
          </>
        )
      }
    />
  );
}
