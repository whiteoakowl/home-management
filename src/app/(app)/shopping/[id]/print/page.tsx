import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AutoPrint } from "@/components/meals/week-controls";
import { PrintButton } from "@/components/recipes/recipe-actions";
import { getViewer } from "@/lib/dal";
import { formatShortDate, todayIn } from "@/lib/dates";
import { loadList, loadListItems } from "@/lib/lists";
import { FitToPage } from "@/components/lists/fit-to-page";
import { sectionFor, SHOPPING_SECTIONS } from "@/lib/shopping-category";

export const metadata: Metadata = { title: "Print grocery list" };

/** The grocery list on one printed page, by store section, in as many columns as it needs. */
export default async function PrintShoppingList({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ auto?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const viewer = await getViewer();
  const list = await loadList(viewer, id).catch(() => null);
  if (!list || list.kind !== "shopping") notFound();
  const items = (await loadListItems(id, viewer)).filter((i) => !i.checked);
  const groups = [
    ...SHOPPING_SECTIONS.map((s) => ({ key: s.value, label: s.label, items: items.filter((i) => !i.personalFor && sectionFor(i) === s.value) })),
    { key: "personal", label: "Personal items", items: items.filter((i) => i.personalFor) },
  ].filter((g) => g.items.length);
  const qty = (i: (typeof items)[number]) => [i.quantity && Number(i.quantity) !== 1 ? Number(i.quantity) : null, i.unit].filter(Boolean).join(" ");

  return (
    <div className="mx-auto max-w-5xl">
      <AutoPrint when={sp.auto === "print"} />
      {/* One page: small margins, and nothing else from the app on the paper. */}
      <style>{`@page { size: auto; margin: 0.35in; } @media print { html, body { height: auto !important; } }`}</style>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/shopping/${id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Back to the list
        </Link>
        <PrintButton label="Print" />
      </div>
      <section className="rounded-[var(--radius-card)] border border-line bg-white p-6 text-black print:border-0 print:p-0">
        <FitToPage>
        <header className="mb-[0.6em] flex items-baseline justify-between gap-4 border-b border-black/30 pb-[0.3em]">
          <h1 className="font-semibold" style={{ fontSize: "1.5em" }}>
            {list.title}
            {list.store ? <span className="font-normal text-black/60"> · {list.store}</span> : null}
          </h1>
          <span className="text-black/60">
            {items.length} item{items.length === 1 ? "" : "s"} · {formatShortDate(todayIn(viewer.family.timezone))}
          </span>
        </header>
        {items.length === 0 ? (
          <p>Nothing left to buy. 🎉</p>
        ) : (
            groups.map((g) => (
              <div key={g.key} className="mb-[0.7em]">
                <h2 className="mb-[0.15em] border-b border-black/20 font-bold tracking-wide uppercase" style={{ fontSize: "0.85em", breakAfter: "avoid" }}>
                  {g.label}
                </h2>
                <ul>
                  {g.items.map((i) => (
                    <li key={i.id} className="flex items-start gap-[0.4em] py-[0.08em]" style={{ breakInside: "avoid" }}>
                      <span className="mt-[0.15em] inline-block size-[0.85em] shrink-0 rounded-[2px] border border-black/70" aria-hidden />
                      <span className="min-w-0">
                        {i.text}
                        {qty(i) && <span className="text-black/60"> ({qty(i)})</span>}
                        {i.personalFor && <span className="text-black/60"> · for {i.personalFor.name}</span>}
                        {i.notes && <span className="block text-black/60" style={{ fontSize: "0.85em" }}>{i.notes}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
        )}
        </FitToPage>
      </section>
    </div>
  );
}
