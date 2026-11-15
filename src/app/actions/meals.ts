"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gte, isNotNull, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { mealPlanEntries, mealSlot, recipes } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { AuthorizationError, getViewer, type Viewer } from "@/lib/dal";
import { addDays } from "@/lib/dates";
import { logActivity } from "@/lib/family";
import { assertChange, ownerForNew } from "@/lib/food-space";
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

/** Meal-plan rows in one space: the family's (owner null) or a member's private plan. */
const planIn = (owner: string | null) => (owner ? eq(mealPlanEntries.ownerMemberId, owner) : isNull(mealPlanEntries.ownerMemberId));

/** The space a week-level action works on, from the form's `space` field. */
function spaceOwner(viewer: Viewer, fd: FormData, module: "meals" | "shopping", level: "add" | "edit") {
  if (fd.get("space") === "mine") return ownerForNew(viewer, module, fd);
  if (!viewer.can(module, level)) throw new AuthorizationError("You don't have access to that.");
  return null;
}

export async function setMeal(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await getViewer();
    const owner = ownerForNew(viewer, "meals", fd);
    const date = f.date(fd, "date");
    const slot = f.str(fd, "slot") as Slot;
    if (!date) return fail("Pick a day.", "date");
    if (!SLOTS.includes(slot)) return fail("Pick a meal.", "slot");
    const recipeId = f.str(fd, "recipeId");
    const title = f.str(fd, "title");
    let recipe: { id: string; name: string; servings: number | null } | undefined;
    if (recipeId) {
      // Family recipes can go on any plan; private recipes only on their owner's.
      [recipe] = await db
        .select({ id: recipes.id, name: recipes.name, servings: recipes.servings })
        .from(recipes)
        .where(and(eq(recipes.id, recipeId), eq(recipes.familyId, viewer.family.id), owner ? or(isNull(recipes.ownerMemberId), eq(recipes.ownerMemberId, owner)) : isNull(recipes.ownerMemberId)));
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
      ownerMemberId: owner,
      createdByMemberId: viewer.member.id,
    });

    let added = 0;
    if (recipe && f.bool(fd, "addMissing") && (owner || viewer.can("shopping", "add"))) {
      const scale = recipe.servings && servings ? servings / recipe.servings : 1;
      added = await addNeedsToShopping(viewer.family.id, await missingFor(viewer.family.id, [{ recipeId: recipe.id, scale }], owner), "meal_plan", recipe.id, owner);
    }
    const day = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
    if (!owner) await logActivity(db, viewer.family.id, viewer.member.id, "meal.planned", `added ${recipe?.name ?? title} to ${day} ${slot}`, { module: "meals" });
    revalidateMeals();
    return ok(added ? `${added} missing ingredient${added === 1 ? "" : "s"} added to ${owner ? "My Shopping List" : "the shopping list"}.` : undefined);
  });
}

export async function removeMeal(fd: FormData) {
  const viewer = await getViewer();
  const [e] = await db.select().from(mealPlanEntries).where(and(eq(mealPlanEntries.id, String(fd.get("id"))), eq(mealPlanEntries.familyId, viewer.family.id)));
  if (!e) return;
  assertChange(viewer, "meals", e);
  await db.delete(mealPlanEntries).where(eq(mealPlanEntries.id, e.id));
  revalidateMeals();
}

/** Compare the whole week's recipes to the pantry (same space) and add what's missing. */
export async function shopForWeek(fd: FormData) {
  const viewer = await getViewer();
  const owner = spaceOwner(viewer, fd, "shopping", "add");
  const start = String(fd.get("week"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return;
  const entries = await db
    .select({ recipeId: mealPlanEntries.recipeId, servings: mealPlanEntries.servings, base: recipes.servings })
    .from(mealPlanEntries)
    .innerJoin(recipes, eq(recipes.id, mealPlanEntries.recipeId))
    .where(and(eq(mealPlanEntries.familyId, viewer.family.id), planIn(owner), gte(mealPlanEntries.date, start), lte(mealPlanEntries.date, addDays(start, 6)), isNotNull(mealPlanEntries.recipeId)));
  const needs = await missingFor(
    viewer.family.id,
    entries.map((e) => ({ recipeId: e.recipeId!, scale: e.base && e.servings ? e.servings / e.base : 1 })),
    owner,
  );
  const n = await addNeedsToShopping(viewer.family.id, needs, "meal_plan", null, owner);
  if (n && !owner) await logActivity(db, viewer.family.id, viewer.member.id, "shopping.meal_plan", `added ${n} item${n === 1 ? "" : "s"} for this week's meals to the shopping list`, { module: "shopping" });
  revalidateMeals();
}

/** Copy a previous week's plan into this week (slots that already have a meal are left alone). */
export async function copyMealWeek(fd: FormData) {
  const viewer = await getViewer();
  const owner = spaceOwner(viewer, fd, "meals", "edit");
  const to = f.date(fd, "to");
  const weeksBack = Math.min(12, Math.max(1, f.int(fd, "weeksBack") ?? 1));
  if (!to) return;
  const from = addDays(to, -7 * weeksBack);
  const [source, existing] = await Promise.all([
    db.select().from(mealPlanEntries).where(and(eq(mealPlanEntries.familyId, viewer.family.id), planIn(owner), gte(mealPlanEntries.date, from), lte(mealPlanEntries.date, addDays(from, 6)))),
    db.select({ date: mealPlanEntries.date, slot: mealPlanEntries.slot }).from(mealPlanEntries).where(and(eq(mealPlanEntries.familyId, viewer.family.id), planIn(owner), gte(mealPlanEntries.date, to), lte(mealPlanEntries.date, addDays(to, 6)))),
  ]);
  const taken = new Set(existing.map((e) => `${e.date}|${e.slot}`));
  const rows = source
    .map((e) => ({ ...e, date: addDays(e.date, 7 * weeksBack) }))
    .filter((e) => !taken.has(`${e.date}|${e.slot}`) || e.slot === "snack")
    .map(({ date, slot, recipeId, title, servings, notes }) => ({ familyId: viewer.family.id, date, slot, recipeId, title, servings, notes, ownerMemberId: owner, createdByMemberId: viewer.member.id }));
  if (rows.length) await db.insert(mealPlanEntries).values(rows);
  revalidatePath("/meals");
  revalidatePath("/calendar", "layout");
}
