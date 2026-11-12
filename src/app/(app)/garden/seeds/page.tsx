import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { Pencil, Sprout } from "lucide-react";
import { db } from "@/db";
import { plants, seedInventory } from "@/db/schema";
import { deleteSeed } from "@/app/actions/garden";
import { DeleteButton } from "@/components/forms/inline";
import { SeedFormModal } from "@/components/garden/garden-forms";
import { PlantAvatar } from "@/components/garden/plant-avatar";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { plantOptions } from "@/lib/garden";
import { GardenTabs } from "../garden-tabs";

export const metadata: Metadata = { title: "Seeds" };

export default async function SeedsPage() {
  const viewer = await getViewer();
  if (!viewer.can("garden")) notFound();
  const [rows, opts] = await Promise.all([
    db.select({ s: seedInventory, imageUrl: plants.imageUrl, category: plants.category }).from(seedInventory).leftJoin(plants, eq(plants.id, seedInventory.plantId)).where(eq(seedInventory.familyId, viewer.family.id)).orderBy(asc(seedInventory.name)),
    plantOptions(viewer),
  ]);
  const canEdit = viewer.can("garden", "edit");
  const add = <SeedFormModal plants={opts} />;
  return (
    <>
      <PageHeader eyebrow="Garden" title="Seed inventory" description="What's in the seed box, where it came from, and how old it is." actions={canEdit ? add : undefined} />
      <GardenTabs active="seeds" />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Sprout />} title="No seeds yet" description="Track purchased and saved seeds so you know what you have before you buy." example="Sungold tomato · 1 packet · Baker Creek · 2026" action={canEdit ? add : undefined} />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ s, imageUrl, category }) => (
            <li key={s.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
              <PlantAvatar imageUrl={imageUrl} name={s.name} category={category} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{s.name}</p>
                <p className="truncate text-sm text-muted">{[s.quantity, s.source, s.packedFor && `Packed ${s.packedFor}`].filter(Boolean).join(" · ")}</p>
              </div>
              {canEdit && (
                <>
                  <SeedFormModal plants={opts} seed={s} triggerContent={<Pencil className="mx-auto size-4" />} />
                  <DeleteButton action={deleteSeed} fields={{ id: s.id }} what={s.name} />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
