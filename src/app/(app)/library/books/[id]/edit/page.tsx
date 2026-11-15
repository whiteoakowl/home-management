import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BookForm } from "@/components/library/book-form";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/display";
import { bookCategoryList, canChangeBook, getBook } from "@/lib/library";
import { memberOptions } from "@/lib/queries";
import { getRecordAccess } from "@/lib/records";
import { libraryViewer } from "../../../shared";

export const metadata: Metadata = { title: "Edit book" };

export default async function EditBookPage({ params }: PageProps<"/library/books/[id]/edit">) {
  const viewer = await libraryViewer();
  const { id } = await params;
  const b = await getBook(viewer, id);
  if (!b || !canChangeBook(viewer, b)) notFound();
  const [cats, members, access] = await Promise.all([bookCategoryList(viewer), memberOptions(viewer), getRecordAccess("book", [b.id])]);
  return (
    <>
      <Link href={`/library/books/${b.id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {b.title}
      </Link>
      <PageHeader title="Edit book" />
      <Card className="mx-auto max-w-3xl">
        <BookForm
          personal={!!b.ownerMemberId}
          d={{ ...b, coverPreview: b.coverFileId ? `/api/files/${b.coverFileId}` : null, sharedWith: access.get(b.id) ?? [] }}
          categories={cats}
          members={members}
        />
      </Card>
    </>
  );
}
