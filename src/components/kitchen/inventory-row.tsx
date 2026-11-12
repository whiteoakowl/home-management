"use client";

import { useState, useTransition } from "react";
import { Gift, Minus, MoreHorizontal, Plus, RefreshCw, Trash, Utensils } from "lucide-react";
import { adjustInventory, deleteInventoryItem, disposeInventory } from "@/app/actions/kitchen";
import { Badge } from "@/components/ui/display";
import { cn } from "@/lib/utils";
import { InventoryFormModal, type InventoryDefaults } from "./inventory-form";

export type InventoryRowData = InventoryDefaults & {
  id: string;
  name: string;
  quantity: string;
  location: string;
  daysLeft: number | null;
  categoryName: string | null;
  thumbUrl: string | null;
};

const LOC_LABEL: Record<string, string> = { pantry: "Pantry", fridge: "Fridge", freezer: "Freezer", supplies: "Supplies", farm: "Farm", garden: "Garden", other: "Other" };

function expiryBadge(days: number | null) {
  if (days === null) return null;
  if (days < 0) return <Badge tone="wine">Expired {-days === 1 ? "yesterday" : `${-days}d ago`}</Badge>;
  if (days === 0) return <Badge tone="wine">Expires today</Badge>;
  if (days <= 7) return <Badge tone="olive">{days === 1 ? "Tomorrow" : `${days} days`}</Badge>;
  if (days <= 30) return <Badge>{days} days</Badge>;
  return null;
}

export function InventoryRow({ item, categories, canEdit, showLocation }: { item: InventoryRowData; categories: { id: string; name: string }[]; canEdit: boolean; showLocation: boolean }) {
  const [menu, setMenu] = useState(false);
  const [pending, start] = useTransition();
  const run = (fn: (fd: FormData) => Promise<void>, fields: Record<string, string>) =>
    start(() => {
      const fd = new FormData();
      fd.set("id", item.id);
      for (const [k, v] of Object.entries(fields)) fd.set(k, v);
      setMenu(false);
      return fn(fd);
    });
  const qty = Number(item.quantity);
  const low = item.lowStockThreshold != null && qty <= Number(item.lowStockThreshold);

  return (
    <li className={cn("flex items-center gap-3 rounded-2xl border border-line bg-surface p-2.5 pr-2 sm:p-3", pending && "opacity-60")}>
      {item.thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.thumbUrl} alt="" className="size-11 shrink-0 rounded-xl object-cover" />
      ) : (
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sunken text-sm font-semibold text-muted" aria-hidden>
          {item.name.slice(0, 2).toUpperCase()}
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{item.name}</span>
        <span className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
          {showLocation && <span>{LOC_LABEL[item.location] ?? item.location}</span>}
          {item.spot && <span>{item.spot}</span>}
          {item.categoryName && <span>{item.categoryName}</span>}
        </span>
      </div>
      <div className="hidden gap-1.5 sm:flex">
        {low && <Badge tone="olive">Low</Badge>}
        {expiryBadge(item.daysLeft)}
      </div>
      {canEdit ? (
        <div className="flex items-center rounded-full border border-line">
          <button type="button" aria-label={`One less ${item.name}`} onClick={() => run(adjustInventory, { delta: "-1" })} disabled={qty <= 0} className="size-9 rounded-l-full text-muted hover:bg-sunken disabled:opacity-40">
            <Minus className="mx-auto size-4" />
          </button>
          <span className="min-w-12 px-1 text-center text-sm font-semibold tabular-nums">
            {qty % 1 ? qty.toFixed(2).replace(/0+$/, "") : qty}
            {item.unit && <span className="block text-[10px] leading-none font-normal text-muted">{item.unit}</span>}
          </span>
          <button type="button" aria-label={`One more ${item.name}`} onClick={() => run(adjustInventory, { delta: "1" })} className="size-9 rounded-r-full text-muted hover:bg-sunken">
            <Plus className="mx-auto size-4" />
          </button>
        </div>
      ) : (
        <span className="text-sm font-semibold">
          {qty} {item.unit}
        </span>
      )}
      {canEdit && (
        <div className="relative">
          <button type="button" onClick={() => setMenu((m) => !m)} aria-label={`Actions for ${item.name}`} aria-expanded={menu} className="size-9 rounded-full text-muted hover:bg-sunken">
            <MoreHorizontal className="mx-auto size-4" />
          </button>
          {menu && (
            <div className="absolute right-0 z-20 mt-1 w-52 rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-pop)]" onMouseLeave={() => setMenu(false)}>
              {[
                { kind: "used", label: "Used it up", icon: Utensils },
                { kind: "discarded", label: "Discarded", icon: Trash },
                { kind: "donated", label: "Donated", icon: Gift },
                { kind: "replaced", label: "Replaced with fresh", icon: RefreshCw },
              ].map((a) => (
                <button key={a.kind} type="button" onClick={() => run(disposeInventory, { kind: a.kind })} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-sunken">
                  <a.icon className="size-4 text-muted" /> {a.label}
                </button>
              ))}
              <InventoryFormModal
                categories={categories}
                defaults={item}
                triggerContent={<>Edit details</>}
                triggerClassName="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-sunken"
              />
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete ${item.name}? (Use "Used it up" or "Discarded" to keep history.)`)) run(deleteInventoryItem, {});
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-wine-500 hover:bg-wine-50"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
