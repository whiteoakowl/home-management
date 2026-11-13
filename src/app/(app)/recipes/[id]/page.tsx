import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Clock, Heart, Pencil, ShoppingBasket, Trash2, Users, X } from "lucide-react";
import { addRecipeToShopping, deleteRecipe, toggleFavorite } from "@/app/actions/recipes";
import { ActionButton } from "@/components/forms/inline";
import { PlanRecipeButton, PrintButton, StarRating } from "@/components/recipes/recipe-actions";
import { RecipeFormModal } from "@/components/recipes/recipe-form";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar, Badge } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { todayIn } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { checkIngredients, formatQty } from "@/lib/ingredients";
import { activeInventory } from "@/lib/kitchen";
import { dietChecker } from "@/lib/medical";
import { DietWarnings } from "@/components/medical/diet-warnings";
import { categoryOptions } from "@/lib/queries";
import { collectionOptions, getRecipe } from "@/lib/recipes";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Recipe" };

export default async function RecipePage({ params, searchParams }: PageProps<"/recipes/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const viewer = await getViewer();
  if (!viewer.can("recipes")) notFound();
  const data = await getRecipe(viewer, id);
  if (!data) notFound();
  const { r, categoryName, ingredients, ratings, collections } = data;
  const base = r.servings ?? null;
  const servings = Math.max(1, Math.min(50, Number(sp.servings) || base || 1));
  const scale = base ? servings / base : 1;
  const showPantry = viewer.can("kitchen");
  const [cats, cols, inventory, diet] = await Promise.all([categoryOptions(viewer, "recipe"), collectionOptions(viewer), showPantry ? activeInventory(viewer.family.id) : Promise.resolve([]), dietChecker(viewer)]);
  const warnings = diet ? diet.check(ingredients.map((i) => i.name)) : [];
  const flagged = new Set(warnings.map((w) => w.ingredient));
  const status = checkIngredients(ingredients, inventory, scale);
  const missing = status.filter((s) => !s.have && !s.optional).length;
  const mine = ratings.find((x) => x.memberId === viewer.member.id)?.rating ?? null;
  const avg = ratings.length ? ratings.reduce((s, x) => s + x.rating, 0) / ratings.length : null;
  const canEdit = viewer.can("recipes", "edit");
  const image = fileUrl(r.imageFileId);

  return (
    <article className="mx-auto flex max-w-5xl flex-col gap-6">
      <Link href="/recipes" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink print:hidden">
        <ArrowLeft className="size-4" /> Recipes
      </Link>

      <div className="grid gap-6 md:grid-cols-[1.1fr_1fr] md:items-center">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {categoryName && <Badge tone="primary">{categoryName}</Badge>}
            {r.tags.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </div>
          <h1 className="text-[34px] leading-tight font-semibold sm:text-[40px]">{r.name}</h1>
          {r.description && <p className="text-[17px] text-ink-soft">{r.description}</p>}
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-[15px] text-ink-soft">
            {r.prepMinutes ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4 text-muted" /> Prep {r.prepMinutes} min
              </span>
            ) : null}
            {r.cookMinutes ? <span>Cook {r.cookMinutes} min</span> : null}
            {base && (
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-4 text-muted" /> Serves
                <span className="inline-flex items-center rounded-full border border-line print:hidden">
                  <Link href={`?servings=${Math.max(1, servings - 1)}`} className="px-2.5 py-0.5 hover:bg-sunken" aria-label="Fewer servings">
                    −
                  </Link>
                  <span className="min-w-6 text-center font-semibold">{servings}</span>
                  <Link href={`?servings=${servings + 1}`} className="px-2.5 py-0.5 hover:bg-sunken" aria-label="More servings">
                    +
                  </Link>
                </span>
                <span className="hidden print:inline">{servings}</span>
              </span>
            )}
            {avg && <span>★ {avg.toFixed(1)} family rating</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1 print:hidden">
            {viewer.can("meals", "edit") && <PlanRecipeButton recipeId={r.id} today={todayIn(viewer.family.timezone)} canShop={viewer.can("shopping", "edit")} />}
            {canEdit && (
              <ActionButton action={toggleFavorite} fields={{ id: r.id }} className={cn("h-11 rounded-[var(--radius-control)] border px-4 text-[15px] font-medium", r.isFavorite ? "border-wine-100 bg-wine-50 text-wine-700" : "border-line-strong bg-surface hover:bg-sunken")}>
                <Heart className={cn("size-4", r.isFavorite && "fill-current")} /> {r.isFavorite ? "Favorite" : "Mark favorite"}
              </ActionButton>
            )}
            <PrintButton />
            {canEdit && (
              <>
                <RecipeFormModal
                  categories={cats}
                  collections={cols}
                  triggerContent={
                    <>
                      <Pencil className="size-4" /> Edit
                    </>
                  }
                  defaults={{
                    id: r.id,
                    name: r.name,
                    description: r.description,
                    ingredients: ingredients.map((i) => i.original ?? `${i.quantity ?? ""} ${i.unit ?? ""} ${i.name}`.trim()).join("\n"),
                    instructions: r.instructions.join("\n"),
                    prepMinutes: r.prepMinutes,
                    cookMinutes: r.cookMinutes,
                    servings: r.servings,
                    categoryId: r.categoryId,
                    tags: r.tags,
                    notes: r.notes,
                    source: r.source,
                    isFavorite: r.isFavorite,
                    imageUrl: image,
                    collections: collections.map((c) => c.id),
                  }}
                />
                <ActionButton action={deleteRecipe} fields={{ id: r.id }} confirm={`Delete "${r.name}"?`} label="Delete recipe" className="size-9 rounded-lg text-muted hover:bg-wine-50 hover:text-wine-500">
                  <Trash2 className="size-4" />
                </ActionButton>
              </>
            )}
          </div>
        </div>
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={r.name} className="aspect-[4/3] w-full rounded-[var(--radius-card)] object-cover shadow-[var(--shadow-card)]" />
        )}
      </div>

      {diet && <DietWarnings warnings={warnings} hasRules={diet.hasRules} />}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card className="h-fit">
          <CardHeader
            title={`Ingredients${scale !== 1 ? ` (×${formatQty(scale)})` : ""}`}
            action={
              showPantry && ingredients.length > 0 ? (
                <Badge tone={missing ? "olive" : "primary"}>{missing ? `${missing} missing` : "All in stock"}</Badge>
              ) : undefined
            }
          />
          {ingredients.length === 0 ? (
            <p className="text-muted">No ingredients listed.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {status.map((s, i) => (
                <li key={i} className="flex items-start gap-3 text-[15px]">
                  {showPantry ? (
                    <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full print:hidden", s.have ? "bg-primary-100 text-primary-700" : s.optional ? "bg-sunken text-muted" : "bg-olive-100 text-olive-700")} title={s.have ? `In stock: ${s.matchedItem}` : "Not in stock"}>
                      {s.have ? <Check className="size-3.5" strokeWidth={3} /> : <X className="size-3.5" strokeWidth={3} />}
                    </span>
                  ) : (
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary-400" aria-hidden />
                  )}
                  <span className="flex-1">
                    {s.quantity !== null && <strong className="font-semibold">{formatQty(s.quantity)} </strong>}
                    {s.unit && `${s.unit} `}
                    <span className={cn(flagged.has(s.name) && "rounded bg-wine-50 px-1 font-semibold text-wine-700")}>{s.name}</span>
                    {flagged.has(s.name) && <span className="sr-only"> (allergy or diet warning)</span>}
                    {s.optional && <span className="text-muted"> (optional)</span>}
                    {s.shortBy !== null && <span className="block text-xs text-olive-700">Need {formatQty(s.shortBy)} more {s.unit ?? ""}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {showPantry && missing > 0 && viewer.can("shopping", "edit") && (
            <ActionButton action={addRecipeToShopping} fields={{ id: r.id, scale }} className="mt-5 h-10 w-full rounded-[var(--radius-control)] bg-primary-50 text-sm font-semibold text-primary-700 hover:bg-primary-100 print:hidden">
              <ShoppingBasket className="size-4" /> Add {missing} missing to shopping list
            </ActionButton>
          )}
        </Card>

        <Card>
          <CardHeader title="Instructions" />
          {r.instructions.length === 0 ? (
            <p className="text-muted">No instructions yet.</p>
          ) : (
            <ol className="flex flex-col gap-4">
              {r.instructions.map((step, i) => (
                <li key={i} className="flex gap-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white">{i + 1}</span>
                  <p className="pt-1 text-[16px] leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
          )}
          {r.notes && <p className="mt-5 rounded-xl bg-sunken/60 p-4 text-[15px] whitespace-pre-line text-ink-soft">{r.notes}</p>}
          {r.source && <p className="mt-3 text-sm text-muted">Source: {r.source}</p>}
        </Card>
      </div>

      <Card className="flex flex-col gap-4 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <StarRating recipeId={r.id} value={mine} />
        {ratings.length > 0 && (
          <ul className="flex flex-wrap gap-3">
            {ratings.map((x) => (
              <li key={x.memberId} className="flex items-center gap-1.5 text-sm">
                <Avatar name={x.name} color={x.color} size="xs" /> {"★".repeat(x.rating)}
              </li>
            ))}
          </ul>
        )}
        {collections.length > 0 && (
          <p className="text-sm text-muted">
            In:{" "}
            {collections.map((c, i) => (
              <span key={c.id}>
                {i > 0 && ", "}
                <Link href={`/recipes/collections/${c.id}`} className="font-medium text-primary-600 hover:underline">
                  {c.name}
                </Link>
              </span>
            ))}
          </p>
        )}
      </Card>
    </article>
  );
}
