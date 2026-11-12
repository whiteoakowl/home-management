import "server-only";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, familyMembers, recipeCollectionItems, recipeCollections, recipeIngredients, recipeRatings, recipes } from "@/db/schema";
import type { Viewer } from "./dal";
import { fileUrl } from "./files";
import type { RecipeCardData } from "@/components/recipes/recipe-card";

export async function listRecipes(
  viewer: Viewer,
  opts: { q?: string; categoryId?: string; favorites?: boolean; collectionId?: string; ids?: string[] } = {},
): Promise<(RecipeCardData & { description: string | null })[]> {
  const rows = await db
    .select({
      r: recipes,
      categoryName: categories.name,
      rating: sql<number | null>`(select avg(rating)::float from ${recipeRatings} rr where rr.recipe_id = ${recipes.id})`,
    })
    .from(recipes)
    .leftJoin(categories, eq(categories.id, recipes.categoryId))
    .where(
      and(
        eq(recipes.familyId, viewer.family.id),
        opts.q
          ? or(
              ilike(recipes.name, `%${opts.q}%`),
              sql`${opts.q.toLowerCase()} = any(${recipes.tags})`,
              inArray(recipes.id, db.select({ id: recipeIngredients.recipeId }).from(recipeIngredients).where(ilike(recipeIngredients.name, `%${opts.q}%`))),
            )
          : undefined,
        opts.categoryId ? eq(recipes.categoryId, opts.categoryId) : undefined,
        opts.favorites ? eq(recipes.isFavorite, true) : undefined,
        opts.collectionId
          ? inArray(recipes.id, db.select({ id: recipeCollectionItems.recipeId }).from(recipeCollectionItems).where(eq(recipeCollectionItems.collectionId, opts.collectionId)))
          : undefined,
        opts.ids ? inArray(recipes.id, opts.ids) : undefined,
      ),
    )
    .orderBy(desc(recipes.isFavorite), asc(recipes.name));
  return rows.map(({ r, categoryName, rating }) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    thumbUrl: fileUrl(r.imageFileId, true),
    totalMinutes: (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0) || null,
    servings: r.servings,
    isFavorite: r.isFavorite,
    rating,
    categoryName,
  }));
}

export async function getRecipe(viewer: Viewer, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db
    .select({ r: recipes, categoryName: categories.name, author: familyMembers.displayName })
    .from(recipes)
    .leftJoin(categories, eq(categories.id, recipes.categoryId))
    .leftJoin(familyMembers, eq(familyMembers.id, recipes.createdByMemberId))
    .where(and(eq(recipes.id, id), eq(recipes.familyId, viewer.family.id)));
  if (!row) return null;
  const [ings, ratings, cols] = await Promise.all([
    db.select().from(recipeIngredients).where(eq(recipeIngredients.recipeId, id)).orderBy(asc(recipeIngredients.position)),
    db
      .select({ memberId: recipeRatings.memberId, rating: recipeRatings.rating, name: familyMembers.displayName, color: familyMembers.color })
      .from(recipeRatings)
      .innerJoin(familyMembers, eq(familyMembers.id, recipeRatings.memberId))
      .where(eq(recipeRatings.recipeId, id)),
    db
      .select({ id: recipeCollections.id, name: recipeCollections.name })
      .from(recipeCollectionItems)
      .innerJoin(recipeCollections, eq(recipeCollections.id, recipeCollectionItems.collectionId))
      .where(eq(recipeCollectionItems.recipeId, id)),
  ]);
  return { ...row, ingredients: ings, ratings, collections: cols };
}

export async function collectionOptions(viewer: Viewer) {
  return db
    .select({
      id: recipeCollections.id,
      name: recipeCollections.name,
      description: recipeCollections.description,
      count: sql<number>`(select count(*)::int from ${recipeCollectionItems} i where i.collection_id = ${recipeCollections.id})`,
    })
    .from(recipeCollections)
    .where(eq(recipeCollections.familyId, viewer.family.id))
    .orderBy(asc(recipeCollections.name));
}

const DEFAULT_COLLECTIONS = ["Breakfast", "Dinner", "Desserts", "Holiday", "Family Favorites", "Slow Cooker", "Garden Recipes"];
const DEFAULT_RECIPE_CATEGORIES = ["Breakfast", "Lunch", "Dinner", "Sides", "Desserts", "Snacks", "Drinks"];

/** Seed suggested collections & categories on first visit (parents only). */
export async function ensureRecipeDefaults(viewer: Viewer) {
  if (!viewer.isParent) return;
  const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(recipeCollections).where(eq(recipeCollections.familyId, viewer.family.id));
  if (n === 0) await db.insert(recipeCollections).values(DEFAULT_COLLECTIONS.map((name) => ({ familyId: viewer.family.id, name })));
  const [{ c } = { c: 0 }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(categories)
    .where(and(eq(categories.familyId, viewer.family.id), eq(categories.domain, "recipe")));
  if (c === 0) await db.insert(categories).values(DEFAULT_RECIPE_CATEGORIES.map((name, i) => ({ familyId: viewer.family.id, domain: "recipe" as const, name, sortOrder: i })));
}
