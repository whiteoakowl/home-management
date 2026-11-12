"use client";

import { useTransition } from "react";
import { CalendarPlus, Printer, Star } from "lucide-react";
import { planRecipe, rateRecipe } from "@/app/actions/recipes";
import { FormModal } from "@/components/forms/action-form";
import { CheckboxField, DateField, FormRow, SelectField } from "@/components/forms/fields";
import { cn } from "@/lib/utils";

export function StarRating({ recipeId, value, label = "Your rating" }: { recipeId: string; value: number | null; label?: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted">{label}</span>
      <div className={cn("flex", pending && "opacity-50")} role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() =>
              start(() => {
                const fd = new FormData();
                fd.set("id", recipeId);
                fd.set("rating", String(n));
                return rateRecipe(fd);
              })
            }
            className="p-0.5"
          >
            <Star className={cn("size-6", value && n <= value ? "fill-olive-400 text-olive-400" : "text-line-strong hover:text-olive-400")} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function PlanRecipeButton({ recipeId, today, canShop }: { recipeId: string; today: string; canShop: boolean }) {
  return (
    <FormModal title="Add to meal plan" triggerLabel="Plan it" triggerVariant="secondary" triggerIcon={<CalendarPlus className="size-4" />} action={planRecipe} submitLabel="Add to plan" size="sm">
      <input type="hidden" name="id" value={recipeId} />
      <FormRow>
        <DateField name="date" label="Day" defaultValue={today} required />
        <SelectField
          name="slot"
          label="Meal"
          defaultValue="dinner"
          options={[
            { value: "breakfast", label: "Breakfast" },
            { value: "lunch", label: "Lunch" },
            { value: "dinner", label: "Dinner" },
            { value: "snack", label: "Snack" },
          ]}
        />
      </FormRow>
      {canShop && <CheckboxField name="addMissing" label="Add missing ingredients to the shopping list" defaultChecked />}
    </FormModal>
  );
}

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-sunken print:hidden">
      <Printer className="size-4" /> {label}
    </button>
  );
}
