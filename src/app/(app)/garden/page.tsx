import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, count, eq } from "drizzle-orm";
import { CloudSun, Leaf, Map as MapIcon, Shovel, Sprout, Wheat } from "lucide-react";
import { db } from "@/db";
import { seedInventory } from "@/db/schema";
import { LogGardenModal, NewGardenPlanModal } from "@/components/garden/garden-forms";
import { PlantAvatar } from "@/components/garden/plant-avatar";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { addDays, formatShortDate, relativeTime, todayIn } from "@/lib/dates";
import { gardenLog, gardenPlanList, plantingsWithPlants, plantOptions, SEASON_TIPS, seasonFor } from "@/lib/garden";
import { getWeather } from "@/lib/weather";
import { GardenTabs } from "./garden-tabs";

export const metadata: Metadata = { title: "Garden" };

export default async function GardenPage({ searchParams }: PageProps<"/garden">) {
  const viewer = await getViewer();
  if (!viewer.can("garden")) notFound();
  const sp = await searchParams;
  const today = todayIn(viewer.family.timezone);
  const f = viewer.family;
  const [plans, plantings, log, plants, [seeds], weather] = await Promise.all([
    gardenPlanList(viewer),
    plantingsWithPlants(viewer),
    gardenLog(viewer, 8),
    plantOptions(viewer),
    db.select({ n: count() }).from(seedInventory).where(and(eq(seedInventory.familyId, f.id))),
    getWeather(f.latitude, f.longitude, f.timezone),
  ]);
  const season = seasonFor(today, f.latitude);
  const growing = plantings.filter((p) => ["sown", "growing", "harvesting"].includes(p.status));
  const toPlant = plantings.filter((p) => p.status === "planned");
  const harvests = plantings.filter((p) => p.expectedHarvestOn && p.expectedHarvestOn >= today && p.expectedHarvestOn <= addDays(today, 30)).sort((a, b) => a.expectedHarvestOn!.localeCompare(b.expectedHarvestOn!));
  const canEdit = viewer.can("garden", "edit");
  const year = Number(today.slice(0, 4));
  const latestSoil = plans.find((p) => p.notes)?.notes;
  const plantingOpts = plantings.filter((p) => p.status !== "finished").map((p) => ({ id: p.id, label: `${p.plantName}${p.planName ? ` · ${p.planName}` : ""}` }));

  return (
    <>
      <PageHeader
        eyebrow="Land"
        title="Garden"
        description="Plan beds, track every planting, and log what you harvest."
        actions={canEdit ? <><LogGardenModal plantings={plantingOpts} plants={plants} canKitchen={viewer.can("kitchen", "edit")} /><NewGardenPlanModal year={year} defaultOpen={sp.new === "1"} /></> : undefined}
      />
      <GardenTabs active="overview" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="bg-gradient-to-br from-olive-50 to-surface">
          <p className="text-sm text-muted">Current season</p>
          <p className="font-display text-3xl font-semibold">{season}</p>
          <p className="mt-2 text-sm text-ink-soft">{SEASON_TIPS[season]}</p>
        </Card>
        <Card>
          <p className="flex items-center gap-2 text-sm text-muted">
            <CloudSun className="size-4" /> Weather
          </p>
          {weather ? (
            <p className="font-display text-3xl font-semibold">
              {weather.tempF}° <span className="text-base font-normal text-muted">{weather.label}</span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">Add your location in Settings for local weather.</p>
          )}
          {latestSoil && <p className="mt-2 line-clamp-2 text-sm text-ink-soft">Soil notes: {latestSoil}</p>}
        </Card>
        <Card>
          <p className="text-sm text-muted">Growing now</p>
          <p className="font-display text-3xl font-semibold">{growing.reduce((s, p) => s + p.quantity, 0)}</p>
          <p className="text-sm text-muted">plants in {new Set(growing.map((g) => g.plantName)).size} varieties</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Seeds on hand</p>
          <p className="font-display text-3xl font-semibold">{seeds?.n ?? 0}</p>
          <Link href="/garden/seeds" className="text-sm font-medium text-primary-600 hover:underline">
            Seed inventory →
          </Link>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="mb-3 text-xl font-semibold">Garden plans</h2>
          {plans.length === 0 ? (
            <Card>
              <EmptyState icon={<MapIcon />} title="No garden plans yet" description="Draw your beds, then drag plants onto them." example="“2027 Garden Plan”: Bed 1: tomatoes, basil, marigolds" action={canEdit ? <NewGardenPlanModal year={year} /> : undefined} />
            </Card>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {plans.map((p) => {
                const beds = p.layout.objects.filter((o) => ["bed", "row", "container"].includes(o.type)).length;
                const n = plantings.filter((x) => x.planId === p.id).length;
                return (
                  <li key={p.id}>
                    <Link href={`/garden/plans/${p.id}`} className="flex h-full flex-col gap-2 rounded-2xl border border-line bg-surface p-4 hover:border-primary-300">
                      <div className="flex items-center gap-3">
                        <span className="flex size-10 items-center justify-center rounded-xl bg-olive-50 text-olive-700">
                          <MapIcon className="size-5" />
                        </span>
                        <div>
                          <p className="font-semibold">{p.name}</p>
                          <p className="text-sm text-muted">
                            {p.layout.width}×{p.layout.height} {p.layout.unit} · {beds} bed{beds === 1 ? "" : "s"} · {n} planting{n === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <h2 className="mt-8 mb-3 text-xl font-semibold">Recent activity</h2>
          {log.length === 0 ? (
            <Card>
              <EmptyState compact icon={<Leaf />} title="Nothing logged yet" description="Log plantings, watering, pests and harvests to build your garden's history." />
            </Card>
          ) : (
            <ul className="flex flex-col gap-2">
              {log.map(({ l, plantName, imageUrl, category }) => (
                <li key={l.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
                  <PlantAvatar imageUrl={imageUrl} name={plantName ?? "?"} category={category} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      <span className="capitalize">{l.kind.replace("_", " ")}</span>
                      {plantName && ` · ${plantName}`}
                      {l.quantity && ` · ${Number(l.quantity)} ${l.unit ?? ""}`}
                    </p>
                    {l.notes && <p className="truncate text-sm text-muted">{l.notes}</p>}
                  </div>
                  <span className="text-sm text-muted">{l.date === today ? relativeTime(l.createdAt) : formatShortDate(l.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Upcoming harvests" icon={<Wheat className="size-4" />} href="/garden/log" />
            {harvests.length === 0 ? (
              <p className="text-sm text-muted">Set planting dates and we&apos;ll estimate harvests from days to maturity.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {harvests.slice(0, 6).map((h) => (
                  <li key={h.id} className="flex items-center gap-3">
                    <PlantAvatar imageUrl={h.imageUrl} photoUrl={h.photoUrl} name={h.plantName} category={h.category} size="sm" />
                    <span className="flex-1 text-[15px]">{h.plantName}</span>
                    <Badge tone="olive">{formatShortDate(h.expectedHarvestOn!)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Ready to plant" icon={<Shovel className="size-4" />} href="/garden/log" />
            {toPlant.length === 0 ? (
              <p className="text-sm text-muted">Plants you add to a plan show up here until they&apos;re in the ground.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {toPlant.slice(0, 8).map((p) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <PlantAvatar imageUrl={p.imageUrl} photoUrl={p.photoUrl} name={p.plantName} category={p.category} size="sm" />
                    <span className="flex-1 text-[15px]">
                      {p.plantName} <span className="text-muted">×{p.quantity}</span>
                    </span>
                    <span className="text-xs text-muted">{p.planName}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Plant database" icon={<Sprout className="size-4" />} href="/garden/plants" hrefLabel="Browse" />
            <p className="text-sm text-muted">{plants.length} plants with spacing, sun, soil, companions and timing.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
