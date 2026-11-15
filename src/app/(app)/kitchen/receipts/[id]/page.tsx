import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft, Check, Trash2 } from "lucide-react";
import { db } from "@/db";
import { groceryReceiptItems, groceryReceipts } from "@/db/schema";
import { deleteReceipt } from "@/app/actions/receipts";
import { ActionButton } from "@/components/forms/inline";
import { Card } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { formatLongDate } from "@/lib/dates";
import { fileUrl } from "@/lib/files";

export const metadata: Metadata = { title: "Receipt" };

const money = (c: number | null) => (c == null ? "—" : (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" }));

export default async function ReceiptPage({ params, searchParams }: PageProps<"/kitchen/receipts/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const viewer = await getViewer();
  const [r] = await db.select().from(groceryReceipts).where(and(eq(groceryReceipts.id, id), eq(groceryReceipts.familyId, viewer.family.id)));
  if (!r || (r.ownerMemberId ? r.ownerMemberId !== viewer.member.id : !viewer.can("kitchen"))) notFound();
  const items = await db.select().from(groceryReceiptItems).where(eq(groceryReceiptItems.receiptId, r.id)).orderBy(asc(groceryReceiptItems.position));
  const canDelete = r.ownerMemberId ? true : viewer.isParent || r.createdByMemberId === viewer.member.id;
  const itemsTotal = items.reduce((s, i) => s + (i.priceCents ?? 0), 0);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link href={`/kitchen/receipts${r.ownerMemberId ? "?space=mine" : ""}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Receipt history
      </Link>
      {typeof sp.done === "string" && <p role="status" className="rounded-xl bg-olive-50 px-4 py-3 text-sm text-olive-700">{sp.done}</p>}
      <PageHeader
        eyebrow={r.ownerMemberId ? "My private" : "Family Pantry"}
        title={r.store ?? "Receipt"}
        description={`${r.date ? formatLongDate(r.date) : "No date"} · ${money(r.totalCents)}`}
        actions={
          canDelete ? (
            <ActionButton action={deleteReceipt} fields={{ id: r.id }} confirm="Delete this receipt? Items already in the pantry stay there." className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-wine-700 hover:bg-wine-50">
              <Trash2 className="size-4" /> Delete
            </ActionButton>
          ) : undefined
        }
      />
      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <Card>
          <table className="w-full text-left text-sm">
            <thead className="text-xs tracking-wider text-muted uppercase">
              <tr>
                <th className="py-2 font-semibold">Item</th>
                <th className="py-2 font-semibold">Qty</th>
                <th className="py-2 text-right font-semibold">Price</th>
                <th className="py-2 text-right font-semibold">Pantry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((i) => (
                <tr key={i.id}>
                  <td className="py-2.5">
                    {i.name}
                    <span className="block text-xs text-muted">
                      {i.category ?? ""}
                      {i.location ? ` · ${i.location}` : ""}
                    </span>
                  </td>
                  <td className="py-2.5">
                    {Number(i.quantity ?? 1)}
                    {i.unit ? ` ${i.unit}` : ""}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{money(i.priceCents)}</td>
                  <td className="py-2.5 text-right">{i.addedToPantry ? <Check className="ml-auto size-4 text-olive-500" aria-label="Added" /> : <span className="text-muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-right text-sm text-muted">Items: {money(itemsTotal)}</p>
          {r.transactionId && (
            <p className="mt-2">
              <Badge tone="olive">Recorded as a household expense</Badge>
            </p>
          )}
          {r.notes && <p className="mt-3 text-sm whitespace-pre-line text-ink-soft">{r.notes}</p>}
        </Card>
        {r.imageFileId && (
          <a href={fileUrl(r.imageFileId)!} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fileUrl(r.imageFileId)!} alt="Receipt photo" className="w-full rounded-2xl border border-line object-contain" />
          </a>
        )}
      </div>
    </div>
  );
}
