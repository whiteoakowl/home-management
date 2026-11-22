import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileSpreadsheet, ScanBarcode } from "lucide-react";
import { importBooks } from "@/app/actions/library";
import { ActionForm } from "@/components/forms/action-form";
import { CheckboxField, TextAreaField } from "@/components/forms/fields";
import { LibraryTabs } from "@/components/library/library-tabs";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/display";
import { Field, Input } from "@/components/ui/form";
import { libraryViewer } from "../shared";

export const metadata: Metadata = { title: "Import books" };

/**
 * Import books in bulk: a spreadsheet (Goodreads, StoryGraph, LibraryThing or your
 * own) or a list of ISBNs. Books go into the library that's open.
 */
export default async function ImportBooksPage() {
  const viewer = await libraryViewer("edit");
  const mine = viewer.librarySpace === "mine";
  const where = mine ? "My Library" : "the Family Library";
  return (
    <>
      <Link href="/library" className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Library
      </Link>
      <PageHeader help="library" title="Import books" description={`Bring a whole shelf in at once. Books are added to ${where}; any it already has are skipped.`} />
      <LibraryTabs active="import" space={viewer.librarySpace} />
      <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="From a spreadsheet" icon={<FileSpreadsheet className="size-4" />} />
          <ActionForm action={importBooks} submitLabel="Import spreadsheet" pendingLabel="Importing…" showSuccess>
            <Field label="CSV file" htmlFor="f-file" hint="Up to 5 MB. The first row should be column names.">
              <Input id="f-file" name="file" type="file" accept=".csv,text/csv,text/plain" required />
            </Field>
            <CheckboxField
              name="addToLog"
              label="Also add my shelves to my reading log"
              description="“Read”, “Currently reading” and “To read” shelves become Finished, Reading and Want to Read in your reading log."
            />
          </ActionForm>
          <details className="mt-4 text-sm text-ink-soft">
            <summary className="cursor-pointer font-medium text-ink">Where do I get the file?</summary>
            <ul className="mt-2 ml-5 flex list-disc flex-col gap-1.5">
              <li>
                <strong className="font-semibold">Goodreads:</strong> My Books → Import and export → Export library, then download the file.
              </li>
              <li>
                <strong className="font-semibold">StoryGraph or LibraryThing:</strong> use their Export option and choose CSV.
              </li>
              <li>
                <strong className="font-semibold">Your own list:</strong> make columns called <em>Title</em> and <em>Author</em> (optional: <em>ISBN</em>, <em>Pages</em>, <em>Publisher</em>, <em>Year</em>), then in Excel, Numbers or Google Sheets choose File → Download or Export → CSV.
              </li>
            </ul>
          </details>
        </Card>

        <Card>
          <CardHeader title="From ISBNs" icon={<ScanBarcode className="size-4" />} />
          <ActionForm action={importBooks} submitLabel="Look up and add" pendingLabel="Looking up books…" showSuccess>
            <TextAreaField name="isbns" label="ISBNs" rows={6} required placeholder={"9780439023481\n9780061120084\n…"} hint="One per line (up to 10 at a time). The ISBN is the number under the barcode." />
          </ActionForm>
          <p className="mt-3 text-sm text-muted">We fill in the title, author, cover and details for each one. Adding books never changes anyone&apos;s reading log.</p>
        </Card>
      </div>
    </>
  );
}
