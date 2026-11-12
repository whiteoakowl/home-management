import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { categoryOptions } from "@/lib/queries";
import { Scanner } from "./scanner";

export const metadata: Metadata = { title: "Scan barcode" };

export default async function ScanPage() {
  const viewer = await getViewer();
  if (!viewer.can("kitchen", "edit")) notFound();
  const cats = await categoryOptions(viewer, "inventory");
  return (
    <>
      <Link href="/kitchen" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Kitchen
      </Link>
      <PageHeader title="Scan to add" description="Scan a product's barcode with your phone camera. We'll identify it when we can, and remember it for next time." />
      <Scanner categories={cats} />
    </>
  );
}
