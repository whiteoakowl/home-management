"use server";

import { parseRecipeText, type ImportedRecipe } from "@/lib/recipe-import";
import { readRecipeUrl, saveImportedRecipe } from "@/lib/recipe-url";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { mealPlanEntries, mealSlot, recipeCollectionItems, recipeCollections, recipeIngredients, recipeRatings, recipes } from "@/db/schema";
import { isNull } from "drizzle-orm";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { AuthorizationError, getViewer, type Viewer } from "@/lib/dal";
import { assertChange, ownerForNew } from "@/lib/food-space";
import { logActivity } from "@/lib/family";
import { deleteFamilyFile, saveUpload } from "@/lib/files";
import { parseIngredientBlock } from "@/lib/ingredients";
import { parseDuration } from "@/lib/recipe-doc";
import { addNeedsToShopping, missingFor } from "@/lib/kitchen";
import { f } from "@/lib/records";

function revalidateRecipes() {
  revalidatePath("/recipes", "layout");
  revalidatePath("/meals");
  revalidatePath("/shopping", "layout");
  revalidatePath("/");
}

/** A recipe the viewer may see: family recipes (with Recipes access) or their own private ones. */
async function ownRecipe(viewer: Viewer, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new AuthorizationError("Recipe not found.");
  const [r] = await db.select().from(recipes).where(and(eq(recipes.id, id), eq(recipes.familyId, viewer.family.id)));
  if (!r || (r.ownerMemberId ? r.ownerMemberId !== viewer.member.id : !viewer.can("recipes"))) throw new AuthorizationError("Recipe not found.");
  return r;
}

/** Collections in the same space as the recipe (family or the same private space). */
const sameSpace = (owner: string | null) => (owner ? eq(recipeCollections.ownerMemberId, owner) : isNull(recipeCollections.ownerMemberId));

export async function saveRecipe(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await getViewer();
    const name = f.str(fd, "name");
    if (!name) return fail("Name your recipe.", "name");
    const editing = f.str(fd, "id") ? await ownRecipe(viewer, f.str(fd, "id")!) : null;
    if (editing) assertChange(viewer, "recipes", editing);
    const owner = editing ? editing.ownerMemberId : ownerForNew(viewer, "recipes", fd);
    const ingredientLines = String(fd.get("ingredients") ?? "").split("\n");
    // "Batter:" / "For the glaze:" lines title the ingredients below them.
    const parsed = parseIngredientBlock(ingredientLines);
    // Times are kept as written ("35-40 minutes"); the longest time in minutes is kept for planning.
    const prepTime = f.str(fd, "prepTime")?.slice(0, 60) ?? null;
    const cookTime = f.str(fd, "cookTime")?.slice(0, 60) ?? null;
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
      prepTime,
      cookTime,
      prepMinutes: prepTime ? parseDuration(prepTime) : null,
      cookMinutes: cookTime ? parseDuration(cookTime) : null,
      servings: f.int(fd, "servings"),
      temperature: f.str(fd, "temperature")?.slice(0, 80) ?? null,
      recipeBy: f.str(fd, "recipeBy")?.slice(0, 120) ?? null,
      makingSince: f.str(fd, "makingSince")?.slice(0, 60) ?? null,
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
        const old = editing!;
        await tx.update(recipes).set(f.bool(fd, "removeImage") && !image ? { ...values, imageFileId: null } : values).where(eq(recipes.id, id));
        if ((image || f.bool(fd, "removeImage")) && old.imageFileId) await deleteFamilyFile(viewer.family.id, old.imageFileId);
        await tx.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, id));
        await tx.delete(recipeCollectionItems).where(eq(recipeCollectionItems.recipeId, id));
      } else {
        const [row] = await tx.insert(recipes).values({ ...values, ownerMemberId: owner, createdByMemberId: viewer.member.id }).returning({ id: recipes.id });
        recipeId = row!.id;
      }
      if (parsed.length) {
        await tx.insert(recipeIngredients).values(
          parsed.map((p, position) => ({ recipeId: recipeId!, name: p.name, section: p.section, original: p.original, quantity: p.quantity !== null ? String(p.quantity) : null, unit: p.unit, optional: p.optional, position })),
        );
      }
      if (collections.length) {
        const owned = await tx
          .select({ id: recipeCollections.id })
          .from(recipeCollections)
          .where(and(eq(recipeCollections.familyId, viewer.family.id), sameSpace(owner), inArray(recipeCollections.id, collections)));
        if (owned.length) await tx.insert(recipeCollectionItems).values(owned.map((c) => ({ collectionId: c.id, recipeId: recipeId! })));
      }
    });
    if (!id && !owner) await logActivity(db, viewer.family.id, viewer.member.id, "recipe.added", `added the recipe "${name}"`, { module: "recipes", entityId: recipeId! });
    revalidateRecipes();
    if (!id) redirect(`/recipes/${recipeId}`);
    return ok("Saved.");
  });
}

