"use client";

import {
  CheckboxField,
  ChipSelect,
  DateField,
  FormRow,
  ImageField,
  MemberSelect,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
  VisibilityField,
  type MemberOption,
} from "@/components/forms/fields";
import { BOOK_FORMATS, READING_STATUSES } from "@/lib/library-config";

export type BookDefaults = {
  id?: string;
  title?: string | null;
  subtitle?: string | null;
  author?: string | null;
  coAuthor?: string | null;
  isbn?: string | null;
  publisher?: string | null;
  publishedDate?: string | null;
  description?: string | null;
  genre?: string | null;
  pageCount?: number | null;
  edition?: string | null;
  format?: string | null;
  acquiredOn?: string | null;
  purchaseLocation?: string | null;
  priceCents?: number | null;
  rating?: number | null;
  notes?: string | null;
  isFavorite?: boolean;
  status?: string;
  readerMemberId?: string | null;
  startedOn?: string | null;
  finishedOn?: string | null;
  currentPage?: number | null;
  readingNotes?: string | null;
  visibility?: "family" | "private" | "selected";
  categoryIds?: string[];
  sharedWith?: string[];
  /** Existing cover (file URL) or a cover found by the ISBN lookup. */
  coverPreview?: string | null;
  /** Remote cover to download on save (from the lookup). */
  coverUrl?: string | null;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 border-t border-line pt-4 first:border-t-0 first:pt-0">
      <legend className="mb-1 text-xs font-semibold tracking-[0.12em] text-muted uppercase">{title}</legend>
      {children}
    </fieldset>
  );
}

/** Every book field, grouped. Used by Add, Edit and the scan confirmation screen. */
export function BookFields({ d = {}, categories, members }: { d?: BookDefaults; categories: { id: string; name: string }[]; members: MemberOption[] }) {
  return (
    <div className="flex flex-col gap-5">
      {d.id && <input type="hidden" name="id" value={d.id} />}
      {d.coverUrl && <input type="hidden" name="coverUrl" value={d.coverUrl} />}
      <Section title="Book">
        <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
          <ImageField name="cover" label="Cover" currentUrl={d.coverPreview ?? null} />
          <div className="flex flex-col gap-4">
            <TextField name="title" label="Title" defaultValue={d.title ?? ""} required />
            <TextField name="subtitle" label="Subtitle" defaultValue={d.subtitle ?? ""} />
          </div>
        </div>
        <FormRow>
          <TextField name="author" label="Author" defaultValue={d.author ?? ""} />
          <TextField name="coAuthor" label="Co-author(s)" defaultValue={d.coAuthor ?? ""} />
        </FormRow>
        <FormRow>
          <TextField name="isbn" label="ISBN" inputMode="numeric" defaultValue={d.isbn ?? ""} hint="10 or 13 digits" />
          <TextField name="genre" label="Genre" defaultValue={d.genre ?? ""} />
        </FormRow>
        <FormRow cols={3}>
          <TextField name="publisher" label="Publisher" defaultValue={d.publisher ?? ""} />
          <TextField name="publishedDate" label="Publication date" defaultValue={d.publishedDate ?? ""} placeholder="2015 or 2015-06-30" />
          <TextField name="edition" label="Edition" defaultValue={d.edition ?? ""} placeholder="1st, Anniversary…" />
        </FormRow>
        <FormRow>
          <SelectField name="format" label="Format" defaultValue={d.format ?? ""} placeholder="—" options={[...BOOK_FORMATS]} />
          <NumberField name="pageCount" label="Pages" min={1} defaultValue={d.pageCount ?? ""} />
        </FormRow>
        <TextAreaField name="description" label="Description" rows={4} defaultValue={d.description ?? ""} />
        {categories.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-ink-soft">Categories</span>
            <ChipSelect name="categoryIds" options={categories.map((c) => ({ value: c.id, label: c.name }))} defaultValue={d.categoryIds ?? []} />
          </div>
        ) : (
          <p className="text-sm text-muted">Create categories (Fiction, Cookbooks, Kids…) on the Categories tab to sort your shelves.</p>
        )}
      </Section>

      <Section title="Reading">
        <FormRow>
          <SelectField name="status" label="Reading status" defaultValue={d.status ?? "not_started"} options={[...READING_STATUSES]} />
          <MemberSelect name="readerMemberId" label="Who's reading" members={members} defaultValue={d.readerMemberId} placeholder="—" />
        </FormRow>
        <FormRow cols={3}>
          <DateField name="startedOn" label="Started" defaultValue={d.startedOn ?? ""} />
          <DateField name="finishedOn" label="Finished" defaultValue={d.finishedOn ?? ""} />
          <NumberField name="currentPage" label="Current page" min={0} defaultValue={d.currentPage ?? ""} />
        </FormRow>
        <FormRow>
          <SelectField name="rating" label="Rating" defaultValue={d.rating ? String(d.rating) : ""} placeholder="Not rated" options={[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${"★".repeat(n)}${"☆".repeat(5 - n)}  (${n})` }))} />
          <div className="flex items-end pb-1">
            <CheckboxField name="isFavorite" label="Favorite" defaultChecked={d.isFavorite} />
          </div>
        </FormRow>
        <TextAreaField name="readingNotes" label="Reading notes" rows={3} defaultValue={d.readingNotes ?? ""} />
      </Section>

      <Section title="Ownership">
        <FormRow cols={3}>
          <DateField name="acquiredOn" label="Date acquired" defaultValue={d.acquiredOn ?? ""} />
          <TextField name="purchaseLocation" label="Where from" defaultValue={d.purchaseLocation ?? ""} placeholder="Bookshop, gift…" />
          <NumberField name="price" label="Price" min={0} step="0.01" defaultValue={d.priceCents != null ? (d.priceCents / 100).toFixed(2) : ""} />
        </FormRow>
        <TextAreaField name="notes" label="Notes" rows={2} defaultValue={d.notes ?? ""} />
        <VisibilityField members={members} defaultValue={d.visibility ?? "family"} defaultSelected={d.sharedWith ?? []} />
      </Section>
    </div>
  );
}
