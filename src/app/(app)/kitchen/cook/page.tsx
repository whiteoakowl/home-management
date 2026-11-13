import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ChefHat, Clock, ShoppingBasket, Timer } from "lucide-react";
import { addRecipeToShopping } from "@/app/actions/recipes";
import { ActionButton } from "@/components/forms/inline";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { db } from "@/db";
import { recipes } from "@/db/schema";
import { getViewer } from "@/lib/dal";
import { addDays, daysBetween, todayIn } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { checkIngredients, namesMatch } from "@/lib/ingredients";
import { activeInventory, ingredientsFor } from "@/lib/kitchen";

export const metadata: Metadata = { title: "What can I cook?" };

/** Pantry-first cooking: recipes ranked by what's already in the kitchen, favouring food that expires soon. */
export default async function CookFromPantryPage() {
  const viewer = await getViewer();
  if (!viewer.can("kitchen") || !viewer.can("recipes")) notFound();
  const today = todayIn(viewer.family.timezone);
  const soon = addDays(today, 5);
  const [all, inv] = await Promise.all([db.select().from(recipes).where(eq(recipes.familyId, viewer.family.id)).orderBy(asc(recipes.name)), activeInventory(viewer.family.id)]);
  const ings = await ingredientsFor(all.map((r) => r.id));
  const byRecipe = Map.groupBy(ings, (i) => i.recipeId);
  const expiring = inv.filter((i) => i.expiresOn && i.expiresOn <= soon && Number(i.quantity) > 0).sort((a, b) => a.expiresOn!.localeCompare(b.expiresOn!));
  const ranked = all
    .map((r) => {
      const list = byRecipe.get(r.id) ?? [];
      const status = checkIngredients(list, inv);
      const needed = status.filter((s) => !s.optional);
      const missing = needed.filter((s) => !s.have);
      const usesExpiring = expiring.filter((e) => list.some((i) => namesMatch(i.name, e.name)));
      return { r, total: needed.length, have: needed.length - missing.length, missing, usesExpiring };
    })
    .filter((x) => x.total > 0)
    .sort((a, b) => a.missing.length - b.missing.length || b.usesExpiring.length - a.usesExpiring.length || b.have / b.total - a.have / a.total);
  const ready = ranked.filter((x) => x.missing.length === 0);
  const almost = ranked.filter((x) => x.missing.length > 0 && x.missing.length <= 3);
  const canShop = viewer.can("shopping", "edit");

  const RecipeRow = ({ x }: { x: (typeof ranked)[number] }) => (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <Link href={`/recipes/${x.r.id}`} className="flex min-w-56 flex-1 items-center gap-3">
        {x.r.imageFileId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fileUrl(x.r.imageFileId, true)!} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
        ) : (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
            <ChefHat className="size-6" aria-hidden />
          </span>
        )}
        <span className="min-w-0">
          <span className="block font-semibold hover:text-primary-700">{x.r.name}</span>
          <span className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
            <span>
              {x.have}/{x.total} ingredients
            </span>
            {(x.r.prepMinutes || x.r.cookMinutes) && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" aria-hidden /> {(x.r.prepMinutes ?? 0) + (x.r.cookMinutes ?? 0)} min
              </span>
            )}
            {x.missing.length > 0 && <span>Need: {x.missing.map((m) => m.name).join(", ")}</span>}
          </span>
        </span>
      </Link>
      {x.usesExpiring.length > 0 && <Badge tone="olive">Uses {x.usesExpiring.map((e) => e.name.toLowerCase()).join(", ")}</Badge>}
      {x.missing.length > 0 && canShop && (
        <ActionButton action={addRecipeToShopping} fields={{ id: x.r.id, scale: 1 }} className="h-9 rounded-full bg-primary-50 px-3 text-sm font-semibold text-primary-700 hover:bg-primary-100">
          <ShoppingBasket className="size-4" /> Add {x.missing.length} to list
        </ActionButton>
      )}
      {x.missing.length === 0 && (
        <Link href={`/recipes/${x.r.id}/cook`} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary-600 px-3 text-sm font-semibold text-white hover:bg-primary-700">
          <ChefHat className="size-4" /> Cook
        </Link>
      )}
    </li>
  );

  return (
    <>
      <PageHeader eyebrow="Kitchen" title="What can I cook?" description="Recipes ranked by what you already have, with food that's about to expire used first." />
      {expiring.length > 0 && (
        <section className="mb-6 rounded-2xl border border-olive-100 bg-olive-50 p-4" aria-labelledby="useup">
          <h2 id="useup" className="flex items-center gap-2 font-semibold text-olive-700">
            <Timer className="size-5" aria-hidden /> Use it up
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {expiring.map((e) => {
              const d = daysBetween(today, e.expiresOn!);
              const n = ranked.filter((x) => x.usesExpiring.includes(e)).length;
              return (
                <li key={e.id} className="rounded-full bg-surface px-3 py-1.5 text-sm">
                  <strong>{e.name}</strong> · {d < 0 ? "expired" : d === 0 ? "today" : `${d} day${d === 1 ? "" : "s"}`}
                  {n > 0 && <span className="text-muted"> · {n} recipe{n === 1 ? "" : "s"}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <div className="grid gap-6">
        <Card>
          <CardHeader title={`Ready to cook (${ready.length})`} icon={<ChefHat className="size-4" />} />
          {ready.length ? (
            <ul className="divide-y divide-line">
              {ready.map((x) => (
                <RecipeRow key={x.r.id} x={x} />
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={<ChefHat />} title="Nothing fully stocked" description="See below for recipes that are only a few items away." />
          )}
        </Card>
        <Card>
          <CardHeader title={`Almost there (${almost.length})`} icon={<ShoppingBasket className="size-4" />} />
          {almost.length ? (
            <ul className="divide-y divide-line">
              {almost.map((x) => (
                <RecipeRow key={x.r.id} x={x} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No recipes are within three ingredients of what you have.</p>
          )}
        </Card>
      </div>
    </>
  );
}
