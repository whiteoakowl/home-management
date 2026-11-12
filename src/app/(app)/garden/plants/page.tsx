import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Search, Sprout, Sun } from "lucide-react";
import { PlantFormModal } from "@/components/garden/garden-forms";
import { PlantAvatar } from "@/components/garden/plant-avatar";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { SegmentLinks } from "@/components/ui/tabs";
import { getViewer } from "@/lib/dal";
import { plantOptions } from "@/lib/garden";
import { GardenTabs } from "../garden-tabs";

export const metadata: Metadata = { title: "Plant database" };

const SUN_LABEL: Record<string, string> = { full_sun: "Full sun", partial_sun: "Part sun", partial_shade: "Part shade", full_shade: "Shade" };

export default async function PlantsPage({ searchParams }: PageProps<"/garden/plants">) {
  const viewer = await getViewer();
  if (!viewer.can("garden")) notFound();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.toLowerCase().trim() : "";
  const cat = typeof sp.category === "string" ? sp.category : "all";
  const all = await plantOptions(viewer);
  const cats = [...new Set(all.map((p) => p.category).filter(Boolean))] as string[];
  const shown = all.filter((p) => (cat === "all" || p.category === cat) && (!q || `${p.name} ${p.variety ?? ""}`.toLowerCase().includes(q)));
  return (
    <>
      <PageHeader eyebrow="Garden" title="Plant database" description="Growing guides for every plant: spacing, sun, soil, companions and timing." actions={viewer.can("garden", "edit") ? <PlantFormModal defaultOpen={sp.new === "1"} /> : undefined} />
      <GardenTabs active="plants" />
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center">
        <form className="relative flex-1" action="/garden/plants">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="plant-q" className="sr-only">
            Search plants
          </label>
          <input id="plant-q" name="q" defaultValue={q} placeholder="Search plants…" className="h-11 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface pr-3 pl-10 text-[15px] focus:border-primary-500 focus:outline-none" />
          {cat !== "all" && <input type="hidden" name="category" value={cat} />}
        </form>
        <SegmentLinks active={cat} items={[{ key: "all", href: `/garden/plants?q=${q}`, label: "All" }, ...cats.map((c) => ({ key: c, href: `/garden/plants?category=${c}&q=${q}`, label: c }))]} />
      </div>
      {shown.length === 0 ? (
        <Card>
          <EmptyState icon={<Sprout />} title="No plants match" description="Try another search, or add your own plant." />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((p) => (
            <li key={p.id}>
              <Link href={`/garden/plants/${p.id}`} className="flex h-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 hover:border-primary-300">
                <PlantAvatar imageUrl={p.imageUrl} photoUrl={p.photoUrl} name={p.name} category={p.category} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  {p.variety && <p className="truncate text-sm text-muted">{p.variety}</p>}
                  <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted">
                    {p.sun && (
                      <span className="inline-flex items-center gap-1">
                        <Sun className="size-3" /> {SUN_LABEL[p.sun]}
                      </span>
                    )}
                    {p.spacingIn && <span>{Number(p.spacingIn)}″ apart</span>}
                    {p.daysToMaturity && <span>{p.daysToMaturity}</span>}
                  </p>
                </div>
                {p.isCustom && <Badge tone="primary">Yours</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
