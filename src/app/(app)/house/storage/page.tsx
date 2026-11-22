import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, Boxes, ChevronRight, Hammer, PawPrint, Refrigerator, Sprout, Tractor } from "lucide-react";
import type { ReactNode } from "react";
import { saveStorageArea } from "@/app/actions/kitchen";
import { FormModal } from "@/components/forms/action-form";
import { TextField } from "@/components/forms/fields";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { canSeeStorage, storageAreas, storageCounts } from "@/lib/storage-areas";
import { PANTRY_LOCATIONS, STORAGE_PLACES, type StorageLoc } from "@/lib/storage-places";
import { HouseTabs } from "../house-tabs";

export const metadata: Metadata = { title: "Storage" };

const ICONS: Partial<Record<StorageLoc, ReactNode>> = {
  farm: <Tractor />,
  garden: <Sprout />,
  pets: <PawPrint />,
  home: <Hammer />,
  craft: <Archive />,
  other: <Boxes />,
};

function Tile({ href, icon, title, area, count }: { href: string; icon: ReactNode; title: string; area?: string; count: number }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 hover:border-primary-300 hover:bg-sunken/50">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 [&>svg]:size-5">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{title}</span>
        <span className="text-sm text-muted">
          {count} item{count === 1 ? "" : "s"}
          {area ? ` · ${area}` : ""}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted" />
    </Link>
  );
}

/** Every storage area in the household in one place, plus the family's own areas. */
export default async function StoragePage() {
  const viewer = await getViewer();
  if (!viewer.can("house")) notFound();
  const [counts, areas] = await Promise.all([storageCounts(viewer.family.id), storageAreas(viewer.family.id)]);
  const n = (l: string) => counts.get(l) ?? 0;
  const canAdd = viewer.can("house", "use");
  const add = canAdd ? (
    <FormModal title="Add a storage area" triggerLabel="Add storage area" action={saveStorageArea} submitLabel="Add">
      <TextField name="name" label="Name" required placeholder="Garage shelves, basement closet, linen closet…" />
    </FormModal>
  ) : null;
  const elsewhere = (["farm", "garden", "pets", "home"] as const).filter((l) => canSeeStorage(viewer, l));

  return (
    <>
      <PageHeader eyebrow="House" title="Storage" description="Every place the family keeps things, from the pantry to the barn. Add your own storage areas too." actions={add} />
      <HouseTabs active="storage" viewer={viewer} />
      <div className="flex flex-col gap-6">
        {canSeeStorage(viewer, "pantry") && (
          <section>
            <h2 className="mb-2 text-lg font-semibold">Kitchen</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {PANTRY_LOCATIONS.map((l) => (
                <Tile key={l} href={STORAGE_PLACES[l].href} icon={<Refrigerator />} title={STORAGE_PLACES[l].label} area="Family Pantry" count={n(l)} />
              ))}
            </div>
          </section>
        )}
        {elsewhere.length > 0 && (
          <section>
            <h2 className="mb-2 text-lg font-semibold">Around the home</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {elsewhere.map((l) => (
                <Tile key={l} href={STORAGE_PLACES[l].href} icon={ICONS[l]} title={STORAGE_PLACES[l].label} area={STORAGE_PLACES[l].area} count={n(l)} />
              ))}
            </div>
          </section>
        )}
        <section>
          <h2 className="mb-2 text-lg font-semibold">Storage areas</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Tile href={STORAGE_PLACES.craft.href} icon={ICONS.craft} title={STORAGE_PLACES.craft.label} count={n("craft")} />
            {areas.map((a) => (
              <Tile key={a.id} href={`/house/storage/${a.id}`} icon={<Boxes />} title={a.name} count={a.n} />
            ))}
            {n("other") > 0 && <Tile href={STORAGE_PLACES.other.href} icon={ICONS.other} title={STORAGE_PLACES.other.label} count={n("other")} />}
          </div>
          {!areas.length && (
            <Card className="mt-3">
              <p className="text-sm text-muted">Add your own storage areas, like the garage shelves, a basement closet or the linen closet, to keep track of what&apos;s in them.</p>
            </Card>
          )}
        </section>
      </div>
    </>
  );
}
