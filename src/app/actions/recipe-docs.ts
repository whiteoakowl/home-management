"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { db } from "@/db";
import { recipeIngredients, recipes } from "@/db/schema";
import { fail, guard, type ActionState } from "@/lib/action-state";
import { AuthorizationError, getViewer } from "@/lib/dal";
import { logActivity } from "@/lib/family";
import { saveUpload } from "@/lib/files";
import { canOpenFood, hasPrivateFood, ownerForNew } from "@/lib/food-space";
import { parseIngredientLine } from "@/lib/ingredients";
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
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  imageIndex: z.number().int().min(0).max(200).nullable(),
});

/** Step 2: save the reviewed recipes to Family Recipes or My Private Recipes. */
export async function importDocumentRecipes(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
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
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the recipes and try again.");
    let created = 0;
    for (const r of parsed.data) {
      const image = r.imageIndex !== null ? await saveUpload(viewer, fd.get(`image-${r.imageIndex}`)) : null;
      const lines = r.ingredients.map(parseIngredientLine).filter((x): x is NonNullable<typeof x> => !!x);
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
            totalMinutes: r.totalMinutes,
            servings: r.servings,
            notes: r.notes,
            source: r.source,
            categoryId: await ownedCategoryId(viewer, "recipe", r.categoryId),
            tags: r.tags.map((t) => t.toLowerCase()),
            imageFileId: image,
            ownerMemberId: owner,
            createdByMemberId: viewer.member.id,
          })
          .returning({ id: recipes.id });
        if (lines.length) {
          await tx.insert(recipeIngredients).values(lines.map((p, position) => ({ recipeId: row!.id, name: p.name, original: p.original, quantity: p.quantity !== null ? String(p.quantity) : null, unit: p.unit, optional: p.optional, position })));
        }
      });
      created++;
    }
    if (!owner) await logActivity(db, viewer.family.id, viewer.member.id, "recipe.added", `imported ${created} recipe${created === 1 ? "" : "s"} from a Word document`, { module: "recipes" });
    revalidatePath("/recipes", "layout");
    redirect(owner ? `/recipes?space=mine&imported=${created}` : `/recipes?imported=${created}`);
  });
}
