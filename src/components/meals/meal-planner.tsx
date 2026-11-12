"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { removeMeal, setMeal } from "@/app/actions/meals";
import { FormModal } from "@/components/forms/action-form";
import { CheckboxField, FormRow, NumberField, SelectField, TextField } from "@/components/forms/fields";
import { ActionButton } from "@/components/forms/inline";
import { cn } from "@/lib/utils";

export type PlannedMeal = { id: string; date: string; slot: string; recipeId: string | null; name: string; servings: number | null; missing: number | null; thumbUrl: string | null };

const SLOTS = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
] as const;

function AddMeal({ date, slot, recipes, canShop }: { date: string; slot: string; recipes: { id: string; name: string }[]; canShop: boolean }) {
  const [mode, setMode] = useState<"recipe" | "text">(recipes.length ? "recipe" : "text");
  const day = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
  return (
    <FormModal
      title={`${SLOTS.find((s) => s.key === slot)?.label ?? "Meal"} · ${day}`}
      action={setMeal}
      submitLabel="Add to plan"
      size="sm"
      triggerAriaLabel={`Add ${slot} on ${day}`}
      triggerContent={<Plus className="size-4" />}
      triggerClassName="flex h-8 w-full items-center justify-center rounded-lg border border-dashed border-line-strong text-muted hover:border-primary-400 hover:bg-primary-50 hover:text-primary-600"
    >
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="slot" value={slot} />
      {recipes.length > 0 && (
        <div className="inline-flex w-fit rounded-xl bg-sunken p-1">
          {(["recipe", "text"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", mode === m ? "bg-surface shadow-sm" : "text-muted")}>
              {m === "recipe" ? "From recipes" : "Something else"}
            </button>
          ))}
        </div>
      )}
      {mode === "recipe" ? (
        <>
          <SelectField name="recipeId" label="Recipe" required placeholder="Choose a recipe…" options={recipes.map((r) => ({ value: r.id, label: r.name }))} />
          <FormRow>
            <NumberField name="servings" label="Servings" min={1} placeholder="Recipe default" />
          </FormRow>
          {canShop && <CheckboxField name="addMissing" label="Check the pantry and add missing ingredients to the shopping list" defaultChecked />}
        </>
      ) : (
        <TextField name="title" label="Meal" required placeholder="Leftovers, pizza night, eat out…" />
      )}
    </FormModal>
  );
}

export function MealPlanner({
  days,
  today,
  meals,
  recipes,
  canEdit,
  canShop,
}: {
  days: string[];
  today: string;
  meals: PlannedMeal[];
  recipes: { id: string; name: string }[];
  canEdit: boolean;
  canShop: boolean;
}) {
  const at = (d: string, s: string) => meals.filter((m) => m.date === d && m.slot === s);
  return (
    <div className="grid gap-3 md:grid-cols-7">
      {days.map((d) => {
        const date = new Date(`${d}T12:00:00Z`);
        const snacks = at(d, "snack");
        return (
          <section key={d} className={cn("flex flex-col gap-2 rounded-2xl border bg-surface p-3", d === today ? "border-primary-300 ring-2 ring-primary-100" : "border-line")}>
            <header className="flex items-baseline justify-between md:flex-col md:items-start">
              <h2 className="font-sans text-sm font-semibold">{date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })}</h2>
              <span className="text-xs text-muted">{date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</span>
            </header>
            {[...SLOTS, ...(snacks.length ? [{ key: "snack", label: "Snack" } as const] : [])].map((s) => (
              <div key={s.key} className="flex flex-col gap-1.5">
                <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">{s.label}</p>
                {at(d, s.key).map((m) => (
                  <div key={m.id} className="group relative flex items-start gap-2 rounded-lg bg-primary-50/70 p-2">
                    {m.thumbUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.thumbUrl} alt="" className="size-8 shrink-0 rounded-md object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      {m.recipeId ? (
                        <Link href={`/recipes/${m.recipeId}`} className="line-clamp-2 text-sm font-medium hover:underline">
                          {m.name}
                        </Link>
                      ) : (
                        <p className="line-clamp-2 text-sm font-medium">{m.name}</p>
                      )}
                      {m.missing !== null && (
                        <p className={cn("text-[11px]", m.missing ? "text-olive-700" : "text-primary-600")}>{m.missing ? `${m.missing} to buy` : "✓ All in stock"}</p>
                      )}
                    </div>
                    {canEdit && (
                      <ActionButton action={removeMeal} fields={{ id: m.id }} label={`Remove ${m.name}`} className="size-6 shrink-0 rounded-full text-muted opacity-100 hover:bg-surface hover:text-wine-500 md:opacity-0 md:group-hover:opacity-100">
                        <X className="size-3.5" />
                      </ActionButton>
                    )}
                  </div>
                ))}
                {canEdit && at(d, s.key).length === 0 && <AddMeal date={d} slot={s.key} recipes={recipes} canShop={canShop} />}
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
