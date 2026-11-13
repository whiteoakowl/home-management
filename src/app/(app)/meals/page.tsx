import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { ChevronLeft, ChevronRight, Copy, ShoppingBasket, UtensilsCrossed } from "lucide-react";
import { db } from "@/db";
import { mealPlanEntries, recipes } from "@/db/schema";
import { copyMealWeek, shopForWeek } from "@/app/actions/meals";
import { ActionButton } from "@/components/forms/inline";
import { MealPlanner, type PlannedMeal } from "@/components/meals/meal-planner";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { addDays, startOfWeek, todayIn } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { dietChecker } from "@/lib/medical";
import { checkIngredients } from "@/lib/ingredients";
import { activeInventory, ingredientsFor, missingFor } from "@/lib/kitchen";

export const metadata: Metadata = { title: "Meal plan" };

export default async function MealsPage({ searchParams }: PageProps<"/meals">) {
  const viewer = await getViewer();
  if (!viewer.can("meals")) notFound();
  const sp = await searchParams;
  const today = todayIn(viewer.family.timezone);
  const anchor = typeof sp.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : today;
  const start = startOfWeek(anchor, 1); // Monday → Sunday
  const end = addDays(start, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const [rows, recipeOpts] = await Promise.all([
    db
      .select({ e: mealPlanEntries, name: recipes.name, base: recipes.servings, image: recipes.imageFileId })
      .from(mealPlanEntries)
      .leftJoin(recipes, eq(recipes.id, mealPlanEntries.recipeId))
      .where(and(eq(mealPlanEntries.familyId, viewer.family.id), gte(mealPlanEntries.date, start), lte(mealPlanEntries.date, end)))
      .orderBy(asc(mealPlanEntries.createdAt)),
    db.select({ id: recipes.id, name: recipes.name }).from(recipes).where(eq(recipes.familyId, viewer.family.id)).orderBy(asc(recipes.name)),
  ]);

  const showPantry = viewer.can("kitchen");
  const recipeIds = [...new Set(rows.map((r) => r.e.recipeId).filter((x): x is string => !!x))];
  const [ings, inv, diet] = await Promise.all([
    showPantry || viewer.can("medical") ? ingredientsFor(recipeIds) : [],
    showPantry ? activeInventory(viewer.family.id) : [],
    dietChecker(viewer),
  ]);
  const byRecipe = Map.groupBy(ings, (i) => i.recipeId);
  const meals: PlannedMeal[] = rows.map(({ e, name, base, image }) => {
    const scale = base && e.servings ? e.servings / base : 1;
    const missing = e.recipeId && showPantry ? checkIngredients(byRecipe.get(e.recipeId) ?? [], inv, scale).filter((s) => !s.have && !s.optional).length : null;
    // Free-text meals are checked by their title; recipes by every ingredient.
    const toCheck = e.recipeId ? (byRecipe.get(e.recipeId) ?? []).map((i) => i.name) : [e.title ?? ""];
    const warnings = diet ? [...new Set(diet.check(toCheck).map((w) => `${w.member}: ${w.label}`))] : [];
    return { id: e.id, date: e.date, slot: e.slot, recipeId: e.recipeId, name: name ?? e.title ?? "Meal", servings: e.servings, missing: showPantry ? missing : null, thumbUrl: fileUrl(image, true), warnings };
  });
  const weekNeeds = showPantry && recipeIds.length
    ? await missingFor(viewer.family.id, rows.filter((r) => r.e.recipeId).map((r) => ({ recipeId: r.e.recipeId!, scale: r.base && r.e.servings ? r.e.servings / r.base : 1 })))
    : [];
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const canEdit = viewer.can("meals", "edit");

  return (
    <>
      <PageHeader eyebrow="Kitchen" title="Meal plan" description="Plan the week. We'll check your pantry and build the shopping list." />
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Link href={`/meals?week=${addDays(start, -7)}`} aria-label="Previous week" className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface hover:bg-sunken">
            <ChevronLeft className="size-5" />
          </Link>
          <Link href={`/meals?week=${addDays(start, 7)}`} aria-label="Next week" className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface hover:bg-sunken">
            <ChevronRight className="size-5" />
          </Link>
          <Link href="/meals" className="inline-flex h-10 items-center rounded-full border border-line bg-surface px-4 text-sm font-medium hover:bg-sunken">
            This week
          </Link>
          {canEdit && (
            <ActionButton action={copyMealWeek} fields={{ to: start, weeksBack: 1 }} confirm="Copy last week's meals into this week? Slots that already have a meal are kept." className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm font-medium hover:bg-sunken">
              <Copy className="size-4" /> Copy last week
            </ActionButton>
          )}
          <h2 className="ml-2 text-xl font-semibold">
            {fmt(start)} – {fmt(end)}
          </h2>
        </div>
        {showPantry && recipeIds.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted">{weekNeeds.length ? `${weekNeeds.length} ingredient${weekNeeds.length === 1 ? "" : "s"} to buy this week` : "Everything's in stock ✓"}</span>
            {weekNeeds.length > 0 && viewer.can("shopping", "edit") && (
              <ActionButton action={shopForWeek} fields={{ week: start }} className="h-10 rounded-[var(--radius-control)] bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700">
                <ShoppingBasket className="size-4" /> Add to shopping list
              </ActionButton>
            )}
          </div>
        )}
      </div>
      {recipeOpts.length === 0 && canEdit && (
        <Card className="mb-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-3 text-[15px] text-ink-soft">
            <UtensilsCrossed className="size-5 text-primary-600" /> Add recipes to plan meals from them, or type any meal into a day.
          </p>
          <ButtonLink href="/recipes?new=1" variant="soft" size="sm">
            Add a recipe
          </ButtonLink>
        </Card>
      )}
      <MealPlanner days={days} today={today} meals={meals} recipes={recipeOpts} canEdit={canEdit} canShop={viewer.can("shopping", "edit")} />
    </>
  );
}
