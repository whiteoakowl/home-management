import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUp, Tags } from "lucide-react";
import { moveCategoryBooks, removeBookCategory, reorderBookCategory, saveBookCategory } from "@/app/actions/library";
import { ActionForm, FormModal } from "@/components/forms/action-form";
import { SelectField, TextField } from "@/components/forms/fields";
import { ActionButton } from "@/components/forms/inline";
import { LibraryTabs } from "@/components/library/library-tabs";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { bookCategoryList, canAddBooks, listBooks } from "@/lib/library";
import { libraryViewer } from "../shared";

export const metadata: Metadata = { title: "Book categories" };

const SUGGESTED = ["Fiction", "Non-fiction", "Mystery", "Fantasy", "Biography", "Cookbooks", "Gardening", "Kids", "Spiritual", "Reference"];

export default async function BookCategoriesPage() {
  const viewer = await libraryViewer();
  const canEdit = viewer.can("library", "edit");
  const space = viewer.librarySpace;
  const [cats, list] = await Promise.all([bookCategoryList(viewer), listBooks(viewer, space)]);
  const count = (id: string) => list.filter((b) => b.categoryIds.includes(id)).length;
  const btn = "inline-flex size-8 items-center justify-center rounded-full text-muted hover:bg-sunken hover:text-ink disabled:opacity-30";

  return (
    <>
      <PageHeader
        eyebrow="Book Library"
        title="Categories"
        description="Organise your shelves your way. A book can be in several categories."
        actions={
          canEdit && (
            <FormModal title="New category" action={saveBookCategory} triggerLabel="New category" size="sm">
              <TextField name="name" label="Name" required maxLength={60} placeholder="Family favorites" />
            </FormModal>
          )
        }
      />
      <LibraryTabs active="categories" canEdit={canAddBooks(viewer, space)} space={space} />
      {!cats.length ? (
        <Card>
          <EmptyState
            icon={<Tags />}
            title="No categories yet"
            description="Create the shelves that make sense for your family. Some ideas:"
            example={SUGGESTED.join(" · ")}
            action={
              canEdit && (
                <FormModal title="New category" action={saveBookCategory} triggerLabel="Create a category" size="sm">
                  <TextField name="name" label="Name" required maxLength={60} placeholder="Fiction" />
                </FormModal>
              )
            }
          />
        </Card>
      ) : (
        <Card className="mx-auto max-w-3xl !p-0">
          <ul className="divide-y divide-line">
            {cats.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 px-4 py-3 sm:flex-nowrap">
                {canEdit && (
                  <span className="flex flex-col">
                    <ActionButton action={reorderBookCategory} fields={{ id: c.id, dir: "up" }} label={`Move ${c.name} up`} className={btn}>
                      <ArrowUp className="size-4" />
                    </ActionButton>
                    <ActionButton action={reorderBookCategory} fields={{ id: c.id, dir: "down" }} label={`Move ${c.name} down`} className={btn}>
                      <ArrowDown className="size-4" />
                    </ActionButton>
                  </span>
                )}
                <Link href={`/library/books?category=${c.id}`} className="min-w-0 flex-1 hover:text-primary-700">
                  <span className="block truncate font-medium">{c.name}</span>
                  <span className="text-sm text-muted">
                    {count(c.id)} book{count(c.id) === 1 ? "" : "s"}
                  </span>
                </Link>
                {canEdit && (
                  <div className="flex flex-wrap items-center gap-1">
                    <FormModal title="Rename category" action={saveBookCategory} triggerLabel="Edit" triggerVariant="ghost" triggerSize="sm" size="sm">
                      <input type="hidden" name="id" value={c.id} />
                      <TextField name="name" label="Name" required maxLength={60} defaultValue={c.name} />
                    </FormModal>
                    {cats.length > 1 && count(c.id) > 0 && (
                      <FormModal title={`Move books from ${c.name}`} action={moveCategoryBooks} triggerLabel="Move books" triggerVariant="ghost" triggerSize="sm" size="sm" description="Every book in this category moves to the one you choose.">
                        <input type="hidden" name="id" value={c.id} />
                        <SelectField name="moveTo" label="Move to" required options={cats.filter((x) => x.id !== c.id).map((x) => ({ value: x.id, label: x.name }))} />
                      </FormModal>
                    )}
                    <FormModal title={`Delete ${c.name}?`} action={removeBookCategory} triggerLabel="Delete" triggerVariant="ghost" triggerSize="sm" size="sm" submitLabel="Delete category" description="The books stay in your library; they just leave this category.">
                      <input type="hidden" name="id" value={c.id} />
                      {cats.length > 1 && count(c.id) > 0 && (
                        <SelectField name="moveTo" label="Move its books to (optional)" placeholder="Don't move them" options={cats.filter((x) => x.id !== c.id).map((x) => ({ value: x.id, label: x.name }))} />
                      )}
                    </FormModal>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {canEdit && cats.length > 0 && (
        <div className="mx-auto mt-6 max-w-3xl">
          <Card>
            <p className="mb-3 font-medium">Add a category</p>
            <ActionForm action={saveBookCategory} submitLabel="Add">
              <TextField name="name" label="Name" required maxLength={60} placeholder={SUGGESTED.find((s) => !cats.some((c) => c.name === s)) ?? "New shelf"} />
            </ActionForm>
          </Card>
        </div>
      )}
    </>
  );
}
