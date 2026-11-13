import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, inArray } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/recipes/recipe-actions";
import { db } from "@/db";
import { craftItems } from "@/db/schema";
import { PHASE_LABEL, type PhaseName } from "@/lib/astro";
import { craftVisible } from "@/lib/craft";
import { CRAFT_FIELDS, type CraftKind } from "@/lib/craft-config";
import { craftViewer } from "../../shared";
import { grimoireEntries } from "../grimoire-lib";

export const metadata: Metadata = { title: "Printable grimoire" };

/** A print-ready Book of Shadows: the family's spells, rituals & practices, then journal entries. */
export default async function PrintGrimoire({ searchParams }: PageProps<"/witchcraft/grimoire/print">) {
  const viewer = await craftViewer();
  const sp = (await searchParams) as { entries?: string };
  const [items, entries] = await Promise.all([
    db.select().from(craftItems).where(and(craftVisible(viewer), eq(craftItems.familyId, viewer.family.id), inArray(craftItems.kind, ["spell", "ritual", "wellness"]))).orderBy(asc(craftItems.kind), asc(craftItems.name)),
    sp.entries === "0" ? Promise.resolve([]) : grimoireEntries(viewer),
  ]);
  return (
    <article className="mx-auto max-w-3xl font-serif print:max-w-none">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href="/witchcraft/grimoire" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Grimoire
        </Link>
        <div className="flex items-center gap-2 text-sm">
          <Link href={sp.entries === "0" ? "?" : "?entries=0"} className="rounded-full px-3 py-1.5 hover:bg-sunken">
            {sp.entries === "0" ? "Include journal entries" : "Spells & rituals only"}
          </Link>
          <PrintButton />
        </div>
      </div>
      <header className="mb-10 border-b-2 border-ink pb-6 text-center">
        <p className="text-sm tracking-[0.3em] text-muted uppercase">Book of Shadows</p>
        <h1 className="font-display text-4xl font-semibold">The {viewer.family.name} Grimoire</h1>
      </header>
      {items.map((it) => (
        <section key={it.id} className="mb-10 break-inside-avoid-page">
          <p className="text-xs tracking-[0.2em] text-muted uppercase">
            {it.kind} {it.moonPhase && `· ${PHASE_LABEL[it.moonPhase as PhaseName] ?? it.moonPhase}`}
          </p>
          <h2 className="font-display text-2xl font-semibold">
            {it.emoji} {it.name}
          </h2>
          {it.description && <p className="mt-1 italic">{it.description}</p>}
          {CRAFT_FIELDS[it.kind as CraftKind]
            .filter((f) => it.fields[f.name])
            .map((f) => (
              <div key={f.name} className="mt-3">
                <h3 className="text-sm font-semibold">{f.label}</h3>
                <p className="whitespace-pre-line">{it.fields[f.name]}</p>
              </div>
            ))}
          {it.notes && <p className="mt-3 whitespace-pre-line text-ink-soft">{it.notes}</p>}
        </section>
      ))}
      {entries.length > 0 && (
        <>
          <h2 className="mt-12 mb-6 border-b border-line pb-2 font-display text-3xl font-semibold" style={{ breakBefore: "page" }}>
            Journal
          </h2>
          {entries.map((e) => (
            <section key={e.id} className="mb-8 break-inside-avoid">
              <p className="text-sm text-muted">
                {e.date}
                {e.moonPhase && ` · ${PHASE_LABEL[e.moonPhase as PhaseName] ?? e.moonPhase}`}
              </p>
              {e.title && <h3 className="text-xl font-semibold">{e.title}</h3>}
              <p className="whitespace-pre-line">{e.body}</p>
            </section>
          ))}
        </>
      )}
      {items.length === 0 && entries.length === 0 && <p className="text-center text-muted">Add spells, rituals or grimoire entries to build your book.</p>}
    </article>
  );
}
