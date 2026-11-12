import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, count, eq } from "drizzle-orm";
import { PackageCheck, TriangleAlert } from "lucide-react";
import { db } from "@/db";
import { listItems } from "@/db/schema";
import { putAwayChecked, restockLowItems } from "@/app/actions/kitchen";
import { ActionButton } from "@/components/forms/inline";
import { ListDetail } from "@/components/lists/list-detail";
import { getViewer } from "@/lib/dal";

export const metadata: Metadata = { title: "Shopping list" };

export default async function ShoppingListPage({ params }: PageProps<"/shopping/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const viewer = await getViewer();
  if (!viewer.can("shopping")) notFound();
  const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(listItems).where(and(eq(listItems.listId, id), eq(listItems.checked, true)));
  const btn = "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-sunken";
  return (
    <ListDetail
      viewer={viewer}
      id={id}
      backHref="/shopping?all=1"
      extraActions={
        <>
          {viewer.can("kitchen", "edit") && n > 0 && (
            <ActionButton action={putAwayChecked} fields={{ id }} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary-600 px-3 text-sm font-semibold text-white hover:bg-primary-700">
              <PackageCheck className="size-4" /> Put {n} away in kitchen
            </ActionButton>
          )}
          {viewer.can("shopping", "edit") && viewer.can("kitchen") && (
            <ActionButton action={restockLowItems} fields={{}} className={btn}>
              <TriangleAlert className="size-4" /> Add low stock
            </ActionButton>
          )}
        </>
      }
    />
  );
}
