import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Library } from "lucide-react";
import { saveCollection } from "@/app/actions/recipes";
import { FormModal } from "@/components/forms/action-form";
import { TextAreaField, TextField } from "@/components/forms/fields";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { canAddIn, canOpenFood, resolveSpace, withSpace } from "@/lib/food-space";
import { collectionOptions, ensureRecipeDefaults } from "@/lib/recipes";

export const metadata: Metadata = { title: "Recipe collections" };

export default async function CollectionsPage({ searchParams }: PageProps<"/recipes/collections">) {
  const viewer = await getViewer();
  if (!canOpenFood(viewer, "recipes")) notFound();
  const space = await resolveSpace(viewer, (await searchParams).space);
  if (space.kind === "family" && !viewer.can("recipes")) notFound();
  const owner = space.kind === "private" ? space.memberId : null;
  if (!owner) await ensureRecipeDefaults(viewer);
  const cols = await collectionOptions(viewer, owner);
  const add = (
    <FormModal title={owner ? "New private collection" : "New collection"} action={saveCollection} submitLabel="Create" size="sm">
      {owner && <input type="hidden" name="space" value="mine" />}
      <TextField name="name" label="Name" required placeholder="Sunday Suppers" />
      <TextAreaField name="description" label="Description" rows={2} />
    </FormModal>
  );
  return (
    <>
      <Link href={withSpace("/recipes", space)} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {owner ? "My Recipes" : "Family Recipes"}
      </Link>
      <PageHeader title="Collections" description="Group recipes into themed books, then print them." actions={canAddIn(viewer, "recipes", space) ? add : undefined} />
      {cols.length === 0 ? (
        <Card>
          <EmptyState icon={<Library />} title="No collections yet" description="Collections are like cookbooks: Holiday, Slow Cooker, Garden Recipes…" />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cols.map((c) => (
            <li key={c.id}>
              <Link href={`/recipes/collections/${c.id}`} className="flex h-full items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)] hover:border-primary-300">
                <span className="flex h-16 w-12 shrink-0 items-center justify-center rounded-r-lg rounded-l-sm bg-gradient-to-br from-primary-600 to-primary-800 text-white shadow-md">
                  <Library className="size-5" aria-hidden />
                </span>
                <span className="flex flex-col">
                  <span className="font-display text-lg font-semibold">{c.name}</span>
                  <span className="text-sm text-muted">
                    {c.count} recipe{c.count === 1 ? "" : "s"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
