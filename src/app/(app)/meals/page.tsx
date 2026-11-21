import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { redirect } from "next/navigation";
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
import { FoodSpaceNav, PrivateSpaceNote } from "@/components/food/food-space-nav";
import { canAddIn, canChange, canOpenFood, inSpace, privateSpaceMembers, resolveSpace, withSpace } from "@/lib/food-space";
import { addDays, startOfWeek, todayIn } from "@/lib/dates";
import { mealWeekStartsOn } from "@/lib/meal-week";
import { PrintPdfButtons, WeekStartPicker } from "@/components/meals/week-controls";
import { fileUrl } from "@/lib/files";
import { dietChecker } from "@/lib/medical";
import { checkIngredients } from "@/lib/ingredients";
import { activeInventory, ingredientsFor, missingFor } from "@/lib/kitchen";

export const metadata: Metadata = { title: "Family Meal Plans" };

export default async function MealsPage({ searchParams }: PageProps<"/meals">) {
  const viewer = await getViewer();
  if (!canOpenFood(viewer, "meals")) notFound();
  const sp = await searchParams;
  const space = await resolveSpace(viewer, sp.space);
  if (space.kind === "family" && !viewer.can("meals")) redirect("/meals?space=mine");
  const owner = space.kind === "private" ? space.memberId : null;
  const own = space.kind === "private" && space.own;
  const today = todayIn(viewer.family.timezone);
  const anchor = typeof sp.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : today;
  const weekStart = mealWeekStartsOn(viewer, space);
  const start = startOfWeek(anchor, weekStart);
  const end = addDays(start, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const [rows, recipeOpts] = await Promise.all([
    db
      .select({ e: mealPlanEntries, name: recipes.name, base: recipes.servings, image: recipes.imageFileId })
      .from(mealPlanEntries)
      .leftJoin(recipes, eq(recipes.id, mealPlanEntries.recipeId))
      .where(and(eq(mealPlanEntries.familyId, viewer.family.id), inSpace(mealPlanEntries.ownerMemberId, space), gte(mealPlanEntries.date, start), lte(mealPlanEntries.date, end)))
      .orderBy(asc(mealPlanEntries.createdAt)),
    // Family plan: family recipes. Private plan: family recipes (if allowed) + my own.
    db
      .select({ id: recipes.id, name: recipes.name })
      .from(recipes)
      .where(and(eq(recipes.familyId, viewer.family.id), owner ? (viewer.can("recipes") ? or(isNull(recipes.ownerMemberId), eq(recipes.ownerMemberId, owner)) : eq(recipes.ownerMemberId, owner)) : isNull(recipes.ownerMemberId)))
      .orderBy(asc(recipes.name)),
  ]);

  const showPantry = owner ? own : viewer.can("kitchen");
  const recipeIds = [...new Set(rows.map((r) => r.e.recipeId).filter((x): x is string => !!x))];
  const [ings, inv, diet] = await Promise.all([
    showPantry || viewer.can("medical") ? ingredientsFor(recipeIds) : [],
    showPantry ? activeInventory(viewer.family.id, owner) : [],
    dietChecker(viewer),
  ]);
  const byRecipe = Map.groupBy(ings, (i) => i.recipeId);
  const meals: PlannedMeal[] = rows.map(({ e, name, base, image }) => {
    const scale = base && e.servings ? e.servings / base : 1;
    const missing = e.recipeId && showPantry ? checkIngredients(byRecipe.get(e.recipeId) ?? [], inv, scale).filter((s) => !s.have && !s.optional).length : null;
    // Free-text meals are checked by their title; recipes by every ingredient.
    const toCheck = e.recipeId ? (byRecipe.get(e.recipeId) ?? []).map((i) => i.name) : [e.title ?? ""];
    const warnings = diet ? [...new Set(diet.check(toCheck).map((w) => `${w.member}: ${w.label}`))] : [];
    return { id: e.id, date: e.date, slot: e.slot, recipeId: e.recipeId, name: name ?? e.title ?? "Meal", servings: e.servings, missing: showPantry ? missing : null, thumbUrl: fileUrl(image, true), warnings, canRemove: canChange(viewer, "meals", e) };
  });
  const weekNeeds = showPantry && recipeIds.length
    ? await missingFor(viewer.family.id, rows.filter((r) => r.e.recipeId).map((r) => ({ recipeId: r.e.recipeId!, scale: r.base && r.e.servings ? r.e.servings / r.base : 1 })), owner)
    : [];
  const canEdit = canAddIn(viewer, "meals", space);
  const canCopy = owner ? own : viewer.can("meals", "edit");
  const canShop = owner ? own : viewer.can("shopping", "add");
  const spaceField = own ? { space: "mine" } : {};
  const others = await privateSpaceMembers(viewer);
  const canSetStart = owner ? own : viewer.isParent || viewer.can("meals", "edit");
  const fmtLong = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  const pill = "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface text-sm font-medium hover:bg-sunken";

  return (
    <>
      <PageHeader help="meal-plan"
        eyebrow={owner ? "My private food" : "Family Pantry"}
        title={owner ? (own ? "My Meal Plans" : `${space.kind === "private" ? space.memberName : ""}'s Meal Plans`) : "Family Meal Plans"}
        description={owner ? "Your own meal plan, private to you." : "Plan the week. We'll check your pantry and build the shopping list."}
        actions={
          <div className="flex items-center gap-2">
            <PrintPdfButtons href={withSpace(`/meals/print?week=${start}`, space)} />
            {canSetStart && <WeekStartPicker key={`${weekStart}`} value={weekStart} privateSpace={own} />}
          </div>
        }
      />
      <FoodSpaceNav viewer={viewer} active="meals" space={space} others={others} />
      <PrivateSpaceNote space={space} viewer={viewer} />
      <div className="mb-5 flex flex-col gap-3">
        <h2 className="text-xl font-semibold">
          {fmtLong(start)} – {fmtLong(end)}
        </h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <Link href={withSpace(`/meals?week=${addDays(start, -7)}`, space)} aria-label="Previous week" className={`${pill} size-9`}>
            <ChevronLeft className="size-4" />
          </Link>
          <Link href={withSpace(`/meals?week=${addDays(start, 7)}`, space)} aria-label="Next week" className={`${pill} size-9`}>
            <ChevronRight className="size-4" />
          </Link>
          <Link href={withSpace("/meals", space)} className={`${pill} px-3`}>
            This week
          </Link>
          {canCopy && (
            <ActionButton action={copyMealWeek} fields={{ to: start, weeksBack: 1, ...spaceField }} confirm="Copy last week's meals into this week? Slots that already have a meal are kept." className={`${pill} px-3`}>
              <Copy className="size-4 shrink-0" /> Copy last week
            </ActionButton>
          )}
        </div>
        {showPantry && recipeIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted">{weekNeeds.length ? `${weekNeeds.length} ingredient${weekNeeds.length === 1 ? "" : "s"} to buy this week` : "Everything's in stock ✓"}</span>
            {weekNeeds.length > 0 && canShop && (
              <ActionButton action={shopForWeek} fields={{ week: start, ...spaceField }} className="h-10 rounded-[var(--radius-control)] bg-primary-600 px-4 text-sm font-semibold whitespace-nowrap text-white hover:bg-primary-700">
                <ShoppingBasket className="size-4 shrink-0" /> Add to {owner ? "My Shopping List" : "shopping list"}
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
          <ButtonLink href={withSpace("/recipes?new=1", space)} variant="soft" size="sm">
            Add a recipe
          </ButtonLink>
        </Card>
      )}
      <MealPlanner days={days} today={today} meals={meals} recipes={recipeOpts} canEdit={canEdit} canShop={canShop} privateSpace={own} />
    </>
  );
}
