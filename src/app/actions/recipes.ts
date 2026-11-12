"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { mealPlanEntries, mealSlot, recipeCollectionItems, recipeCollections, recipeIngredients, recipeRatings, recipes } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { AuthorizationError, requireModule } from "@/lib/dal";
import { logActivity } from "@/lib/family";
import { deleteFamilyFile, saveUpload } from "@/lib/files";
import { parseIngredientLine } from "@/lib/ingredients";
import { addNeedsToShopping, missingFor } from "@/lib/kitchen";
import { ownedCategoryId } from "@/lib/queries";
import { f } from "@/lib/records";

function revalidateRecipes() {
  revalidatePath("/recipes", "layout");
  revalidatePath("/meals");
  revalidatePath("/shopping", "layout");
  revalidatePath("/");
}

async function ownRecipe(familyId: string, id: string) {
  const [r] = await db.select().from(recipes).where(and(eq(recipes.id, id), eq(recipes.familyId, familyId)));
  if (!r) throw new AuthorizationError("Recipe not found.");
  return r;
}

export async function saveRecipe(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("recipes", "edit");
    const name = f.str(fd, "name");
    if (!name) return fail("Name your recipe.", "name");
    const ingredientLines = String(fd.get("ingredients") ?? "").split("\n");
    const parsed = ingredientLines.map(parseIngredientLine).filter((x): x is NonNullable<typeof x> => !!x);
    const instructions = String(fd.get("instructions") ?? "")
      .split("\n")
      .map((s) => s.replace(/^\s*(\d+[.)]|step \d+:?)\s*/i, "").trim())
      .filter(Boolean);
    const id = f.str(fd, "id");
    const image = await saveUpload(viewer, fd.get("image"));
    const values = {
      familyId: viewer.family.id,
      name,
      description: f.str(fd, "description"),
      instructions,
      prepMinutes: f.int(fd, "prepMinutes"),
      cookMinutes: f.int(fd, "cookMinutes"),
      servings: f.int(fd, "servings"),
      categoryId: await ownedCategoryId(viewer, "recipe", f.str(fd, "categoryId")),
      tags: f.split(fd, "tags").map((t) => t.toLowerCase()).slice(0, 20),
      notes: f.str(fd, "notes"),
      source: f.str(fd, "source"),
      isFavorite: f.bool(fd, "isFavorite"),
      ...(image ? { imageFileId: image } : {}),
    };
    const collections = f.list(fd, "collections");

    let recipeId = id;
    await db.transaction(async (tx) => {
      if (id) {
        const old = await ownRecipe(viewer.family.id, id);
        await tx.update(recipes).set(f.bool(fd, "removeImage") && !image ? { ...values, imageFileId: null } : values).where(eq(recipes.id, id));
        if ((image || f.bool(fd, "removeImage")) && old.imageFileId) await deleteFamilyFile(viewer.family.id, old.imageFileId);
        await tx.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, id));
        await tx.delete(recipeCollectionItems).where(eq(recipeCollectionItems.recipeId, id));
      } else {
        const [row] = await tx.insert(recipes).values({ ...values, createdByMemberId: viewer.member.id }).returning({ id: recipes.id });
        recipeId = row!.id;
      }
      if (parsed.length) {
        await tx.insert(recipeIngredients).values(
          parsed.map((p, position) => ({ recipeId: recipeId!, name: p.name, original: p.original, quantity: p.quantity !== null ? String(p.quantity) : null, unit: p.unit, optional: p.optional, position })),
        );
      }
      if (collections.length) {
        const owned = await tx
          .select({ id: recipeCollections.id })
          .from(recipeCollections)
          .where(and(eq(recipeCollections.familyId, viewer.family.id), inArray(recipeCollections.id, collections)));
        if (owned.length) await tx.insert(recipeCollectionItems).values(owned.map((c) => ({ collectionId: c.id, recipeId: recipeId! })));
      }
    });
    if (!id) await logActivity(db, viewer.family.id, viewer.member.id, "recipe.added", `added the recipe "${name}"`, { module: "recipes", entityId: recipeId! });
    revalidateRecipes();
    if (!id) redirect(`/recipes/${recipeId}`);
    return ok("Saved.");
  });
}

