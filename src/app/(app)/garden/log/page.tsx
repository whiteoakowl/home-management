import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Leaf, Pencil } from "lucide-react";
import { deleteGardenLog } from "@/app/actions/garden";
import { DeleteButton } from "@/components/forms/inline";
import { LogGardenModal, PlantingModal } from "@/components/garden/garden-forms";
import { PlantAvatar } from "@/components/garden/plant-avatar";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { formatShortDate } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { gardenLog, plantingsWithPlants, plantOptions } from "@/lib/garden";
import { GardenTabs } from "../garden-tabs";

export const metadata: Metadata = { title: "Garden log" };

const STATUS_TONE = { planned: "neutral", sown: "mist", growing: "primary", harvesting: "olive", finished: "neutral", failed: "wine" } as const;

export default async function GardenLogPage() {
  const viewer = await getViewer();
  if (!viewer.can("garden")) notFound();
  const [plantings, log, plants] = await Promise.all([plantingsWithPlants(viewer), gardenLog(viewer, 200), plantOptions(viewer)]);
  const canEdit = viewer.can("garden", "edit");
  const opts = plantings.filter((p) => p.status !== "finished").map((p) => ({ id: p.id, label: `${p.plantName}${p.planName ? ` · ${p.planName}` : ""}` }));
  const harvestTotals = Map.groupBy(
    log.filter((x) => x.l.kind === "harvest"),
    (x) => `${x.plantName}|${x.l.unit ?? ""}`,
  );

  return (
    <>
      <PageHeader eyebrow="Garden" title="Plantings & log" description="Everything planted, germinated, watered, fed, fought and harvested." actions={canEdit ? <LogGardenModal plantings={opts} plants={plants} canKitchen={viewer.can("kitchen", "edit")} /> : undefined} />
      <GardenTabs active="log" />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <section>
          <h2 className="mb-3 text-xl font-semibold">Plantings</h2>
          {plantings.length === 0 ? (
            <Card>
              <EmptyState compact icon={<CalendarClock />} title="No plantings yet" description="Open a garden plan and drag plants onto beds to create plantings." action={<Link href="/garden" className="text-sm font-medium text-primary-600 hover:underline">Go to plans →</Link>} />
            </Card>
          ) : (
            <ul className="flex flex-col gap-2">
              {plantings.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
                  <PlantAvatar imageUrl={p.imageUrl} photoUrl={p.photoUrl} name={p.plantName} category={p.category} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {p.plantName} <span className="text-muted">×{p.quantity}</span>
                    </p>
                    <p className="truncate text-sm text-muted">
                      {[p.planName, p.plantedOn && `Planted ${formatShortDate(p.plantedOn)}`, p.expectedHarvestOn && `Harvest ~${formatShortDate(p.expectedHarvestOn)}`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
                  {canEdit && <PlantingModal planting={p} triggerAriaLabel="Update planting" triggerContent={<Pencil className="size-4" />} />}
                </li>
              ))}
            </ul>
          )}
          {harvestTotals.size > 0 && (
            <Card className="mt-6">
              <h3 className="mb-3 font-sans font-semibold">Harvest totals</h3>
              <ul className="flex flex-col gap-1.5 text-[15px]">
                {[...harvestTotals.entries()].map(([k, rows]) => (
                  <li key={k} className="flex justify-between">
                    <span>{rows[0]!.plantName}</span>
                    <span className="font-semibold tabular-nums">
                      {rows.reduce((s, r) => s + Number(r.l.quantity ?? 0), 0)} {rows[0]!.l.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
        <section>
          <h2 className="mb-3 text-xl font-semibold">Garden log</h2>
          {log.length === 0 ? (
            <Card>
              <EmptyState compact icon={<Leaf />} title="Nothing logged yet" description="Use “Log activity” to record germination, watering, pests, disease and harvests." />
            </Card>
          ) : (
            <ol className="relative flex flex-col gap-3 border-l-2 border-line pl-5">
              {log.map(({ l, plantName, imageUrl, category }) => (
                <li key={l.id} className="relative">
                  <span className="absolute top-3 -left-[27px] size-3 rounded-full border-2 border-surface bg-primary-500" aria-hidden />
                  <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3">
                    <PlantAvatar imageUrl={imageUrl} name={plantName ?? "?"} category={category} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        <span className="capitalize">{l.kind.replace("_", " ")}</span>
                        {plantName && ` · ${plantName}`}
                        {l.quantity && <span className="text-primary-700"> · {Number(l.quantity)} {l.unit}</span>}
                      </p>
                      <p className="text-sm text-muted">{formatShortDate(l.date)}</p>
                      {l.notes && <p className="mt-1 text-[15px] text-ink-soft">{l.notes}</p>}
                      {l.photoFileId && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={fileUrl(l.photoFileId, true)!} alt="" className="mt-2 size-24 rounded-xl object-cover" />
                      )}
                    </div>
                    {canEdit && <DeleteButton action={deleteGardenLog} fields={{ id: l.id }} what="this entry" />}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
