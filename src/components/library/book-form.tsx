"use client";

import { saveBook } from "@/app/actions/library";
import { ActionForm } from "@/components/forms/action-form";
import type { MemberOption } from "@/components/forms/fields";
import { BookFields, type BookDefaults } from "./book-fields";

/** Full-page add/edit form; on save it opens the book. */
export function BookForm({ d, categories, members, submitLabel = "Save book", personal }: { d?: BookDefaults; categories: { id: string; name: string }[]; members: MemberOption[]; submitLabel?: string; personal?: boolean }) {
  return (
    <ActionForm action={saveBook} submitLabel={submitLabel} resetOnSuccess={false}>
      <input type="hidden" name="then" value="view" />
      <BookFields d={d} categories={categories} members={members} personal={personal} />
    </ActionForm>
  );
}
