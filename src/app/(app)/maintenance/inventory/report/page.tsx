import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/recipes/recipe-actions";
import { fmtDate, fmtMoney } from "@/components/records/detail-list";
import { db } from "@/db";
import { homeItems } from "@/db/schema";
import { todayIn } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { roomOpts } from "@/lib/maintenance";
import { ITEM_CATEGORIES } from "@/lib/maintenance-config";
import { maintViewer } from "../../shared";

export const metadata: Metadata = { title: "Home inventory report" };

/** Print-ready inventory for insurers: room by room with values, serials and photos. */
export default async function InventoryReport() {
  const viewer = await maintViewer();
  const [rooms, items] = await Promise.all([roomOpts(viewer), db.select().from(homeItems).where(eq(homeItems.familyId, viewer.family.id)).orderBy(asc(homeItems.name))]);
  const value = (i: (typeof items)[number]) => (i.currentValueCents ?? i.purchasePriceCents ?? 0) * i.quantity;
  const byRoom = Map.groupBy(items, (i) => rooms.find((r) => r.value === i.roomId)?.label ?? "Unassigned");
  const total = items.reduce((s, i) => s + value(i), 0);
  return (
    <article className="mx-auto max-w-4xl print:max-w-none">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href="/maintenance/inventory" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Home inventory
        </Link>
        <PrintButton label="Print or save as PDF" />
      </div>
      <header className="mb-6 border-b-2 border-ink pb-4">
        <h1 className="font-display text-3xl font-semibold">Home inventory: {viewer.family.name} family</h1>
        <p className="text-sm text-muted">
          {viewer.family.locationName ? `${viewer.family.locationName} · ` : ""}Prepared {fmtDate(todayIn(viewer.family.timezone))} · {items.length} items · total estimated value {fmtMoney(total)}
        </p>
      </header>
      {[...byRoom.entries()].map(([room, list]) => (
        <section key={room} className="mb-8 break-inside-avoid-page">
          <h2 className="mb-2 text-xl font-semibold">
            {room} <span className="text-base font-normal text-muted">· {fmtMoney(list.reduce((s, i) => s + value(i), 0))}</span>
          </h2>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="py-1.5 pr-3 font-medium">Item</th>
                <th className="py-1.5 pr-3 font-medium">Brand / model / serial</th>
                <th className="py-1.5 pr-3 font-medium">Purchased</th>
                <th className="py-1.5 text-right font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {list.map((i) => (
                <tr key={i.id} className="border-b border-line/60 align-top">
                  <td className="py-2 pr-3">
                    <div className="flex items-start gap-2">
                      {i.imageFileId && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={fileUrl(i.imageFileId, true)!} alt="" className="size-12 rounded object-cover" />
                      )}
                      <span>
                        <strong>{i.name}</strong>
                        {i.quantity > 1 && ` ×${i.quantity}`}
                        <span className="block text-xs text-muted">{ITEM_CATEGORIES.find((c) => c.value === i.category)?.label}</span>
                      </span>
                    </div>
                  </td>
                  <td className="py-2 pr-3">{[i.brand, i.model, i.serialNumber && `S/N ${i.serialNumber}`].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="py-2 pr-3">
                    {i.purchasedOn ? fmtDate(i.purchasedOn) : "—"}
                    {i.purchasedFrom && <span className="block text-xs text-muted">{i.purchasedFrom}</span>}
                    {i.purchasePriceCents ? <span className="block text-xs text-muted">Paid {fmtMoney(i.purchasePriceCents)}</span> : null}
                  </td>
                  <td className="py-2 text-right font-medium">{value(i) ? fmtMoney(value(i)) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      {!items.length && <p className="text-muted">No items recorded yet.</p>}
    </article>
  );
}
