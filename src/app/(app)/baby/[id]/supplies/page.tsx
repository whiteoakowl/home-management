import type { Metadata } from "next";
import Link from "next/link";
import { Minus, Pencil, Plus } from "lucide-react";
import { adjustBabySupply, babySuppliesToShopping, deleteBabySupply, markMilk } from "@/app/actions/baby";
import { BabySupplyModal } from "@/components/baby/forms";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/display";
import { listBabies, suppliesFor } from "@/lib/baby";
import { MILK_STORAGE, type MilkPlace } from "@/lib/baby-kinds";
import { daysBetween, formatShortDate, utcToZoned } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { BabyHeader, babyContext } from "../../shared";

export const metadata: Metadata = { title: "Baby supplies" };

const SECTIONS = [
  { kind: "diapers", title: "Diapers", emoji: "🧷" },
  { kind: "wipes", title: "Wipes", emoji: "🧻" },
  { kind: "formula", title: "Formula", emoji: "🍼" },
  { kind: "food", title: "Baby food", emoji: "🥣" },
  { kind: "bottles", title: "Bottles & feeding gear", emoji: "🍼" },
  { kind: "other", title: "Other", emoji: "📦" },
] as const;

const btn = "inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-sunken";

/** Diapers, wipes, formula, food and bottles on hand, plus the breast milk stash. */
export default async function BabySuppliesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await babyContext(id);
  const { viewer, baby, today, tz, canUse, units } = ctx;
  const [items, all] = await Promise.all([suppliesFor(viewer, baby.id), listBabies(viewer)]);
  const babies = all.map((b) => ({ id: b.id, name: b.name }));
  const milk = items.filter((i) => i.kind === "milk").sort((a, b) => (a.expiresOn ?? "9").localeCompare(b.expiresOn ?? "9"));
  const low = items.filter((i) => i.kind !== "milk" && i.lowAt !== null && Number(i.quantity) <= Number(i.lowAt));
  const milkTotal = Math.round(milk.reduce((s, m) => s + Number(m.quantity), 0) * 10) / 10;
  const byPlace = (p: string) => Math.round(milk.filter((m) => m.location === p).reduce((s, m) => s + Number(m.quantity), 0) * 10) / 10;
  const canShop = viewer.can("shopping", "add");

  return (
    <>
      <BabyHeader ctx={ctx} active="supplies" />
      {low.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-olive-100 bg-olive-50 px-4 py-3">
          <p className="text-[15px] text-olive-700">🛒 Running low: {low.map((l) => l.name).join(", ")}</p>
          {canUse && canShop && (
            <ActionButton action={babySuppliesToShopping} fields={{}} className="h-9 rounded-lg bg-surface px-3 text-sm font-medium ring-1 ring-line hover:bg-sunken">
              Add to shopping list
            </ActionButton>
          )}
        </div>
      )}

      <Card className="mb-4 flex flex-col gap-3">
        <CardHeader title="🍶 Breast milk stash" action={canUse ? <BabySupplyModal kind="milk" babies={babies.filter((b) => b.id === baby.id)} today={today} /> : undefined} />
        <p className="text-sm text-muted">
          {milkTotal} {units.volume} stored · fridge {byPlace("fridge")} · freezer {byPlace("freezer")} · thawed {byPlace("thawed")}. Log pumping with “Store it” and it lands here.
        </p>
        {milk.length ? (
          <ul className="divide-y divide-line">
            {milk.map((m) => {
              const left = m.expiresOn ? daysBetween(today, m.expiresOn) : null;
              const place = (m.location ?? "fridge") as MilkPlace;
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {Number(m.quantity)} {m.unit ?? units.volume} · {MILK_STORAGE[place]?.label ?? place}
                    </p>
                    <p className="text-sm text-muted">
                      {m.pumpedAt ? `Pumped ${formatShortDate(utcToZoned(m.pumpedAt, tz).date)}` : ""}
                      {m.expiresOn ? ` · use by ${formatShortDate(m.expiresOn)}` : ""}
                    </p>
                  </div>
                  {left !== null && <Badge tone={left < 0 ? "wine" : left <= 1 ? "olive" : "mist"}>{left < 0 ? "Past use-by" : left === 0 ? "Use today" : left === 1 ? "Use tomorrow" : `${left} days left`}</Badge>}
                  {canUse && (
                    <span className="flex flex-wrap items-center gap-1">
                      {place === "freezer" && (
                        <ActionButton action={markMilk} fields={{ id: m.id, op: "thaw" }} className="h-9 rounded-full px-3 text-sm ring-1 ring-line hover:bg-sunken">
                          Thaw
                        </ActionButton>
                      )}
                      <ActionButton action={markMilk} fields={{ id: m.id, op: "use" }} className="h-9 rounded-full px-3 text-sm ring-1 ring-line hover:bg-sunken">
                        Used
                      </ActionButton>
                      <ActionButton action={markMilk} fields={{ id: m.id, op: "discard" }} confirm="Throw this milk out?" className="h-9 rounded-full px-3 text-sm text-muted ring-1 ring-line hover:bg-wine-50 hover:text-wine-500">
                        Toss
                      </ActionButton>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">No milk stored.</p>
        )}
        <p className="text-xs text-muted">
          {Object.values(MILK_STORAGE)
            .map((s) => `${s.label}: ${s.note}`)
            .join(" ")}{" "}
          (CDC guidance for healthy full-term babies.)
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {SECTIONS.map((sec) => {
          const list = items.filter((i) => i.kind === sec.kind);
          return (
            <Card key={sec.kind}>
              <CardHeader title={`${sec.emoji} ${sec.title}`} action={canUse ? <BabySupplyModal kind={sec.kind} babies={babies} today={today} triggerLabel="Add" /> : undefined} />
              {list.length ? (
                <ul className="divide-y divide-line">
                  {list.map((i) => {
                    const isLow = i.lowAt !== null && Number(i.quantity) <= Number(i.lowAt);
                    return (
                      <li key={i.id} className="flex items-center gap-2 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 font-medium">
                            {i.name} {isLow && <Badge tone="olive">Low</Badge>}
                          </p>
                          <p className="text-sm text-muted">
                            {[i.babyId ? babies.find((b) => b.id === i.babyId)?.name : babies.length > 1 ? "Shared" : null, i.lowAt !== null ? `alert at ${Number(i.lowAt)}` : null, i.expiresOn ? `use by ${formatShortDate(i.expiresOn)}` : null, i.notes].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        {canUse ? (
                          <span className="flex items-center rounded-full border border-line">
                            <ActionButton action={adjustBabySupply} fields={{ id: i.id, delta: "-1" }} label={`One less ${i.name}`} className={cn(btn, "rounded-l-full")}>
                              <Minus className="size-4" />
                            </ActionButton>
                            <span className="min-w-12 text-center text-sm font-semibold tabular-nums">
                              {Number(i.quantity)}
                              {i.unit && <span className="block text-[10px] leading-none font-normal text-muted">{i.unit}</span>}
                            </span>
                            <ActionButton action={adjustBabySupply} fields={{ id: i.id, delta: "1" }} label={`One more ${i.name}`} className={cn(btn, "rounded-r-full")}>
                              <Plus className="size-4" />
                            </ActionButton>
                          </span>
                        ) : (
                          <span className="text-sm font-semibold">
                            {Number(i.quantity)} {i.unit}
                          </span>
                        )}
                        {canUse && (
                          <>
                            <BabySupplyModal kind={i.kind} babies={babies} today={today} item={{ id: i.id, kind: i.kind, name: i.name, quantity: i.quantity, unit: i.unit, lowAt: i.lowAt, location: i.location, pumpedOn: null, expiresOn: i.expiresOn, notes: i.notes, babyId: i.babyId }} triggerContent={<Pencil className="size-4" aria-label={`Edit ${i.name}`} />} triggerClassName={btn} />
                            <DeleteButton action={deleteBabySupply} fields={{ id: i.id }} what={i.name} className="size-9" />
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted">{sec.kind === "diapers" ? "Add your diaper stock; each change you log counts one off." : "Nothing tracked yet."}</p>
              )}
            </Card>
          );
        })}
      </div>
      {canShop && (
        <p className="mt-4 text-sm text-muted">
          Low items go to the{" "}
          <Link href="/shopping" className="font-medium text-primary-700 underline">
            shopping list
          </Link>{" "}
          automatically, and everyone helping gets a heads-up.
        </p>
      )}
    </>
  );
}
