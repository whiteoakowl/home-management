import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, exists, ilike, isNull, or } from "drizzle-orm";
import { Plus, Receipt, Search } from "lucide-react";
import { db } from "@/db";
import { groceryReceiptItems, groceryReceipts } from "@/db/schema";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { formatShortDate } from "@/lib/dates";
import { hasPrivateFood } from "@/lib/food-space";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Receipt history" };

const money = (c: number | null) => (c == null ? "—" : (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" }));

export default async function ReceiptHistoryPage({ searchParams }: PageProps<"/kitchen/receipts">) {
  const viewer = await getViewer();
  const sp = await searchParams;
  const mineOnly = sp.space === "mine";
  if (mineOnly ? !hasPrivateFood(viewer) : !viewer.can("kitchen")) notFound();
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const like = `%${q}%`;
  const rows = await db
    .select()
    .from(groceryReceipts)
    .where(
      and(
        eq(groceryReceipts.familyId, viewer.family.id),
        mineOnly ? eq(groceryReceipts.ownerMemberId, viewer.member.id) : isNull(groceryReceipts.ownerMemberId),
        q
          ? or(
              ilike(groceryReceipts.store, like),
              ilike(groceryReceipts.notes, like),
              exists(db.select().from(groceryReceiptItems).where(and(eq(groceryReceiptItems.receiptId, groceryReceipts.id), ilike(groceryReceiptItems.name, like)))),
            )
          : undefined,
      ),
    )
    .orderBy(desc(groceryReceipts.date), desc(groceryReceipts.createdAt))
    .limit(200);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader
        eyebrow={mineOnly ? "My private" : "Family Pantry"}
        title="Receipt history"
        description="Grocery receipts you imported and saved."
        actions={
          <ButtonLink href="/kitchen/receipt" icon={<Plus className="size-4" />}>
            Scan a receipt
          </ButtonLink>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        {hasPrivateFood(viewer) && viewer.can("kitchen") && (
          <>
            <Link href="/kitchen/receipts" className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${!mineOnly ? "bg-ink text-white" : "hover:bg-sunken"}`}>
              Family
            </Link>
            <Link href="/kitchen/receipts?space=mine" className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${mineOnly ? "bg-ink text-white" : "hover:bg-sunken"}`}>
              Mine
            </Link>
          </>
        )}
        <form className="ml-auto flex gap-2" action="/kitchen/receipts">
          {mineOnly && <input type="hidden" name="space" value="mine" />}
          <label htmlFor="rq" className="sr-only">Search receipts</label>
          <input id="rq" name="q" defaultValue={q} placeholder="Store or item" className="h-10 w-48 rounded-full border border-line-strong bg-surface px-4 text-sm" />
          <button aria-label="Search" className="inline-flex size-10 items-center justify-center rounded-full border border-line-strong bg-surface hover:bg-sunken">
            <Search className="size-4" />
          </button>
        </form>
      </div>
      {rows.length ? (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/kitchen/receipts/${r.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-primary-300">
                <Receipt className="size-5 text-muted" aria-hidden />
                <span className="flex-1">
                  <span className="block font-medium">{r.store ?? "Receipt"}</span>
                  <span className="text-sm text-muted">{r.date ? formatShortDate(r.date) : "No date"}</span>
                </span>
                {r.transactionId && <Badge tone="olive">Expense</Badge>}
                <span className="font-semibold tabular-nums">{money(r.totalCents)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <EmptyState icon={<Receipt />} title={q ? "No matching receipts" : "No saved receipts yet"} description="When you import a receipt, tick “Save this receipt” to keep it here." />
        </Card>
      )}
    </div>
  );
}
