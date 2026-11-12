import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { Wheat } from "lucide-react";
import { db } from "@/db";
import { animals, productionLogs } from "@/db/schema";
import { deleteProduction } from "@/app/actions/farm";
import { BarChart } from "@/components/charts";
import { DeleteButton } from "@/components/forms/inline";
import { ProductionModal } from "@/components/farm/farm-forms";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { SegmentLinks } from "@/components/ui/tabs";
import { getViewer } from "@/lib/dal";
import { formatShortDate, todayIn } from "@/lib/dates";
import { animalOptions, productionKindsUsed, productionSeries } from "@/lib/farm";
import { FarmTabs } from "../farm-tabs";

export const metadata: Metadata = { title: "Farm production" };

export default async function ProductionPage({ searchParams }: PageProps<"/farm/production">) {
  const viewer = await getViewer();
  if (!viewer.can("farm")) notFound();
  const sp = await searchParams;
  const today = todayIn(viewer.family.timezone);
  const kinds = await productionKindsUsed(viewer);
  const kind = typeof sp.kind === "string" ? sp.kind : (kinds[0]?.kind ?? "eggs");
  const days = sp.range === "90" ? 90 : 30;
  const [series, logs, opts] = await Promise.all([
    productionSeries(viewer, kind, today, days),
    db.select({ p: productionLogs, animal: animals.name }).from(productionLogs).leftJoin(animals, eq(animals.id, productionLogs.animalId)).where(eq(productionLogs.familyId, viewer.family.id)).orderBy(desc(productionLogs.date), desc(productionLogs.createdAt)).limit(100),
    animalOptions(viewer),
  ]);
  const total = series.reduce((s, d) => s + d.value, 0);
  const unit = kinds.find((k) => k.kind === kind)?.unit ?? "";
  const avg = total / days;
  // Weekly buckets read better than 90 thin bars.
  const chartData =
    days === 90
      ? Array.from({ length: Math.ceil(series.length / 7) }, (_, i) => {
          const wk = series.slice(i * 7, i * 7 + 7);
          return { label: wk[0]!.label, values: [wk.reduce((s, d) => s + d.value, 0)] };
        })
      : series.map((d) => ({ label: d.label, values: [d.value] }));
  const canEdit = viewer.can("farm", "edit");

  return (
    <>
      <PageHeader eyebrow="Farm" title="Production" description="Eggs, milk, honey, meat and more, with history and trends." actions={canEdit ? <ProductionModal animals={opts} canKitchen={viewer.can("kitchen", "edit")} defaultKind={kind} /> : undefined} />
      <FarmTabs active="production" />
      {kinds.length === 0 ? (
        <Card>
          <EmptyState icon={<Wheat />} title="No production recorded" description="Record daily egg counts, milk, honey harvests and more." example="Date | Number of eggs | Notes" action={canEdit ? <ProductionModal animals={opts} canKitchen={viewer.can("kitchen", "edit")} /> : undefined} />
        </Card>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-2">
            <SegmentLinks active={kind} items={kinds.map((k) => ({ key: k.kind, href: `/farm/production?kind=${k.kind}&range=${days}`, label: k.kind[0]!.toUpperCase() + k.kind.slice(1) }))} />
            <SegmentLinks active={String(days)} items={[{ key: "30", href: `/farm/production?kind=${kind}&range=30`, label: "30 days" }, { key: "90", href: `/farm/production?kind=${kind}&range=90`, label: "90 days" }]} />
          </div>
          <Card className="mb-6">
            <CardHeader title={`${kind[0]!.toUpperCase()}${kind.slice(1)} ${days === 90 ? "per week" : "per day"}`} />
            <div className="mb-4 flex flex-wrap gap-6">
              <p>
                <span className="font-display text-3xl font-semibold">{Math.round(total * 10) / 10}</span> <span className="text-muted">{unit} in {days} days</span>
              </p>
              <p>
                <span className="font-display text-3xl font-semibold">{Math.round(avg * 10) / 10}</span> <span className="text-muted">{unit} / day average</span>
              </p>
            </div>
            <BarChart data={chartData} series={[{ name: `${kind} (${unit})` }]} label={`${kind} production`} />
          </Card>
        </>
      )}
      {logs.length > 0 && (
        <Card>
          <CardHeader title="Records" />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[15px]">
              <thead>
                <tr className="border-b border-line text-sm text-muted">
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Product</th>
                  <th className="py-2 pr-4 font-medium">Amount</th>
                  <th className="py-2 pr-4 font-medium">From</th>
                  <th className="py-2 pr-4 font-medium">Notes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {logs.map(({ p, animal }) => (
                  <tr key={p.id} className="border-b border-line/60">
                    <td className="py-2 pr-4">{formatShortDate(p.date)}</td>
                    <td className="py-2 pr-4 capitalize">{p.kind}</td>
                    <td className="py-2 pr-4 tabular-nums">
                      {Number(p.quantity)} {p.unit}
                    </td>
                    <td className="py-2 pr-4">{animal ?? p.groupName ?? "—"}</td>
                    <td className="py-2 pr-4 text-sm text-muted">
                      {p.notes}
                      {p.inventoryItemId && <Badge tone="primary" className="ml-1">In kitchen</Badge>}
                    </td>
                    <td className="py-1 text-right">{canEdit && <DeleteButton action={deleteProduction} fields={{ id: p.id }} what="this record" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
