import "server-only";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { inventoryEvents, inventoryItems, listItems, recipeIngredients, recipes } from "@/db/schema";
import { mainShoppingListId } from "./automation";
import { checkIngredients, formatQty, normalizeName } from "./ingredients";

export async function activeInventory(familyId: string) {
  return db
    .select({ id: inventoryItems.id, name: inventoryItems.name, quantity: inventoryItems.quantity, unit: inventoryItems.unit })
    .from(inventoryItems)
    .where(and(eq(inventoryItems.familyId, familyId), isNull(inventoryItems.archivedAt)));
}

export async function ingredientsFor(recipeIds: string[]) {
  if (!recipeIds.length) return [];
  return db.select().from(recipeIngredients).where(inArray(recipeIngredients.recipeId, recipeIds)).orderBy(asc(recipeIngredients.position));
}

/** Ingredient-by-ingredient availability for one recipe. */
export async function recipeAvailability(familyId: string, recipeId: string, scale = 1) {
  const [ings, inv] = await Promise.all([ingredientsFor([recipeId]), activeInventory(familyId)]);
  return checkIngredients(ings, inv, scale);
}

type Need = { name: string; quantity: number | null; unit: string | null };

/** Combine identical ingredients across recipes (same name + unit). */
export function aggregateNeeds(needs: Need[]): Need[] {
  const map = new Map<string, Need>();
  for (const n of needs) {
    const key = `${normalizeName(n.name)}|${n.unit ?? ""}`;
    const cur = map.get(key);
    if (cur) cur.quantity = cur.quantity !== null && n.quantity !== null ? cur.quantity + n.quantity : (cur.quantity ?? n.quantity);
    else map.set(key, { ...n });
  }
  return [...map.values()];
}

/**
 * Add missing ingredients to the family's main shopping list, skipping items
 * already on it (unchecked). Returns how many were added.
 */
export async function addNeedsToShopping(familyId: string, needs: Need[], source: "recipe" | "meal_plan", sourceId: string | null) {
  if (!needs.length) return 0;
  const listId = await mainShoppingListId(familyId);
  const existing = await db
    .select({ text: listItems.text })
    .from(listItems)
    .where(and(eq(listItems.listId, listId), eq(listItems.checked, false)));
  const have = new Set(existing.map((e) => normalizeName(e.text)));
  const [{ max } = { max: 0 }] = await db.select({ max: sql<number>`coalesce(max(${listItems.position}),0)::int` }).from(listItems).where(eq(listItems.listId, listId));
  const rows = aggregateNeeds(needs)
    .filter((n) => !have.has(normalizeName(n.name)))
    .map((n, i) => ({
      listId,
      text: n.name.charAt(0).toUpperCase() + n.name.slice(1),
      quantity: n.quantity !== null ? String(Math.round(n.quantity * 100) / 100) : null,
      unit: n.unit,
      source,
      sourceId,
      shoppingCategory: null,
      position: max + 1 + i,
    }));
  if (rows.length) await db.insert(listItems).values(rows);
  return rows.length;
}

/** Missing ingredients for a set of recipes (with servings scaling). */
export async function missingFor(familyId: string, entries: { recipeId: string; scale: number }[]) {
  const ids = [...new Set(entries.map((e) => e.recipeId))];
  const [ings, inv] = await Promise.all([ingredientsFor(ids), activeInventory(familyId)]);
  const byRecipe = Map.groupBy(ings, (i) => i.recipeId);
  const needs: Need[] = [];
  for (const e of entries) {
    const status = checkIngredients(byRecipe.get(e.recipeId) ?? [], inv, e.scale);
    for (const s of status) {
      if (s.have || s.optional) continue;
      needs.push({ name: s.name, quantity: s.shortBy ?? s.quantity, unit: s.unit });
    }
  }
  return aggregateNeeds(needs);
}

export async function recipeServings(ids: string[]) {
  if (!ids.length) return new Map<string, number | null>();
  const rows = await db.select({ id: recipes.id, servings: recipes.servings }).from(recipes).where(inArray(recipes.id, ids));
  return new Map(rows.map((r) => [r.id, r.servings]));
}

export { formatQty };

/**
 * Add produce to the kitchen (garden harvest, farm production, shopping):
 * merges with an active item of the same name & unit, else creates one.
 */
export async function addToInventory(
  familyId: string,
  item: { name: string; quantity: number; unit: string | null; location: (typeof inventoryItems.$inferInsert)["location"]; today: string },
  meta: { source: "garden_harvest" | "farm_production" | "shopping" | "manual"; sourceId: string | null; memberId: string | null },
) {
  const current = await db
    .select()
    .from(inventoryItems)
    .where(and(eq(inventoryItems.familyId, familyId), isNull(inventoryItems.archivedAt)));
  const match = current.find((c) => normalizeName(c.name) === normalizeName(item.name) && (c.unit ?? "") === (item.unit ?? ""));
  let itemId: string;
  if (match) {
    await db.update(inventoryItems).set({ quantity: String(Number(match.quantity) + item.quantity), purchasedOn: item.today }).where(eq(inventoryItems.id, match.id));
    itemId = match.id;
  } else {
    const [row] = await db
      .insert(inventoryItems)
      .values({ familyId, name: item.name, quantity: String(item.quantity), unit: item.unit, location: item.location ?? "pantry", purchasedOn: item.today })
      .returning({ id: inventoryItems.id });
    itemId = row!.id;
  }
  await db.insert(inventoryEvents).values({ familyId, itemId, kind: "added", quantityDelta: String(item.quantity), source: meta.source, sourceId: meta.sourceId, memberId: meta.memberId });
  return itemId;
}
