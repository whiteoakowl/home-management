import { cloneElement } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ShoppingBasket, Store } from "lucide-react";
import { ListFormModal } from "@/components/lists/list-form";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, ProgressBar } from "@/components/ui/display";
import { mainShoppingListId } from "@/lib/automation";
import { getViewer } from "@/lib/dal";
import { listIndex } from "@/lib/lists";
import { memberOptions } from "@/lib/queries";

export const metadata: Metadata = { title: "Shopping" };

export default async function ShoppingPage({ searchParams }: PageProps<"/shopping">) {
  const viewer = await getViewer();
  if (!viewer.can("shopping")) notFound();
  const sp = await searchParams;
  // Make sure the default list exists (parents/editors only create it).
  if (viewer.can("shopping", "edit")) await mainShoppingListId(viewer.family.id);
  const [members, lists] = await Promise.all([memberOptions(viewer), listIndex(viewer, ["shopping"])]);
  if (lists.length === 1 && sp.all !== "1" && sp.new !== "1") redirect(`/shopping/${lists[0]!.id}`);
  const canEdit = viewer.can("shopping", "edit");
  const add = <ListFormModal members={members} categories={[]} onlyShopping defaultOpen={sp.new === "1"} />;
  return (
    <>
      <PageHeader eyebrow="Kitchen" title="Shopping lists" description="Grouped by aisle, built from recipes, meal plans and low stock." actions={canEdit ? add : undefined} />
      {lists.length === 0 ? (
        <Card>
          <EmptyState icon={<ShoppingBasket />} title="No shopping lists" description="Create a list per store, or one for everything." action={canEdit ? cloneElement(add, { defaultOpen: false }) : undefined} />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {lists.map((l) => (
            <li key={l.id}>
              <Link href={`/shopping/${l.id}`} className="flex h-full flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)] hover:border-primary-300">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                    {l.store ? <Store className="size-5" /> : <ShoppingBasket className="size-5" />}
                  </span>
                  <div>
                    <p className="font-semibold">{l.title}</p>
                    <p className="text-sm text-muted">
                      {l.open} to buy{l.store ? ` · ${l.store}` : ""}
                    </p>
                  </div>
                </div>
                {l.total > 0 && <ProgressBar value={l.total - l.open} max={l.total} label={`${l.title} progress`} />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
