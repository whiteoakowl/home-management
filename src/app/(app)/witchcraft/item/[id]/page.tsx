import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { ArrowLeft, Copy, Heart, ShieldAlert, ShoppingBasket, Sprout } from "lucide-react";
import { addHerbToGarden, copyCraftItem, deleteCollectionEntry, deleteCraftItem, shopForSupplies, toggleCraftFavorite } from "@/app/actions/craft";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { CraftItemModal, craftValues } from "@/components/craft/craft-parts";
import { CollectionModal } from "@/components/craft/collection-modal";
import { CraftTabs } from "@/components/craft/craft-tabs";
import { DetailList, fmtDate } from "@/components/records/detail-list";
import { PrintButton } from "@/components/recipes/recipe-actions";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/display";
import { db } from "@/db";
import { craftItemSupplies, inventoryItems, journalEntries, plants } from "@/db/schema";
import { nextPhase } from "@/lib/astro";
import { collectionFor, getCraftItem } from "@/lib/craft";
import { CRAFT_FIELDS, CRAFT_META, MOON_OPTIONS, SABBAT_OPTIONS, SAFETY_LABEL, SAFETY_TONE, type CraftKind } from "@/lib/craft-config";
import { fileUrl } from "@/lib/files";
import { memberOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { craftViewer } from "../../shared";

export const metadata: Metadata = { title: "Witchcraft" };

const HERB_SAFETY = ["safety", "petSafety"];
const HERB_LORE = ["magicalUses", "folklore"];

export default async function CraftItemPage({ params }: PageProps<"/witchcraft/item/[id]">) {
  const { id } = await params;
  const viewer = await craftViewer();
  const it = await getCraftItem(viewer, id);
  if (!it) notFound();
  const kind = it.kind as CraftKind;
  const meta = CRAFT_META[kind];
  const own = it.familyId === viewer.family.id;
  const canEdit = viewer.can("witchcraft", "edit");
  const canChange = canEdit && own && (viewer.isParent || it.createdByMemberId === viewer.member.id || it.visibility === "family");
  const isSpellish = kind === "spell" || kind === "ritual";
  const [members, linked, allSupplies, plantRows, coll, entries] = await Promise.all([
    memberOptions(viewer),
    isSpellish ? db.select({ i: inventoryItems }).from(craftItemSupplies).innerJoin(inventoryItems, eq(inventoryItems.id, craftItemSupplies.inventoryItemId)).where(eq(craftItemSupplies.itemId, it.id)) : [],
    isSpellish ? db.select({ id: inventoryItems.id, name: inventoryItems.name }).from(inventoryItems).where(and(eq(inventoryItems.familyId, viewer.family.id), eq(inventoryItems.location, "craft"))).orderBy(asc(inventoryItems.name)) : [],
    kind === "herb" ? db.select({ id: plants.id, name: plants.name, familyId: plants.familyId }).from(plants).where(or(isNull(plants.familyId), eq(plants.familyId, viewer.family.id))).orderBy(asc(plants.name)) : [],
    kind === "crystal" || kind === "tool" ? collectionFor(viewer, [it.id]) : [],
    isSpellish
      ? db.select().from(journalEntries).where(and(eq(journalEntries.familyId, viewer.family.id), eq(journalEntries.book, "grimoire"), eq(journalEntries.linkedId, it.id), or(eq(journalEntries.authorMemberId, viewer.member.id), inArray(journalEntries.visibility, ["family"])))).orderBy(desc(journalEntries.date)).limit(10)
      : [],
  ]);
  const values = craftValues(it);
  const img = fileUrl(it.imageFileId);
  const supplies = linked.map((l) => l.i);
  const low = supplies.filter((s) => Number(s.quantity) <= 0 || (s.lowStockThreshold !== null && Number(s.quantity) <= Number(s.lowStockThreshold)));
  const plant = plantRows.find((p) => p.id === it.plantId);
  const moonLabel = it.moonPhase ? MOON_OPTIONS.find((m) => m.value === it.moonPhase)?.label : null;
  const target = { full_moon: "full", new_moon: "new", first_quarter: "first_quarter", last_quarter: "last_quarter" }[it.moonPhase ?? ""] as "full" | undefined;
  const nextMoon = target ? nextPhase(target, new Date()) : null;
  const herbSafety = kind === "herb";
  const shown = CRAFT_FIELDS[kind].filter((f) => !["name", "category", "emoji", "description", "moonPhase", "sabbat", ...(herbSafety ? [...HERB_SAFETY, ...HERB_LORE] : [])].includes(f.name));

  return (
    <article className="mx-auto flex max-w-5xl flex-col gap-6">
      <Link href={`/witchcraft/library/${kind}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink print:hidden">
        <ArrowLeft className="size-4" /> {meta.plural}
      </Link>
      <div className="print:hidden">
        <CraftTabs active={kind} />
      </div>
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <span className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-card)] bg-gradient-to-br from-[#2d0f26] to-[#6a2d5e] text-6xl">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={it.name} className="size-full object-cover" />
          ) : (
            <span aria-hidden>{it.emoji ?? meta.emoji}</span>
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="primary">{meta.label}</Badge>
            {herbSafety && it.category && <Badge tone={SAFETY_TONE[it.category]}>{SAFETY_LABEL[it.category]}</Badge>}
            {!herbSafety && it.category && <Badge>{it.category.replace(/_/g, " ")}</Badge>}
            {moonLabel && <Badge tone="mist">🌙 {moonLabel}</Badge>}
            {it.sabbat && <Badge tone="olive">{SABBAT_OPTIONS.find((s) => s.value === it.sabbat)?.label}</Badge>}
            {!own && <Badge>Reference library</Badge>}
          </div>
          <h1 className="text-[32px] leading-tight font-semibold">{it.name}</h1>
          {it.description && <p className="text-[17px] text-ink-soft">{it.description}</p>}
          {nextMoon && <p className="text-sm text-muted">Next {moonLabel?.toLowerCase()}: {nextMoon.at.toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: viewer.family.timezone })}</p>}
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {canChange && (
              <>
                <ActionButton action={toggleCraftFavorite} fields={{ id: it.id }} className={cn("h-10 rounded-full border px-4 text-sm font-medium", it.isFavorite ? "border-wine-100 bg-wine-50 text-wine-700" : "border-line-strong hover:bg-sunken")}>
                  <Heart className={cn("size-4", it.isFavorite && "fill-current")} /> {it.isFavorite ? "Favorite" : "Mark favorite"}
                </ActionButton>
                <CraftItemModal kind={kind} item={it} members={members} supplies={allSupplies} supplyIds={supplies.map((s) => s.id)} plants={plantRows} />
                <DeleteButton action={deleteCraftItem} fields={{ id: it.id }} what={`"${it.name}"`} />
              </>
            )}
            {canEdit && !own && (
              <ActionButton action={copyCraftItem} fields={{ id: it.id }} className="h-10 rounded-full border border-line-strong px-4 text-sm font-medium hover:bg-sunken">
                <Copy className="size-4" /> Save a copy to customize
              </ActionButton>
            )}
            {canEdit && (kind === "crystal" || kind === "tool") && <CollectionModal itemId={it.id} />}
            {herbSafety && canEdit && viewer.can("garden", "edit") && it.category !== "toxic" && (
              <ActionButton action={addHerbToGarden} fields={{ id: it.id }} className="h-10 rounded-full border border-line-strong px-4 text-sm font-medium hover:bg-sunken">
                <Sprout className="size-4" /> {it.plantId ? "Open in garden" : "Add to our garden plants"}
              </ActionButton>
            )}
            {isSpellish && <PrintButton />}
          </div>
        </div>
      </header>

      {herbSafety && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className={cn("rounded-2xl border p-4", it.category === "toxic" ? "border-wine-200 bg-wine-50" : "border-olive-100 bg-olive-50")} aria-label="Safety">
            <h2 className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="size-5" aria-hidden /> Safety first
            </h2>
            {it.fields.safety && <p className="mt-2 text-sm">{it.fields.safety}</p>}
            {it.fields.petSafety && (
              <p className="mt-2 text-sm">
                <strong>Pets:</strong> {it.fields.petSafety}
              </p>
            )}
            <p className="mt-3 text-xs text-muted">Not medical advice. Ask a doctor, pharmacist or vet before using any herb, especially if pregnant, nursing, taking medication, or around children and pets.</p>
          </section>
          <section className="rounded-2xl border border-line bg-surface p-4" aria-label="Folklore">
            <h2 className="font-semibold">Folklore &amp; magical associations</h2>
            <p className="mt-1 text-xs text-muted">Spiritual tradition, not medicine.</p>
            {it.fields.magicalUses && <p className="mt-2 text-sm">{it.fields.magicalUses}</p>}
            {it.fields.folklore && <p className="mt-2 text-sm text-ink-soft">{it.fields.folklore}</p>}
          </section>
        </div>
      )}

      <Card>
        <DetailList fields={shown} values={values} />
        {plant && (
          <p className="mt-4 text-sm">
            🌱 Grows in the garden as{" "}
            <Link href={`/garden/plants/${plant.id}`} className="font-medium text-primary-700 underline">
              {plant.name}
            </Link>
          </p>
        )}
      </Card>

      {isSpellish && (
        <Card>
          <CardHeader
            title="Supplies check"
            icon={<ShoppingBasket className="size-4" />}
            action={
              low.length > 0 &&
              viewer.can("shopping", "edit") && (
                <ActionButton action={shopForSupplies} fields={{ ids: low.map((s) => s.id).join(",") }} className="h-9 rounded-full bg-primary-50 px-3 text-sm font-semibold text-primary-700 hover:bg-primary-100 print:hidden">
                  Add {low.length} to shopping
                </ActionButton>
              )
            }
          />
          {supplies.length ? (
            <ul className="flex flex-wrap gap-2">
              {supplies.map((s) => {
                const out = Number(s.quantity) <= 0;
                const isLow = low.includes(s);
                return (
                  <li key={s.id} className={cn("rounded-full px-3 py-1.5 text-sm", out ? "bg-wine-50 text-wine-700" : isLow ? "bg-olive-50 text-olive-700" : "bg-primary-50 text-primary-700")}>
                    {s.name} · {out ? "out" : `${Number(s.quantity)} ${s.unit ?? ""}`.trim()}
                    {isLow && !out && " (low)"}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">No supplies linked. {canChange ? "Edit this entry to link supplies from your inventory." : ""}</p>
          )}
        </Card>
      )}

      {coll.length > 0 && (
        <Card>
          <CardHeader title="In your collection" />
          <ul className="divide-y divide-line">
            {coll.map(({ c }) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5">
                {c.photoFileId && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fileUrl(c.photoFileId, true)!} alt="" className="size-12 rounded-lg object-cover" />
                )}
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">
                    {c.status === "wishlist" ? "Wish list" : `${c.quantity} ${c.status}`} {c.location && <span className="text-muted">· {c.location}</span>}
                  </p>
                  <p className="text-muted">{[c.acquiredOn ? `Acquired ${fmtDate(c.acquiredOn)}` : null, c.notes].filter(Boolean).join(" · ")}</p>
                </div>
                {canEdit && (
                  <div className="flex">
                    <CollectionModal itemId={it.id} entry={c} />
                    <DeleteButton action={deleteCollectionEntry} fields={{ id: c.id }} what="this collection entry" />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {isSpellish && entries.length > 0 && (
        <Card>
          <CardHeader title="Grimoire notes" href="/witchcraft/grimoire" />
          <ul className="divide-y divide-line">
            {entries.map((e) => (
              <li key={e.id} className="py-2.5 text-sm">
                <span className="text-muted">{fmtDate(e.date)}</span> · <span className="font-medium">{e.title ?? "Entry"}</span>
                <p className="line-clamp-2 text-ink-soft">{e.body}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {it.source && <p className="text-xs text-muted">Source: {it.source}</p>}
    </article>
  );
}
