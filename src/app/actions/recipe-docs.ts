"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { db } from "@/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { recipeCollectionItems, recipeCollections, recipeIngredients, recipes } from "@/db/schema";
import { fail, guard } from "@/lib/action-state";
import { AuthorizationError, getViewer } from "@/lib/dal";
import { logActivity } from "@/lib/family";
import { saveUpload } from "@/lib/files";
import { canOpenFood, hasPrivateFood, ownerForNew } from "@/lib/food-space";
import { parseIngredientBlock } from "@/lib/ingredients";
import { ownedCategoryId } from "@/lib/queries";
import { recipesFromDocx, type DocRecipe } from "@/lib/recipe-doc";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Step 1: read a Word document and return one recipe per page for review (nothing is saved). */
export async function readRecipeDocument(fd: FormData): Promise<{ ok: true; recipes: DocRecipe[]; pages: number } | { ok: false; message: string }> {
  const viewer = await getViewer();
  if (!viewer.can("recipes", "add") && !hasPrivateFood(viewer)) return { ok: false, message: "You can't add recipes yet. Ask a parent." };
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false, message: "Choose a Word document (.docx)." };
  if (file.size > 10_000_000) return { ok: false, message: "That document is over 10 MB." };
  if (!/\.docx$/i.test(file.name) && file.type !== DOCX) {
    return { ok: false, message: /\.doc$/i.test(file.name) ? "That's an older .doc file. Open it in Word and use Save As → Word Document (.docx), then upload it again." : "Choose a Word document (.docx)." };
  }
  try {
    const { recipes: found, pages } = recipesFromDocx(Buffer.from(await file.arrayBuffer()));
    if (!found.length) return { ok: false, message: `We read ${pages} page${pages === 1 ? "" : "s"} but didn't find any recipes (we look for ingredients and steps on each page).` };
    return { ok: true, recipes: found, pages };
  } catch (e) {
    return { ok: false, message: (e as Error).message || "We couldn't read that document." };
  }
}

const Recipe = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).nullable(),
  ingredients: z.array(z.string().trim().min(1).max(300)).max(200),
  instructions: z.array(z.string().trim().min(1).max(4000)).max(200),
  prepMinutes: z.number().int().min(0).max(10000).nullable(),
  cookMinutes: z.number().int().min(0).max(10000).nullable(),
  totalMinutes: z.number().int().min(0).max(10000).nullable(),
  servings: z.number().int().min(1).max(500).nullable(),
  notes: z.string().max(4000).nullable(),
  source: z.string().max(200).nullable(),
  categoryId: z.string().nullable(),
  prepTime: z.string().max(60).nullable().default(null),
  cookTime: z.string().max(60).nullable().default(null),
  temperature: z.string().max(80).nullable().default(null),
  recipeBy: z.string().max(120).nullable().default(null),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  imageIndex: z.number().int().min(0).max(200).nullable(),
});

export type ImportBatchResult = { ok: true; created: number; collectionId: string | null } | { ok: false; message: string };

/**
 * Step 2: save the reviewed recipes to Family Recipes or My Private Recipes,
 * optionally into a collection (an existing one, or a new one by name).
 * The page sends a few recipes per request so no single request runs long on
 * the host; the first batch creates a new collection and later batches reuse it.
 */
export async function importDocumentRecipes(fd: FormData): Promise<ImportBatchResult> {
  const res = await guard(async () => {
    const viewer = await getViewer();
    if (!canOpenFood(viewer, "recipes")) throw new AuthorizationError("You can't add recipes.");
    const owner = ownerForNew(viewer, "recipes", fd);
    let raw: unknown;
    try {
      raw = JSON.parse(String(fd.get("recipes") ?? "[]"));
    } catch {
      return fail("The recipes couldn't be read. Try again.");
    }
    const parsed = z.array(Recipe).min(1, "Select at least one recipe.").max(100).safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const which = typeof issue?.path[0] === "number" ? (raw as { name?: string }[])[issue.path[0]]?.name : null;
      return fail(`${which ? `“${which}”: ` : ""}${issue?.path[1] ? `${String(issue.path[1])} ` : ""}${issue?.message ?? "Check the recipes and try again."}`);
    }

    // Collection: an existing one in the same space, or create one by name.
    let collectionId: string | null = null;
    const wantId = String(fd.get("collectionId") ?? "");
    const newName = String(fd.get("newCollection") ?? "").trim().slice(0, 120);
    if (wantId) {
      const [c] = await db
        .select({ id: recipeCollections.id })
        .from(recipeCollections)
        .where(and(eq(recipeCollections.id, wantId), eq(recipeCollections.familyId, viewer.family.id), owner ? eq(recipeCollections.ownerMemberId, owner) : isNull(recipeCollections.ownerMemberId)));
      if (!c) return fail("That collection isn't available here. Choose another.");
      collectionId = c.id;
    } else if (newName) {
      const [c] = await db.insert(recipeCollections).values({ familyId: viewer.family.id, name: newName, ownerMemberId: owner }).returning({ id: recipeCollections.id });
      collectionId = c!.id;
    }
    const startPos = collectionId ? ((await db.select({ n: sql<number>`count(*)::int` }).from(recipeCollectionItems).where(eq(recipeCollectionItems.collectionId, collectionId)))[0]?.n ?? 0) : 0;

    let created = 0;
    for (const r of parsed.data) {
      const image = r.imageIndex !== null ? await saveUpload(viewer, fd.get(`image-${r.imageIndex}`)) : null;
      const lines = parseIngredientBlock(r.ingredients);
      const categoryId = await ownedCategoryId(viewer, "recipe", r.categoryId);
      await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(recipes)
          .values({
            familyId: viewer.family.id,
            name: r.name,
            description: r.description,
            instructions: r.instructions,
            prepMinutes: r.prepMinutes,
            cookMinutes: r.cookMinutes,
            prepTime: r.prepTime,
            cookTime: r.cookTime,
            temperature: r.temperature,
            recipeBy: r.recipeBy,
            totalMinutes: r.totalMinutes,
            servings: r.servings,
            notes: r.notes,
            source: r.source,
            categoryId,
            tags: r.tags.map((t) => t.toLowerCase()),
            imageFileId: image,
            ownerMemberId: owner,
            createdByMemberId: viewer.member.id,
          })
          .returning({ id: recipes.id });
        if (lines.length) {
          await tx.insert(recipeIngredients).values(lines.map((p, position) => ({ recipeId: row!.id, name: p.name, section: p.section, original: p.original, quantity: p.quantity !== null ? String(p.quantity) : null, unit: p.unit, optional: p.optional, position })));
        }
        if (collectionId) await tx.insert(recipeCollectionItems).values({ collectionId, recipeId: row!.id, position: startPos + created });
      });
      created++;
    }
    if (!owner && fd.get("last") === "1") {
      const total = Number(fd.get("total")) || created;
      await logActivity(db, viewer.family.id, viewer.member.id, "recipe.added", `imported ${total} recipe${total === 1 ? "" : "s"} from a Word document`, { module: "recipes" });
    }
    revalidatePath("/recipes", "layout");
    return { ok: true, message: JSON.stringify({ created, collectionId }) };
  });
  if (!res?.ok) return { ok: false, message: res?.message ?? "Those recipes couldn't be saved. Try again." };
  return { ok: true, ...(JSON.parse(res.message!) as { created: number; collectionId: string | null }) };
}
