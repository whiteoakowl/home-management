import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { FileText, Package, Printer } from "lucide-react";
import { deleteHomeItem, saveHomeItem } from "@/app/actions/maintenance";
import { RecordModal } from "@/components/forms/config-form";
import { DeleteButton } from "@/components/forms/inline";
import { MaintenanceTabs } from "@/components/maintenance/tabs";
import { fmtDate, fmtMoney } from "@/components/records/detail-list";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { db } from "@/db";
import { homeItems } from "@/db/schema";
import { todayIn } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { roomOpts } from "@/lib/maintenance";
import { ITEM_CATEGORIES, ITEM_FIELDS } from "@/lib/maintenance-config";
import type { FieldValue } from "@/lib/record-fields";
import { maintViewer } from "../shared";

export const metadata: Metadata = { title: "Home inventory" };

type Item = typeof homeItems.$inferSelect;
const pick = (it: Item) => Object.fromEntries(ITEM_FIELDS.map((f) => [f.name, (it as Record<string, unknown>)[f.name] as FieldValue]));

export default async function InventoryPage({ searchParams }: PageProps<"/maintenance/inventory">) {
  const viewer = await maintViewer();
  const sp = (await searchParams) as { room?: string; category?: string; q?: string; new?: string };
  const today = todayIn(viewer.family.timezone);
  const [rooms, all] = await Promise.all([roomOpts(viewer), db.select().from(homeItems).where(eq(homeItems.familyId, viewer.family.id)).orderBy(asc(homeItems.name))]);
  const fields = ITEM_FIELDS.map((f) => (f.name === "roomId" ? { ...f, options: rooms } : f));
  const q = sp.q?.toLowerCase();
  const items = all.filter((i) => (!sp.room || i.roomId === sp.room) && (!sp.category || i.category === sp.category) && (!q || `${i.name} ${i.brand} ${i.model} ${i.serialNumber}`.toLowerCase().includes(q)));
  const value = (i: Item) => (i.currentValueCents ?? i.purchasePriceCents ?? 0) * i.quantity;
  const total = items.reduce((s, i) => s + value(i), 0);
  const canEdit = viewer.can("maintenance", "edit");
  const add = canEdit ? <RecordModal title="Add an item" triggerLabel="Add item" action={saveHomeItem} fields={fields} defaults={{ category: "appliance", quantity: 1, roomId: sp.room ?? null }} defaultOpen={sp.new === "1"} /> : undefined;
  const byRoom = Map.groupBy(items, (i) => rooms.find((r) => r.value === i.roomId)?.label ?? "No room");
  const sel = "h-10 rounded-full border border-line-strong bg-surface px-3 text-sm";
  return (
    <>
      <PageHeader
        eyebrow="Home Maintenance"
        title="Home inventory"
        description="Everything you own that's worth recording: values, serial numbers, photos and receipts. Ready for an insurance claim."
        actions={
          <>
            <ButtonLink href="/maintenance/inventory/report" variant="secondary" icon={<Printer className="size-4" />}>
              Insurance report
            </ButtonLink>
            {add}
          </>
        }
      />
      <MaintenanceTabs active="inventory" />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Card className="flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-3">
          <span className="text-sm text-muted">{items.length} items · estimated value</span>
          <span className="font-display text-2xl font-semibold">{fmtMoney(total)}</span>
        </Card>
        <form className="flex flex-1 flex-wrap gap-2" role="search">
          <input name="q" defaultValue={sp.q} placeholder="Search name, brand, model, serial…" aria-label="Search inventory" className="h-10 min-w-48 flex-1 rounded-full border border-line-strong bg-surface px-4 text-sm" />
          <select name="room" defaultValue={sp.room ?? ""} aria-label="Room" className={sel}>
            <option value="">Every room</option>
            {rooms.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <select name="category" defaultValue={sp.category ?? ""} aria-label="Category" className={sel}>
            <option value="">All categories</option>
            {ITEM_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <button className="h-10 rounded-full bg-ink px-4 text-sm font-medium text-white">Filter</button>
        </form>
      </div>
      {items.length === 0 ? (
        <Card>
          <EmptyState icon={<Package />} title={all.length ? "Nothing matches" : "No items yet"} description="Start with big-ticket items: appliances, electronics, furniture, jewelry. Photograph serial numbers too." action={!all.length && canEdit && <RecordModal title="Add an item" triggerLabel="Add item" action={saveHomeItem} fields={fields} defaults={{ category: "appliance", quantity: 1 }} />} />
        </Card>
      ) : (
        [...byRoom.entries()].map(([room, list]) => (
          <section key={room} className="mb-6">
            <h2 className="mb-2 flex items-baseline justify-between text-lg font-semibold">
              {room} <span className="text-sm font-normal text-muted">{fmtMoney(list.reduce((s, i) => s + value(i), 0))}</span>
            </h2>
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {list.map((i) => {
                const img = fileUrl(i.imageFileId, true);
                const warranty = i.warrantyExpiresOn && i.warrantyExpiresOn >= today;
                return (
                  <li key={i.id} className="flex gap-3 rounded-2xl border border-line bg-surface p-3">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-sunken text-muted">
                        <Package className="size-6" aria-hidden />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {i.name} {i.quantity > 1 && <span className="font-normal text-muted">×{i.quantity}</span>}
                      </p>
                      <p className="truncate text-sm text-muted">{[i.brand, i.model, i.serialNumber && `S/N ${i.serialNumber}`].filter(Boolean).join(" · ")}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
                        <Badge>{ITEM_CATEGORIES.find((c) => c.value === i.category)?.label}</Badge>
                        {value(i) > 0 && <span className="font-medium">{fmtMoney(value(i))}</span>}
                        {warranty && <Badge tone="olive">Warranty to {fmtDate(i.warrantyExpiresOn)}</Badge>}
                        {i.receiptFileId && (
                          <a href={fileUrl(i.receiptFileId)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary-700 underline">
                            <FileText className="size-3.5" aria-hidden /> Receipt
                          </a>
                        )}
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex shrink-0 flex-col">
                        <RecordModal edit title={`Edit ${i.name}`} action={saveHomeItem} fields={fields} defaults={pick(i)} hidden={{ id: i.id }} imageUrls={{ image: fileUrl(i.imageFileId) }} />
                        <DeleteButton action={deleteHomeItem} fields={{ id: i.id }} what={i.name} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
