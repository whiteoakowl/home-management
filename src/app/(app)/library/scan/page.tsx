import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LibraryTabs } from "@/components/library/library-tabs";
import { PageHeader } from "@/components/ui/display";
import { bookCategoryList } from "@/lib/library";
import { memberOptions } from "@/lib/queries";
import { libraryViewer } from "../shared";
import { BookScanner } from "./book-scanner";

export const metadata: Metadata = { title: "Scan a book" };

export default async function ScanBookPage() {
  const viewer = await libraryViewer("edit");
  const [cats, members] = await Promise.all([bookCategoryList(viewer), memberOptions(viewer)]);
  return (
    <>
      <Link href="/library" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Library
      </Link>
      <PageHeader title="Scan a book" description="Scan the barcode on the back cover. We'll find the title, author, cover and more, and you confirm before anything is saved." />
      <LibraryTabs active="scan" canEdit />
      <BookScanner categories={cats} members={members} />
    </>
  );
}