export async function deleteRecipe(fd: FormData) {
  const viewer = await getViewer();
  const r = await ownRecipe(viewer, String(fd.get("id")));
  assertChange(viewer, "recipes", r);
  await db.delete(recipes).where(eq(recipes.id, r.id));
  await deleteFamilyFile(viewer.family.id, r.imageFileId);
  revalidateRecipes();
  redirect(r.ownerMemberId ? "/recipes?space=mine" : "/recipes");
}

/** Delete several recipes at once (Select → Delete selected). Each is checked like a single delete. */
export async function deleteRecipes(ids: string[]): Promise<{ deleted: number; skipped: number }> {
  const viewer = await getViewer();
  let deleted = 0;
  let skipped = 0;
  let family = 0;
  for (const id of [...new Set(ids)].slice(0, 500)) {
    try {
      const r = await ownRecipe(viewer, id);
      assertChange(viewer, "recipes", r);
      await db.delete(recipes).where(eq(recipes.id, r.id));
      await deleteFamilyFile(viewer.family.id, r.imageFileId);
      deleted++;
      if (!r.ownerMemberId) family++;
    } catch {
      skipped++; // not found, or not theirs to delete
    }
  }
  if (deleted) revalidateRecipes();
  // Only family recipes go in the family activity feed (private ones stay private).
  if (family) await logActivity(db, viewer.family.id, viewer.member.id, "recipe.deleted", `deleted ${family} recipe${family === 1 ? "" : "s"}`, { module: "recipes" });
  return { deleted, skipped };
}

export async function toggleFavorite(fd: FormData) {
  const viewer = await getViewer();
  const r = await ownRecipe(viewer, String(fd.get("id")));
  assertChange(viewer, "recipes", r);
  await db.update(recipes).set({ isFavorite: !r.isFavorite }).where(eq(recipes.id, r.id));
  revalidateRecipes();
}

export async function rateRecipe(fd: FormData) {
  const viewer = await getViewer();
  const r = await ownRecipe(viewer, String(fd.get("id")));
  const rating = Math.max(1, Math.min(5, Number(fd.get("rating")) || 0));
  await db
    .insert(recipeRatings)
    .values({ recipeId: r.id, memberId: viewer.member.id, rating })
    .onConflictDoUpdate({ target: [recipeRatings.recipeId, recipeRatings.memberId], set: { rating } });
  revalidateRecipes();
}

/** Recipe → missing ingredients → shopping list. */
export async function addRecipeToShopping(fd: FormData) {
  const viewer = await getViewer();
  const r = await ownRecipe(viewer, String(fd.get("id")));
  // Private recipes shop from the private pantry onto My Shopping List; family recipes onto the family list.
  if (!r.ownerMemberId && !viewer.can("shopping", "add")) throw new AuthorizationError("You can't add to the family shopping list.");
  const scale = Math.max(0.25, Number(fd.get("scale")) || 1);
  const needs = await missingFor(viewer.family.id, [{ recipeId: r.id, scale }], r.ownerMemberId);
  const n = await addNeedsToShopping(viewer.family.id, needs, "recipe", r.id, r.ownerMemberId);
  if (n && !r.ownerMemberId) await logActivity(db, viewer.family.id, viewer.member.id, "shopping.recipe", `added ${n} item${n === 1 ? "" : "s"} for ${r.name} to the shopping list`, { module: "shopping" });
  revalidateRecipes();
}

const SLOTS = mealSlot.enumValues;

