import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import { ReceiptImporter } from "@/components/kitchen/receipt-importer";
import { PageHeader } from "@/components/ui/display";
import { ButtonLink } from "@/components/ui/button";
import { budgetCategories } from "@/lib/budget";
import { getViewer } from "@/lib/dal";
import { hasPrivateFood } from "@/lib/food-space";
import { activeInventory } from "@/lib/kitchen";

export const metadata: Metadata = { title: "Scan a receipt" };

export default async function ReceiptImportPage() {
  const viewer = await getViewer();
  const family = viewer.can("kitchen", "add");
  const mine = hasPrivateFood(viewer);
  if (!family && !mine) notFound();
  const canBudget = viewer.can("budget", "edit");
  const [existingFamily, existingMine, cats] = await Promise.all([
    family ? activeInventory(viewer.family.id) : Promise.resolve([]),
    mine ? activeInventory(viewer.family.id, viewer.member.id) : Promise.resolve([]),
    canBudget ? budgetCategories(viewer) : Promise.resolve([]),
  ]);
  const slim = (xs: { id: string; name: string; quantity: string; unit: string | null }[]) => xs.map(({ id, name, quantity, unit }) => ({ id, name, quantity, unit }));
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link href="/kitchen" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Family Pantry
      </Link>
      <PageHeader
        title="Import groceries from a receipt"
        description="Scan or upload a receipt, check the items, then add them to the pantry."
        actions={
          <ButtonLink href="/kitchen/receipts" variant="secondary" icon={<History className="size-4" />}>
            Receipt history
          </ButtonLink>
        }
      />
      <ReceiptImporter family={family} mine={mine} existingFamily={slim(existingFamily)} existingMine={slim(existingMine)} canBudget={canBudget} budgetCategories={cats.map((c) => c.name)} />
    </div>
  );
}
