import { cloneElement } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, FileText, Heart, Library, Search } from "lucide-react";
import { RecipeGrid } from "@/components/recipes/recipe-grid";
import { RecipeFormModal } from "@/components/recipes/recipe-form";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { ImportRecipeModal } from "@/components/recipes/import-modal";
import { getViewer } from "@/lib/dal";
import { redirect } from "next/navigation";
import { FoodSpaceNav, PrivateSpaceNote } from "@/components/food/food-space-nav";
import { canAddIn, canChange, canOpenFood, privateSpaceMembers, resolveSpace, withSpace } from "@/lib/food-space";
import { collectionOptions, ensureRecipeDefaults, listRecipes } from "@/lib/recipes";

export const metadata: Metadata = { title: "Family Recipes" };

export default async function RecipesPage({ searchParams }: PageProps<"/recipes">) {
  const viewer = await getViewer();
  if (!canOpenFood(viewer, "recipes")) notFound();
  const sp = await searchParams;
  const space = await resolveSpace(viewer, sp.space);
  if (space.kind === "family" && !viewer.can("recipes")) redirect("/recipes?space=mine");
  const isPrivate = space.kind === "private";
  const owner = isPrivate ? space.memberId : null;
  if (!isPrivate) await ensureRecipeDefaults(viewer);
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const favorites = sp.favorites === "1";
  // Recipes are grouped with Collections (categories were removed from recipes).
  const [cols, items] = await Promise.all([collectionOptions(viewer, owner), listRecipes(viewer, { q: q || undefined, favorites, owner })]);
  const canEdit = canAddIn(viewer, "recipes", space);
  const add = <RecipeFormModal collections={cols} defaultOpen={sp.new === "1"} privateSpace={isPrivate} />;
  const href = (p: Record<string, string>) => withSpace(`/recipes?${new URLSearchParams({ ...(q ? { q } : {}), ...(favorites ? { favorites: "1" } : {}), ...p })}`, space);
  const others = await privateSpaceMembers(viewer);

  return (
    <>
      <PageHeader help="recipes"
        eyebrow={isPrivate ? "My private food" : "Family Pantry"}
        title={isPrivate ? (space.own ? "My Recipes" : `${space.memberName}'s Recipes`) : "Family Recipes"}
        description={isPrivate ? "Recipes only you can see." : "Your family's recipe book."}
        actions={
          <>
            {canEdit && <ImportRecipeModal defaultOpen={sp.import === "1"} privateSpace={isPrivate} />}
            {canEdit && (
              <ButtonLink href="/recipes/import-word" variant="secondary" icon={<FileText className="size-4" />}>
                From Word
              </ButtonLink>
            )}
            <ButtonLink href={withSpace("/recipes/collections", space)} variant="secondary" icon={<Library className="size-4" />}>
              Collections
            </ButtonLink>
            {canEdit && add}
          </>
        }
      />
      {typeof sp.imported === "string" && Number(sp.imported) > 0 && (
        <p role="status" className="mb-4 rounded-xl bg-olive-50 px-4 py-3 text-sm text-olive-700">
          Imported {Number(sp.imported)} recipe{Number(sp.imported) === 1 ? "" : "s"}. Open one to add photos or tidy anything up.
        </p>
      )}
      <FoodSpaceNav viewer={viewer} active="recipes" space={space} others={others} />
      <PrivateSpaceNote space={space} viewer={viewer} />
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
        <form className="relative flex-1" action="/recipes">
          {isPrivate && <input type="hidden" name="space" value={space.own ? "mine" : space.memberId} />}
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="recipe-q" className="sr-only">
            Search recipes
          </label>
          <input id="recipe-q" name="q" defaultValue={q} placeholder="Search by name, ingredient or tag…" className="h-11 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface pr-3 pl-10 text-[15px] focus:border-primary-500 focus:ring-4 focus:ring-primary-100 focus:outline-none" />
        </form>
        <div className="flex flex-wrap gap-2">
          <Link href={href({ favorites: favorites ? "" : "1" })} aria-pressed={favorites} className={`inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium ${favorites ? "border-wine-100 bg-wine-50 text-wine-700" : "border-line bg-surface text-ink-soft hover:bg-sunken"}`}>
            <Heart className={`size-4 ${favorites ? "fill-current" : ""}`} /> Favorites
          </Link>
        </div>
      </div>
      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpen />}
            title={q || favorites ? "No recipes match" : "No recipes yet"}
            description={q || favorites ? "Try a different search or filter." : "Start building your family's recipe collection."}
            example={q || favorites ? undefined : "Paste ingredients one per line. We'll check them against your pantry."}
            action={canEdit && !q ? cloneElement(add, { defaultOpen: false }) : undefined}
          />
        </Card>
      ) : (
        <RecipeGrid items={items} deletable={items.filter((r) => canChange(viewer, "recipes", r)).map((r) => r.id)} />
      )}
    </>
  );
}