export async function deleteRecipe(fd: FormData) {
  const viewer = await requireModule("recipes", "edit");
  const r = await ownRecipe(viewer.family.id, String(fd.get("id")));
  await db.delete(recipes).where(eq(recipes.id, r.id));
  await deleteFamilyFile(viewer.family.id, r.imageFileId);
  revalidateRecipes();
  redirect("/recipes");
}

export async function toggleFavorite(fd: FormData) {
  const viewer = await requireModule("recipes", "edit");
  const r = await ownRecipe(viewer.family.id, String(fd.get("id")));
  await db.update(recipes).set({ isFavorite: !r.isFavorite }).where(eq(recipes.id, r.id));
  revalidateRecipes();
}

export async function rateRecipe(fd: FormData) {
  const viewer = await requireModule("recipes", "view");
  const r = await ownRecipe(viewer.family.id, String(fd.get("id")));
  const rating = Math.max(1, Math.min(5, Number(fd.get("rating")) || 0));
  await db
    .insert(recipeRatings)
    .values({ recipeId: r.id, memberId: viewer.member.id, rating })
    .onConflictDoUpdate({ target: [recipeRatings.recipeId, recipeRatings.memberId], set: { rating } });
  revalidateRecipes();
}

/** Recipe → missing ingredients → shopping list. */
export async function addRecipeToShopping(fd: FormData) {
  const viewer = await requireModule("shopping", "edit");
  const r = await ownRecipe(viewer.family.id, String(fd.get("id")));
  const scale = Math.max(0.25, Number(fd.get("scale")) || 1);
  const needs = await missingFor(viewer.family.id, [{ recipeId: r.id, scale }]);
  const n = await addNeedsToShopping(viewer.family.id, needs, "recipe", r.id);
  if (n) await logActivity(db, viewer.family.id, viewer.member.id, "shopping.recipe", `added ${n} item${n === 1 ? "" : "s"} for ${r.name} to the shopping list`, { module: "shopping" });
  revalidateRecipes();
}

const SLOTS = mealSlot.enumValues;

/** Recipe → meal plan (optionally adding missing ingredients to shopping). */
export async function planRecipe(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("meals", "edit");
    const r = await ownRecipe(viewer.family.id, String(fd.get("id")));
    const date = f.date(fd, "date");
    const slot = String(fd.get("slot")) as (typeof SLOTS)[number];
    if (!date) return fail("Pick a day.", "date");
    if (!SLOTS.includes(slot)) return fail("Pick a meal.", "slot");
    await db.insert(mealPlanEntries).values({ familyId: viewer.family.id, date, slot, recipeId: r.id, servings: r.servings, createdByMemberId: viewer.member.id });
    let added = 0;
    if (f.bool(fd, "addMissing") && viewer.can("shopping", "edit")) {
      added = await addNeedsToShopping(viewer.family.id, await missingFor(viewer.family.id, [{ recipeId: r.id, scale: 1 }]), "meal_plan", r.id);
    }
    const day = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
    await logActivity(db, viewer.family.id, viewer.member.id, "meal.planned", `added ${r.name} to ${day} ${slot}`, { module: "meals" });
    revalidateRecipes();
    return ok(`Planned for ${day}${added ? ` · ${added} item${added === 1 ? "" : "s"} added to shopping` : ""}.`);
  });
}

export async function saveCollection(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("recipes", "edit");
    const name = f.str(fd, "name");
    if (!name) return fail("Name the collection.", "name");
    const id = f.str(fd, "id");
    if (id) await db.update(recipeCollections).set({ name, description: f.str(fd, "description") }).where(and(eq(recipeCollections.id, id), eq(recipeCollections.familyId, viewer.family.id)));
    else await db.insert(recipeCollections).values({ familyId: viewer.family.id, name, description: f.str(fd, "description") });
    revalidateRecipes();
    return ok();
  });
}

export async function deleteCollection(fd: FormData) {
  const viewer = await requireModule("recipes", "edit");
  await db.delete(recipeCollections).where(and(eq(recipeCollections.id, String(fd.get("id"))), eq(recipeCollections.familyId, viewer.family.id)));
  revalidateRecipes();
  redirect("/recipes/collections");
}
