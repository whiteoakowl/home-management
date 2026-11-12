import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { Icon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { globalSearch } from "@/lib/search";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const viewer = await getViewer();
  const { q: raw } = await searchParams;
  const q = typeof raw === "string" ? raw : "";
  const groups = await globalSearch(viewer, q);
  const total = groups.reduce((s, g) => s + g.hits.length, 0);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Search" description="Find anything: chores, events, recipes, plants, animals, inventory, lists, journal, goals, budget and fitness." />
      <form action="/search" className="relative mb-6">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" aria-hidden />
        <label htmlFor="global-q" className="sr-only">
          Search everything
        </label>
        <input id="global-q" name="q" defaultValue={q} autoFocus placeholder="Search everything…" className="h-14 w-full rounded-2xl border border-line-strong bg-surface pr-4 pl-12 text-[17px] shadow-[var(--shadow-card)] focus:border-primary-500 focus:ring-4 focus:ring-primary-100 focus:outline-none" />
      </form>
      {q.trim().length >= 2 && total === 0 && (
        <Card>
          <EmptyState icon={<Search />} title={`No results for “${q}”`} description="Try a different word, or check the spelling." />
        </Card>
      )}
      {q.trim().length > 0 && q.trim().length < 2 && <p className="text-muted">Type at least two characters.</p>}
      {total > 0 && <p className="mb-4 text-sm text-muted">{total} result{total === 1 ? "" : "s"}</p>}
      <div className="flex flex-col gap-6">
        {groups.map((g) => (
          <section key={g.key}>
            <h2 className="mb-2 flex items-center gap-2 font-sans text-sm font-semibold tracking-wide text-muted uppercase">
              <Icon name={g.icon} className="size-4" /> {g.label}
            </h2>
            <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
              {g.hits.map((h) => (
                <li key={h.id} className="border-b border-line/70 last:border-0">
                  <Link href={h.href} className="flex flex-col px-4 py-3 hover:bg-sunken/60">
                    <span className="font-medium">{h.title}</span>
                    {h.subtitle && <span className="truncate text-sm text-muted first-letter:uppercase">{h.subtitle}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
