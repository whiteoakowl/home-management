import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { AlarmClock, Map as MapIcon, PawPrint, Wheat } from "lucide-react";
import { db } from "@/db";
import { animalHealthRecords, animals, farmPlans, feedLogs, productionLogs } from "@/db/schema";
import { BarChart } from "@/components/charts";
import { AnimalAvatar } from "@/components/farm/animal-avatar";
import { AnimalFormModal, FeedModal, NewFarmPlanModal, ProductionModal } from "@/components/farm/farm-forms";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { addDays, formatShortDate, todayIn } from "@/lib/dates";
import { animalOptions, productionKindsUsed, productionSeries } from "@/lib/farm";
import { fileUrl } from "@/lib/files";
import { FarmTabs } from "./farm-tabs";

export const metadata: Metadata = { title: "Farm" };

export default async function FarmPage({ searchParams }: PageProps<"/farm">) {
  const viewer = await getViewer();
  if (!viewer.can("farm")) notFound();
  const sp = await searchParams;
  const today = todayIn(viewer.family.timezone);
  const fid = viewer.family.id;
  const [opts, bySpecies, plans, healthDue, feed, kinds] = await Promise.all([
    animalOptions(viewer),
    db
      .select({ species: animals.species, head: sql<number>`sum(${animals.headCount})::int`, photo: sql<string | null>`min(${animals.imageFileId}::text)` })
      .from(animals)
      .where(and(eq(animals.familyId, fid), eq(animals.status, "active")))
      .groupBy(animals.species)
      .orderBy(asc(animals.species)),
    db.select().from(farmPlans).where(eq(farmPlans.familyId, fid)).orderBy(asc(farmPlans.name)),
    db
      .select({ id: animalHealthRecords.id, kind: animalHealthRecords.kind, due: animalHealthRecords.nextDueOn, name: animals.name, animalId: animals.id })
      .from(animalHealthRecords)
      .innerJoin(animals, eq(animals.id, animalHealthRecords.animalId))
      .where(and(eq(animals.familyId, fid), lte(animalHealthRecords.nextDueOn, addDays(today, 30))))
      .orderBy(asc(animalHealthRecords.nextDueOn))
      .limit(6),
    db
      .select({ feed: feedLogs.feed, unit: feedLogs.unit, total: sql<number>`sum(${feedLogs.quantity})::float`, cost: sql<number>`coalesce(sum(${feedLogs.costCents}),0)::int` })
      .from(feedLogs)
      .where(and(eq(feedLogs.familyId, fid), gte(feedLogs.date, addDays(today, -29))))
      .groupBy(feedLogs.feed, feedLogs.unit),
    productionKindsUsed(viewer),
  ]);
  const mainKind = kinds[0]?.kind ?? "eggs";
  const series = await productionSeries(viewer, mainKind, today, 14);
  const weekTotal = series.slice(-7).reduce((s, d) => s + d.value, 0);
  const canEdit = viewer.can("farm", "edit");
  const canKitchen = viewer.can("kitchen", "edit");
  const recent = await db.select().from(productionLogs).where(eq(productionLogs.familyId, fid)).orderBy(desc(productionLogs.date), desc(productionLogs.createdAt)).limit(1);

  return (
    <>
      <PageHeader
        eyebrow="Land"
        title="Farm"
        description="Animals, care, production and your farm map."
        actions={canEdit ? <><FeedModal animals={opts} /><ProductionModal animals={opts} canKitchen={canKitchen} /></> : undefined}
      />
      <FarmTabs active="overview" />
      {bySpecies.length === 0 ? (
        <Card>
          <EmptyState icon={<PawPrint />} title="No animals yet" description="Add your flock, herd or hive to track care, feed and production." example="“Layer flock”: 12 chickens · Buff Orpington" action={canEdit ? <AnimalFormModal defaultOpen={sp.new === "1"} /> : undefined} />
        </Card>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {bySpecies.map((s) => (
            <li key={s.species}>
              <Link href={`/farm/animals?species=${s.species}`} className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface p-4 text-center hover:border-primary-300">
                <AnimalAvatar species={s.species} photoUrl={fileUrl(s.photo, true)} size="md" />
                <span className="font-display text-2xl font-semibold">{s.head}</span>
                <span className="text-sm text-muted">{s.species}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title={`${mainKind[0]!.toUpperCase()}${mainKind.slice(1)}: last 14 days`} icon={<Wheat className="size-4" />} href="/farm/production" hrefLabel="All production" />
          {series.some((d) => d.value > 0) ? (
            <>
              <p className="mb-3 text-sm text-muted">
                <strong className="font-display text-2xl text-ink">{weekTotal}</strong> {recent[0]?.unit ?? ""} this week
              </p>
              <BarChart data={series.map((d) => ({ label: d.label, values: [d.value] }))} series={[{ name: mainKind }]} label={`${mainKind} per day`} height={200} />
            </>
          ) : (
            <EmptyState compact icon={<Wheat />} title="No production recorded" description="Record eggs, milk, honey and more. It can go straight into your kitchen inventory." />
          )}
        </Card>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Care due" icon={<AlarmClock className="size-4" />} />
            {healthDue.length === 0 ? (
              <p className="text-sm text-muted">Nothing due in the next 30 days.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {healthDue.map((h) => (
                  <li key={h.id}>
                    <Link href={`/farm/animals/${h.animalId}`} className="flex items-center justify-between gap-2 text-[15px] hover:underline">
                      <span>
                        {h.name}: {h.kind}
                      </span>
                      <Badge tone={h.due! < today ? "wine" : "olive"}>{formatShortDate(h.due!)}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Feed (30 days)" />
            {feed.length === 0 ? (
              <p className="text-sm text-muted">Log feed to track usage and cost.</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-[15px]">
                {feed.map((f) => (
                  <li key={`${f.feed}${f.unit}`} className="flex justify-between">
                    <span>{f.feed}</span>
                    <span className="tabular-nums">
                      {f.total} {f.unit}
                      {f.cost > 0 && <span className="text-muted"> · ${(f.cost / 100).toFixed(0)}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Farm maps" icon={<MapIcon className="size-4" />} action={canEdit ? <NewFarmPlanModal /> : undefined} />
            {plans.length === 0 ? (
              <p className="text-sm text-muted">Draw your barn, coop, pastures, fences and gates.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {plans.map((p) => (
                  <li key={p.id}>
                    <Link href={`/farm/plans/${p.id}`} className="flex justify-between rounded-lg px-2 py-1.5 text-[15px] hover:bg-sunken">
                      {p.name} <span className="text-sm text-muted">{p.layout.objects.length} objects</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
