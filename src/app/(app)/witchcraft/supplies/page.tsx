import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import { Minus, PackageOpen, Plus, ShoppingBasket } from "lucide-react";
import { adjustCraftSupply, deleteCraftSupply, saveCraftSupply, shopForSupplies } from "@/app/actions/craft";
import { RecordModal } from "@/components/forms/config-form";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { CraftTabs } from "@/components/craft/craft-tabs";
import { fmtDate } from "@/components/records/detail-list";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { db } from "@/db";
import { inventoryItems } from "@/db/schema";
import type { FieldDef } from "@/lib/record-fields";
import { craftViewer } from "../shared";

export const metadata: Metadata = { title: "Witchcraft supplies" };

const FIELDS: FieldDef[] = [
  { name: "name", label: "Supply", type: "text", required: true, placeholder: "White chime candles" },
  { name: "quantity", label: "On hand", type: "number" },
  { name: "unit", label: "Unit", type: "text", placeholder: "candles, oz, jars" },
  { name: "lowStockThreshold", label: "Restock when at or below", type: "number", hint: "Low stock goes on the shopping list automatically." },
  { name: "spot", label: "Stored where", type: "text", placeholder: "Altar cabinet" },
  { name: "expiresOn", label: "Use by", type: "date" },
  { name: "notes", label: "Notes", type: "textarea", rows: 2 },
];

export default async function SuppliesPage() {
  const viewer = await craftViewer();
  const rows = await db.select().from(inventoryItems).where(and(eq(inventoryItems.familyId, viewer.family.id), eq(inventoryItems.location, "craft"))).orderBy(asc(inventoryItems.name));
  const canEdit = viewer.can("witchcraft", "edit");
  const isLow = (r: (typeof rows)[number]) => Number(r.quantity) <= 0 || (r.lowStockThreshold !== null && Number(r.quantity) <= Number(r.lowStockThreshold));
  const low = rows.filter(isLow);
  const add = canEdit ? <RecordModal title="Add supply" action={saveCraftSupply} fields={FIELDS} defaults={{ quantity: 1 }} size="md" /> : undefined;
  return (
    <>
      <PageHeader
        eyebrow="Witchcraft"
        title="Supplies"
        description="Candles, herbs, oils, incense, salts, jars and more. Part of the household inventory, so low stock flows to the shopping list."
        actions={
          <>
            {low.length > 0 && viewer.can("shopping", "edit") && (
              <ActionButton action={shopForSupplies} fields={{ ids: low.map((r) => r.id).join(",") }} className="h-11 rounded-[var(--radius-control)] bg-primary-50 px-4 text-sm font-semibold text-primary-700 hover:bg-primary-100">
                <ShoppingBasket className="size-4" /> Add {low.length} low to shopping
              </ActionButton>
            )}
            {add}
          </>
        }
      />
      <CraftTabs active="supplies" />
      {rows.length ? (
        <Card className="p-0 sm:p-0">
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-48 flex-1">
                  <p className="font-medium">
                    {r.name} {isLow(r) && <Badge tone={Number(r.quantity) <= 0 ? "wine" : "olive"}>{Number(r.quantity) <= 0 ? "Out" : "Low"}</Badge>}
                  </p>
                  <p className="text-sm text-muted">{[r.spot, r.expiresOn ? `use by ${fmtDate(r.expiresOn)}` : null, r.notes].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {canEdit && (
                    <ActionButton action={adjustCraftSupply} fields={{ id: r.id, delta: -1 }} label={`Use one ${r.name}`} className="size-8 rounded-full border border-line hover:bg-sunken">
                      <Minus className="size-4" />
                    </ActionButton>
                  )}
                  <span className="min-w-16 text-center text-sm">
                    <strong>{Number(r.quantity)}</strong> {r.unit}
                  </span>
                  {canEdit && (
                    <ActionButton action={adjustCraftSupply} fields={{ id: r.id, delta: 1 }} label={`Add one ${r.name}`} className="size-8 rounded-full border border-line hover:bg-sunken">
                      <Plus className="size-4" />
                    </ActionButton>
                  )}
                </div>
                {canEdit && (
                  <div className="flex">
                    <RecordModal
                      edit
                      title={`Edit ${r.name}`}
                      action={saveCraftSupply}
                      fields={FIELDS}
                      size="md"
                      hidden={{ id: r.id }}
                      defaults={{ name: r.name, quantity: Number(r.quantity), unit: r.unit, lowStockThreshold: r.lowStockThreshold === null ? null : Number(r.lowStockThreshold), spot: r.spot, expiresOn: r.expiresOn, notes: r.notes }}
                    />
                    <DeleteButton action={deleteCraftSupply} fields={{ id: r.id }} what={r.name} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card>
          <EmptyState icon={<PackageOpen />} title="No supplies yet" description="Track candles, herbs, oils and other supplies; link them to spells to see what you need." action={add} />
        </Card>
      )}
    </>
  );
}
