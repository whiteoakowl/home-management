import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ScanBarcode } from "lucide-react";
import { BookForm } from "@/components/library/book-form";
import { LibraryTabs } from "@/components/library/library-tabs";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/display";
import { normalizeIsbn } from "@/lib/isbn";
import { bookCategoryList } from "@/lib/library";
import { memberOptions } from "@/lib/queries";
import { libraryViewer } from "../shared";

export const metadata: Metadata = { title: "Add a book" };

export default async function AddBookPage({ searchParams }: PageProps<"/library/add">) {
  const viewer = await libraryViewer("edit");
  const sp = await searchParams;
  const [cats, members] = await Promise.all([bookCategoryList(viewer), memberOptions(viewer)]);
  const isbn = typeof sp.isbn === "string" ? normalizeIsbn(sp.isbn) : null;
  return (
    <>
      <Link href="/library" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Library
      </Link>
      <PageHeader
        title="Add a book"
        description="Only the title is required; fill in as much or as little as you like."
        actions={
          <ButtonLink href="/library/scan" variant="secondary" icon={<ScanBarcode className="size-4" />}>
            Scan instead
          </ButtonLink>
        }
      />
      <LibraryTabs active="add" canEdit />
      <Card className="mx-auto max-w-3xl">
        <BookForm d={{ isbn, status: "not_started", readerMemberId: null }} categories={cats} members={members} submitLabel="Add to library" />
      </Card>
    </>
  );
}
