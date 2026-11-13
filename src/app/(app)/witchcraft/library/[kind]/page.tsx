import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { Search, Sparkles } from "lucide-react";
import { db } from "@/db";
import { inventoryItems, plants } from "@/db/schema";
import { CraftCard, CraftItemModal } from "@/components/craft/craft-parts";
import { CraftTabs } from "@/components/craft/craft-tabs";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { collectionFor, listCraft } from "@/lib/craft";
import { CRAFT_FIELDS, CRAFT_KINDS, CRAFT_META, MOON_OPTIONS, type CraftKind } from "@/lib/craft-config";
import { memberOptions } from "@/lib/queries";
import { craftViewer } from "../../shared";

export async function generateMetadata({ params }: PageProps<"/witchcraft/library/[kind]">): Promise<Metadata> {
  const { kind } = await params;
  return { title: CRAFT_META[kind as CraftKind]?.plural ?? "Library" };
}

export default async function LibraryPage({ params, searchParams }: PageProps<"/witchcraft/library/[kind]">) {
  const { kind: k } = await params;
  if (!CRAFT_KINDS.includes(k as CraftKind)) notFound();
  const kind = k as CraftKind;
  const sp = (await searchParams) as { q?: string; category?: string; fav?: string; moon?: string; mine?: string };
  const viewer = await craftViewer();
  const meta = CRAFT_META[kind];
  const canEdit = viewer.can("witchcraft", "edit");
  const [members, rowsAll, supplies, plantRows] = await Promise.all([
    memberOptions(viewer),
    listCraft(viewer, kind, { q: sp.q, category: sp.category, favorites: sp.fav === "1", moon: sp.moon }),
    kind === "spell" || kind === "ritual" ? db.select({ id: inventoryItems.id, name: inventoryItems.name }).from(inventoryItems).where(and(eq(inventoryItems.familyId, viewer.family.id), eq(inventoryItems.location, "craft"))).orderBy(asc(inventoryItems.name)) : [],
    kind === "herb" ? db.select({ id: plants.id, name: plants.name }).from(plants).where(or(isNull(plants.familyId), eq(plants.familyId, viewer.family.id))).orderBy(asc(plants.name)) : [],
  ]);
  const rows = sp.mine === "1" ? rowsAll.filter((r) => r.familyId) : rowsAll;
  const coll = kind === "crystal" || kind === "tool" ? await collectionFor(viewer, rows.map((r) => r.id)) : [];
  const owned = (id: string) => coll.filter((c) => c.c.itemId === id && c.c.status === "owned").reduce((s, c) => s + c.c.quantity, 0);
  const categories = CRAFT_FIELDS[kind].find((f) => f.name === "category")?.options ?? [];
  const add = canEdit ? <CraftItemModal kind={kind} members={members} supplies={supplies} plants={plantRows} /> : undefined;
  const sel = "h-10 rounded-full border border-line-strong bg-surface px-3 text-sm";
  return (
    <>
      <PageHeader eyebrow="Witchcraft" title={meta.plural} description={meta.blurb} actions={add} />
      <CraftTabs active={kind} />
      {kind === "herb" && (
        <p className="mb-4 rounded-xl border border-olive-100 bg-olive-50 px-4 py-3 text-sm text-ink-soft">
          Magical correspondences are folklore and spiritual tradition, not medicine. Never ingest a plant because of its magical use; toxic plants are reference-only. Check with a doctor, pharmacist or vet about
          allergies, pregnancy, medications and pets.
        </p>
      )}
      {kind === "wellness" && <p className="mb-4 rounded-xl bg-sunken px-4 py-3 text-sm text-muted">Spiritual self-care practices. Not medical or mental-health advice; reach out to a professional when you need support.</p>}
      {kind === "crystal" && (
        <p className="mb-4 text-sm text-muted">
          Crystal meanings are spiritual beliefs, not proven effects.{" "}
          <a href="/witchcraft/collection" className="font-medium text-primary-700 underline">
            View your collection
          </a>
        </p>
      )}
      <form className="mb-5 flex flex-wrap items-center gap-2" role="search">
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input name="q" defaultValue={sp.q} placeholder={`Search ${meta.plural.toLowerCase()}…`} className="h-10 w-full rounded-full border border-line-strong bg-surface pr-4 pl-9 text-sm" />
        </label>
        {categories.length > 0 && (
          <select name="category" defaultValue={sp.category ?? ""} aria-label="Category" className={sel}>
            <option value="">All {kind === "herb" ? "safety levels" : "categories"}</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        )}
        {(kind === "spell" || kind === "ritual" || kind === "wellness") && (
          <select name="moon" defaultValue={sp.moon ?? ""} aria-label="Moon phase" className={sel}>
            <option value="">Any moon</option>
            {MOON_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        )}
        <label className="inline-flex h-10 items-center gap-2 rounded-full border border-line-strong bg-surface px-3 text-sm">
          <input type="checkbox" name="fav" value="1" defaultChecked={sp.fav === "1"} /> Favorites
        </label>
        {(kind === "crystal" || kind === "herb" || kind === "tool") && (
          <label className="inline-flex h-10 items-center gap-2 rounded-full border border-line-strong bg-surface px-3 text-sm">
            <input type="checkbox" name="mine" value="1" defaultChecked={sp.mine === "1"} /> Our entries only
          </label>
        )}
        <button className="h-10 rounded-full bg-ink px-4 text-sm font-medium text-white">Filter</button>
      </form>
      {rows.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((it) => (
            <CraftCard key={it.id} it={it} owned={owned(it.id)} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={<Sparkles />} title={sp.q || sp.category || sp.fav || sp.moon ? "Nothing matches" : `No ${meta.plural.toLowerCase()} yet`} description={sp.q ? "Try a different search." : meta.blurb} action={!sp.q && add} />
        </Card>
      )}
    </>
  );
}
