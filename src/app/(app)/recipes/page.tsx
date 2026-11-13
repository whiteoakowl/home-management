import { cloneElement } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Heart, Library, Search } from "lucide-react";
import { RecipeCard } from "@/components/recipes/recipe-card";
import { RecipeFormModal } from "@/components/recipes/recipe-form";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { ImportRecipeModal } from "@/components/recipes/import-modal";
import { SegmentLinks } from "@/components/ui/tabs";
import { getViewer } from "@/lib/dal";
import { categoryOptions } from "@/lib/queries";
import { collectionOptions, ensureRecipeDefaults, listRecipes } from "@/lib/recipes";

export const metadata: Metadata = { title: "Recipes" };

export default async function RecipesPage({ searchParams }: PageProps<"/recipes">) {
  const viewer = await getViewer();
  if (!viewer.can("recipes")) notFound();
  await ensureRecipeDefaults(viewer);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const cat = typeof sp.category === "string" ? sp.category : "";
  const favorites = sp.favorites === "1";
  const [cats, cols, items] = await Promise.all([
    categoryOptions(viewer, "recipe"),
    collectionOptions(viewer),
    listRecipes(viewer, { q: q || undefined, categoryId: cat || undefined, favorites }),
  ]);
  const canEdit = viewer.can("recipes", "edit");
  const add = <RecipeFormModal categories={cats} collections={cols} defaultOpen={sp.new === "1"} />;
  const href = (p: Record<string, string>) => `/recipes?${new URLSearchParams({ ...(q ? { q } : {}), ...(cat ? { category: cat } : {}), ...(favorites ? { favorites: "1" } : {}), ...p })}`;

  return (
    <>
      <PageHeader
        eyebrow="Kitchen"
        title="Recipes"
        description="Your family's recipe book."
        actions={
          <>
            {viewer.can("recipes", "edit") && <ImportRecipeModal defaultOpen={sp.import === "1"} />}
            <ButtonLink href="/recipes/collections" variant="secondary" icon={<Library className="size-4" />}>
              Collections
            </ButtonLink>
            {canEdit && add}
          </>
        }
      />
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
        <form className="relative flex-1" action="/recipes">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="recipe-q" className="sr-only">
            Search recipes
          </label>
          <input id="recipe-q" name="q" defaultValue={q} placeholder="Search by name, ingredient or tag…" className="h-11 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface pr-3 pl-10 text-[15px] focus:border-primary-500 focus:ring-4 focus:ring-primary-100 focus:outline-none" />
          {cat && <input type="hidden" name="category" value={cat} />}
        </form>
        <div className="flex flex-wrap gap-2">
          <Link href={href({ favorites: favorites ? "" : "1" })} aria-pressed={favorites} className={`inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium ${favorites ? "border-wine-100 bg-wine-50 text-wine-700" : "border-line bg-surface text-ink-soft hover:bg-sunken"}`}>
            <Heart className={`size-4 ${favorites ? "fill-current" : ""}`} /> Favorites
          </Link>
          {cats.length > 0 && (
            <SegmentLinks active={cat || "all"} items={[{ key: "all", href: href({ category: "" }), label: "All" }, ...cats.map((c) => ({ key: c.id, href: href({ category: c.id }), label: c.name }))]} />
          )}
        </div>
      </div>
      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpen />}
            title={q || cat || favorites ? "No recipes match" : "No recipes yet"}
            description={q || cat || favorites ? "Try a different search or filter." : "Start building your family's recipe collection."}
            example={q || cat || favorites ? undefined : "Paste ingredients one per line. We'll check them against your pantry."}
            action={canEdit && !q ? cloneElement(add, { defaultOpen: false }) : undefined}
          />
        </Card>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((r) => (
            <li key={r.id}>
              <RecipeCard r={r} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
