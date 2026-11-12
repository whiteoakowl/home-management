import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, BookOpen, Pencil, Printer, Trash2 } from "lucide-react";
import { db } from "@/db";
import { recipeCollections } from "@/db/schema";
import { deleteCollection, saveCollection } from "@/app/actions/recipes";
import { FormModal } from "@/components/forms/action-form";
import { TextAreaField, TextField } from "@/components/forms/fields";
import { ActionButton } from "@/components/forms/inline";
import { RecipeCard } from "@/components/recipes/recipe-card";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { listRecipes } from "@/lib/recipes";

export const metadata: Metadata = { title: "Collection" };

export default async function CollectionPage({ params }: PageProps<"/recipes/collections/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const viewer = await getViewer();
  if (!viewer.can("recipes")) notFound();
  const [c] = await db.select().from(recipeCollections).where(and(eq(recipeCollections.id, id), eq(recipeCollections.familyId, viewer.family.id)));
  if (!c) notFound();
  const items = await listRecipes(viewer, { collectionId: id });
  const canEdit = viewer.can("recipes", "edit");
  return (
    <>
      <Link href="/recipes/collections" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Collections
      </Link>
      <PageHeader
        eyebrow="Collection"
        title={c.name}
        description={c.description ?? `${items.length} recipe${items.length === 1 ? "" : "s"}`}
        actions={
          <>
            {items.length > 0 && (
              <ButtonLink href={`/recipes/collections/${id}/print`} variant="secondary" icon={<Printer className="size-4" />}>
                Printable book
              </ButtonLink>
            )}
            {canEdit && (
              <>
                <FormModal title="Edit collection" action={saveCollection} size="sm" triggerContent={<><Pencil className="size-4" /> Edit</>} triggerClassName="inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-sunken">
                  <input type="hidden" name="id" value={c.id} />
                  <TextField name="name" label="Name" required defaultValue={c.name} />
                  <TextAreaField name="description" label="Description" rows={2} defaultValue={c.description ?? ""} />
                </FormModal>
                <ActionButton action={deleteCollection} fields={{ id }} confirm="Delete this collection? Recipes are kept." label="Delete collection" className="size-11 rounded-lg text-muted hover:bg-wine-50 hover:text-wine-500">
                  <Trash2 className="size-4" />
                </ActionButton>
              </>
            )}
          </>
        }
      />
      {items.length === 0 ? (
        <Card>
          <EmptyState icon={<BookOpen />} title="This collection is empty" description="Open any recipe, choose Edit, and tick this collection to add it." />
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