/** Recipe → meal plan (optionally adding missing ingredients to shopping). */
export async function planRecipe(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await getViewer();
    const r = await ownRecipe(viewer, String(fd.get("id")));
    // Plans go in the recipe's space; a family recipe can also go on your private plan.
    const owner = r.ownerMemberId ?? (fd.get("space") === "mine" ? ownerForNew(viewer, "meals", fd) : null);
    if (!owner && !viewer.can("meals", "add")) throw new AuthorizationError("You can't add to the family meal plan.");
    const date = f.date(fd, "date");
    const slot = String(fd.get("slot")) as (typeof SLOTS)[number];
    if (!date) return fail("Pick a day.", "date");
    if (!SLOTS.includes(slot)) return fail("Pick a meal.", "slot");
    await db.insert(mealPlanEntries).values({ familyId: viewer.family.id, date, slot, recipeId: r.id, servings: r.servings, createdByMemberId: viewer.member.id, ownerMemberId: owner });
    let added = 0;
    if (f.bool(fd, "addMissing") && (owner || viewer.can("shopping", "add"))) {
      added = await addNeedsToShopping(viewer.family.id, await missingFor(viewer.family.id, [{ recipeId: r.id, scale: 1 }], owner), "meal_plan", r.id, owner);
    }
    const day = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
    if (!owner) await logActivity(db, viewer.family.id, viewer.member.id, "meal.planned", `added ${r.name} to ${day} ${slot}`, { module: "meals" });
    revalidateRecipes();
    return ok(`Planned for ${day}${added ? ` · ${added} item${added === 1 ? "" : "s"} added to shopping` : ""}.`);
  });
}

export async function saveCollection(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await getViewer();
    const name = f.str(fd, "name");
    if (!name) return fail("Name the collection.", "name");
    const id = f.str(fd, "id");
    if (id) {
      const c = await ownCollection(viewer, id);
      assertChange(viewer, "recipes", { ownerMemberId: c.ownerMemberId });
      await db.update(recipeCollections).set({ name, description: f.str(fd, "description") }).where(eq(recipeCollections.id, c.id));
    } else {
      const owner = ownerForNew(viewer, "recipes", fd);
      await db.insert(recipeCollections).values({ familyId: viewer.family.id, name, description: f.str(fd, "description"), ownerMemberId: owner });
    }
    revalidateRecipes();
    return ok();
  });
}

export async function deleteCollection(fd: FormData) {
  const viewer = await getViewer();
  const c = await ownCollection(viewer, String(fd.get("id")));
  assertChange(viewer, "recipes", { ownerMemberId: c.ownerMemberId });
  await db.delete(recipeCollections).where(eq(recipeCollections.id, c.id));
  revalidateRecipes();
  redirect(c.ownerMemberId ? "/recipes/collections?space=mine" : "/recipes/collections");
}

async function ownCollection(viewer: Viewer, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new AuthorizationError("Collection not found.");
  const [c] = await db.select().from(recipeCollections).where(and(eq(recipeCollections.id, id), eq(recipeCollections.familyId, viewer.family.id)));
  if (!c || (c.ownerMemberId ? c.ownerMemberId !== viewer.member.id : !viewer.can("recipes"))) throw new AuthorizationError("Collection not found.");
  return c;
}

/**
 * Import a recipe from a web page (schema.org Recipe) or pasted text. Creates
 * the recipe, then opens it so the family can review and edit.
 */
export async function importRecipe(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await getViewer();
    const owner = ownerForNew(viewer, "recipes", fd);
    const url = f.str(fd, "url");
    const text = f.str(fd, "text");
    let parsed: ImportedRecipe | null = null;
    if (url) {
      const read = await readRecipeUrl(url);
      if ("error" in read) return fail(`${read.error} You can paste the recipe text instead.`, "url");
      parsed = read.recipe;
    } else if (text) {
      parsed = parseRecipeText(text);
      if (!parsed) return fail("Couldn't find ingredients or steps. Put each on its own line.", "text");
    } else return fail("Paste a link or the recipe text.", "url");

    const saved = await saveImportedRecipe(viewer, parsed, owner);
    const recipeId = saved.id;
    if (!owner) await logActivity(db, viewer.family.id, viewer.member.id, "recipe.added", `imported the recipe "${parsed.name}"`, { module: "recipes", entityId: recipeId });
    revalidateRecipes();
    redirect(`/recipes/${recipeId}?imported=1`);
  });
}
