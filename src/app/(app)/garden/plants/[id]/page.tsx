import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { ArrowLeft, Copy, Pencil, Trash2 } from "lucide-react";
import { db } from "@/db";
import { gardenLogs, gardenPlantings, gardenPlans, plants } from "@/db/schema";
import { deletePlant } from "@/app/actions/garden";
import { ActionButton } from "@/components/forms/inline";
import { PlantFormModal } from "@/components/garden/garden-forms";
import { PlantAvatar } from "@/components/garden/plant-avatar";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { formatShortDate } from "@/lib/dates";
import { fileUrl } from "@/lib/files";

export const metadata: Metadata = { title: "Plant" };

const SUN_LABEL: Record<string, string> = { full_sun: "Full sun (6+ hrs)", partial_sun: "Partial sun (4–6 hrs)", partial_shade: "Partial shade (2–4 hrs)", full_shade: "Full shade" };

export default async function PlantPage({ params }: PageProps<"/garden/plants/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const viewer = await getViewer();
  if (!viewer.can("garden")) notFound();
  const [p] = await db.select().from(plants).where(and(eq(plants.id, id), or(isNull(plants.familyId), eq(plants.familyId, viewer.family.id))));
  if (!p) notFound();
  const [history, logs] = await Promise.all([
    db
      .select({ pl: gardenPlantings, plan: gardenPlans.name })
      .from(gardenPlantings)
      .leftJoin(gardenPlans, eq(gardenPlans.id, gardenPlantings.planId))
      .where(and(eq(gardenPlantings.plantId, id), eq(gardenPlantings.familyId, viewer.family.id)))
      .orderBy(desc(gardenPlantings.createdAt)),
    db.select().from(gardenLogs).where(and(eq(gardenLogs.plantId, id), eq(gardenLogs.familyId, viewer.family.id))).orderBy(desc(gardenLogs.date)).limit(20),
  ]);
  const harvested = logs.filter((l) => l.kind === "harvest");
  const canEdit = viewer.can("garden", "edit");
  const photo = fileUrl(p.imageFileId);
  const { createdAt: _c, updatedAt: _u, ...rest } = p;
  const defaults = { ...rest, photoUrl: photo };
  const facts: [string, string | null][] = [
    ["Sun", p.sun ? SUN_LABEL[p.sun]! : null],
    ["Water", p.water],
    ["Soil", p.soil],
    ["Planting depth", p.plantingDepthIn !== null ? `${Number(p.plantingDepthIn)} in` : null],
    ["Spacing", p.spacingIn !== null ? `${Number(p.spacingIn)} in` : null],
    ["Germination", p.germinationDays],
    ["Days to maturity", p.daysToMaturity],
    ["Growing zones", p.growingZones],
    ["When to plant", p.plantingWindow],
    ["When to harvest", p.harvestWindow],
    ["Soil amendments", p.soilAmendments],
    ["Fertilizer", p.fertilizer],
    ["Seeds", p.seedInfo],
  ];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <Link href="/garden/plants" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Plant database
      </Link>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <PlantAvatar imageUrl={p.imageUrl} photoUrl={photo} name={p.name} category={p.category} size="xl" />
        <div className="flex-1">
          <PageHeader
            eyebrow={p.category ?? "Plant"}
            title={p.name}
            description={p.variety ?? undefined}
            actions={
              canEdit ? (
                p.familyId ? (
                  <>
                    <PlantFormModal defaults={defaults} triggerContent={<><Pencil className="size-4" /> Edit</>} />
                    <ActionButton action={deletePlant} fields={{ id }} confirm={`Delete ${p.name}?`} label="Delete plant" className="size-11 rounded-lg text-muted hover:bg-wine-50 hover:text-wine-500">
                      <Trash2 className="size-4" />
                    </ActionButton>
                  </>
                ) : (
                  <PlantFormModal title="Customize this plant" defaults={{ ...defaults, id: undefined }} triggerContent={<><Copy className="size-4" /> Customize a copy</>} />
                )
              ) : undefined
            }
          />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Growing guide" />
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {facts
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs font-medium tracking-wide text-muted uppercase">{k}</dt>
                  <dd className="text-[15px]">{v}</dd>
                </div>
              ))}
          </dl>
          {p.notes && <p className="mt-4 rounded-xl bg-olive-50 p-3 text-[15px] text-olive-700">{p.notes}</p>}
        </Card>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Companions" />
            <p className="mb-1.5 text-sm text-muted">Grows well with</p>
            <div className="flex flex-wrap gap-1.5">{p.companionPlants.length ? p.companionPlants.map((c) => <Badge key={c} tone="primary">{c}</Badge>) : <span className="text-sm text-muted">—</span>}</div>
            <p className="mt-4 mb-1.5 text-sm text-muted">Keep away from</p>
            <div className="flex flex-wrap gap-1.5">{p.avoidPlants.length ? p.avoidPlants.map((c) => <Badge key={c} tone="wine">{c}</Badge>) : <span className="text-sm text-muted">—</span>}</div>
          </Card>
          <Card>
            <CardHeader title="Your history" />
            {history.length === 0 && logs.length === 0 ? (
              <p className="text-sm text-muted">You haven&apos;t grown this yet.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {history.map(({ pl, plan }) => (
                  <li key={pl.id} className="flex justify-between gap-2">
                    <span>
                      {plan ?? "Garden"} · {pl.quantity} plants
                    </span>
                    <Badge>{pl.status}</Badge>
                  </li>
                ))}
                {harvested.length > 0 && (
                  <li className="mt-1 border-t border-line pt-2 text-muted">
                    Harvested {harvested.length} time{harvested.length === 1 ? "" : "s"}, last {formatShortDate(harvested[0]!.date)}
                  </li>
                )}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
