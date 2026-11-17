import "server-only";
import { db } from "@/db";
import { recipeIngredients, recipes } from "@/db/schema";
import type { Viewer } from "./dal";
import { saveUpload } from "./files";
import { parseIngredientBlock } from "./ingredients";
import { parseRecipeHtml, type ImportedRecipe } from "./recipe-import";
import { safeFetch } from "./safe-fetch";

/**
 * Save an imported recipe (from a website or pasted text): ingredients (with
 * sections), steps, times, servings and photo. Returns the new recipe.
 * owner = a member's private recipes; null = the family's.
 */
export async function saveImportedRecipe(viewer: Viewer, parsed: ImportedRecipe, owner: string | null) {
  let imageFileId: string | null = null;
  if (parsed.imageUrl) {
    try {
      const img = await safeFetch(parsed.imageUrl, { maxBytes: 8_000_000, accept: "image/*" });
      const type = img.contentType.split(";")[0]!.trim();
      if (type.startsWith("image/")) imageFileId = await saveUpload(viewer, new File([new Uint8Array(img.body)], "recipe", { type }));
    } catch {
      // The recipe still imports without its photo.
    }
  }
  const lines = parseIngredientBlock(parsed.ingredients);
  let id = "";
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(recipes)
      .values({
        familyId: viewer.family.id,
        name: parsed.name,
        description: parsed.description,
        instructions: parsed.instructions,
        prepMinutes: parsed.prepMinutes,
        cookMinutes: parsed.cookMinutes,
        servings: parsed.servings,
        tags: parsed.tags,
        source: parsed.source,
        imageFileId,
        ownerMemberId: owner,
        createdByMemberId: viewer.member.id,
      })
      .returning({ id: recipes.id });
    id = row!.id;
    if (lines.length) {
      await tx.insert(recipeIngredients).values(lines.map((p, position) => ({ recipeId: id, name: p.name, section: p.section, original: p.original, quantity: p.quantity !== null ? String(p.quantity) : null, unit: p.unit, optional: p.optional, position })));
    }
  });
  return { id, name: parsed.name, servings: parsed.servings, ingredientCount: lines.length };
}

/** Read a recipe web page. Returns the recipe, or a message to show if it couldn't be read. */
export async function readRecipeUrl(url: string): Promise<{ recipe: ImportedRecipe } | { error: string }> {
  if (!/^https?:\/\//i.test(url)) return { error: "Paste a full link starting with https://" };
  try {
    const page = await safeFetch(url);
    const recipe = parseRecipeHtml(page.body.toString("utf8"), page.url);
    return recipe ? { recipe } : { error: "No recipe found on that page." };
  } catch (e) {
    return { error: `Couldn't open that page (${(e as Error).message}).` };
  }
}
