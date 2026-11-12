"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gte, isNotNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { mealPlanEntries, mealSlot, recipes } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { requireModule } from "@/lib/dal";
import { addDays } from "@/lib/dates";
import { logActivity } from "@/lib/family";
import { addNeedsToShopping, missingFor } from "@/lib/kitchen";
import { f } from "@/lib/records";

const SLOTS = mealSlot.enumValues;
type Slot = (typeof SLOTS)[number];

function revalidateMeals() {
  revalidatePath("/meals");
  revalidatePath("/shopping", "layout");
  revalidatePath("/calendar");
  revalidatePath("/");
}

export async function setMeal(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("meals", "edit");
    const date = f.date(fd, "date");
    const slot = f.str(fd, "slot") as Slot;
    if (!date) return fail("Pick a day.", "date");
    if (!SLOTS.includes(slot)) return fail("Pick a meal.", "slot");
    const recipeId = f.str(fd, "recipeId");
    const title = f.str(fd, "title");
    let recipe: { id: string; name: string; servings: number | null } | undefined;
    if (recipeId) {
      [recipe] = await db
        .select({ id: recipes.id, name: recipes.name, servings: recipes.servings })
        .from(recipes)
        .where(and(eq(recipes.id, recipeId), eq(recipes.familyId, viewer.family.id)));
      if (!recipe) return fail("Recipe not found.", "recipeId");
    }
    if (!recipe && !title) return fail("Choose a recipe or type a meal.", "title");
    const servings = f.int(fd, "servings") ?? recipe?.servings ?? null;
    await db.insert(mealPlanEntries).values({
      familyId: viewer.family.id,
      date,
      slot,
      recipeId: recipe?.id ?? null,
      title: recipe ? null : title,
      servings,
      notes: f.str(fd, "notes"),
      createdByMemberId: viewer.member.id,
    });

    let added = 0;
    if (recipe && f.bool(fd, "addMissing") && viewer.can("shopping", "edit")) {
      const scale = recipe.servings && servings ? servings / recipe.servings : 1;
      added = await addNeedsToShopping(viewer.family.id, await missingFor(viewer.family.id, [{ recipeId: recipe.id, scale }]), "meal_plan", recipe.id);
    }
    const day = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
    await logActivity(db, viewer.family.id, viewer.member.id, "meal.planned", `added ${recipe?.name ?? title} to ${day} ${slot}`, { module: "meals" });
    revalidateMeals();
    return ok(added ? `${added} missing ingredient${added === 1 ? "" : "s"} added to the shopping list.` : undefined);
  });
}

export async function removeMeal(fd: FormData) {
  const viewer = await requireModule("meals", "edit");
  await db.delete(mealPlanEntries).where(and(eq(mealPlanEntries.id, String(fd.get("id"))), eq(mealPlanEntries.familyId, viewer.family.id)));
  revalidateMeals();
}

/** Compare the whole week's recipes to inventory and add what's missing. */
export async function shopForWeek(fd: FormData) {
  const viewer = await requireModule("shopping", "edit");
  const start = String(fd.get("week"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return;
  const entries = await db
    .select({ recipeId: mealPlanEntries.recipeId, servings: mealPlanEntries.servings, base: recipes.servings })
    .from(mealPlanEntries)
    .innerJoin(recipes, eq(recipes.id, mealPlanEntries.recipeId))
    .where(and(eq(mealPlanEntries.familyId, viewer.family.id), gte(mealPlanEntries.date, start), lte(mealPlanEntries.date, addDays(start, 6)), isNotNull(mealPlanEntries.recipeId)));
  const needs = await missingFor(
    viewer.family.id,
    entries.map((e) => ({ recipeId: e.recipeId!, scale: e.base && e.servings ? e.servings / e.base : 1 })),
  );
  const n = await addNeedsToShopping(viewer.family.id, needs, "meal_plan", null);
  if (n) await logActivity(db, viewer.family.id, viewer.member.id, "shopping.meal_plan", `added ${n} item${n === 1 ? "" : "s"} for this week's meals to the shopping list`, { module: "shopping" });
  revalidateMeals();
}
