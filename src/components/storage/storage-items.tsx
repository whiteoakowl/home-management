import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { Boxes } from "lucide-react";
import { db } from "@/db";
import { categories, inventoryItems } from "@/db/schema";
import { InventoryFormModal } from "@/components/kitchen/inventory-form";
import { InventoryRow, type InventoryRowData } from "@/components/kitchen/inventory-row";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/display";
import type { Viewer } from "@/lib/dal";
import { daysBetween, todayIn } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { categoryOptions } from "@/lib/queries";
import { canAddStorage, canChangeStorage } from "@/lib/storage-areas";
import { storagePlace, type StorageLoc } from "@/lib/storage-places";

/** The family's items in one storage area, as loaded for a storage page. */
export async function loadStorage(viewer: Viewer, location: StorageLoc, areaId?: string | null) {
  const today = todayIn(viewer.family.timezone);
  const [cats, rows] = await Promise.all([
    categoryOptions(viewer, "inventory"),
    db
      .select({ i: inventoryItems, categoryName: categories.name })
      .from(inventoryItems)
      .leftJoin(categories, eq(categories.id, inventoryItems.categoryId))
      .where(
        and(
          eq(inventoryItems.familyId, viewer.family.id),
          isNull(inventoryItems.ownerMemberId),
          isNull(inventoryItems.archivedAt),
          eq(inventoryItems.location, location),
          areaId ? eq(inventoryItems.storageAreaId, areaId) : location === "other" ? isNull(inventoryItems.storageAreaId) : undefined,
        ),
      )
      .orderBy(asc(inventoryItems.spot), sql`${inventoryItems.expiresOn} asc nulls last`, asc(inventoryItems.name)),
  ]);
  const items: (InventoryRowData & { ownerMemberId: string | null; createdByMemberId: string | null })[] = rows.map(({ i, categoryName }) => ({
    ...i,
    daysLeft: i.expiresOn ? daysBetween(today, i.expiresOn) : null,
    categoryName,
    thumbUrl: fileUrl(i.imageFileId, true),
    imageUrl: fileUrl(i.imageFileId),
  }));
  return { cats, items };
}

/** "Add" button for a storage area (null when the viewer can't add there). */
export function StorageAddButton({ viewer, location, areaId, cats, label }: { viewer: Viewer; location: StorageLoc; areaId?: string | null; cats: { id: string; name: string }[]; label?: string }) {
  if (!canAddStorage(viewer, location)) return null;
  const place = storagePlace(location);
  return (
    <InventoryFormModal
      categories={cats}
      locations={[{ value: location, label: place.label }]}
      defaults={{ location, storageAreaId: areaId ?? null }}
      title={label ?? `Add to ${place.label}`}
      triggerLabel="Add item"
    />
  );
}

/** The list of items, or a friendly empty state. */
export function StorageItems({
  viewer,
  location,
  areaId,
  cats,
  items,
  empty,
}: {
  viewer: Viewer;
  location: StorageLoc;
  areaId?: string | null;
  cats: { id: string; name: string }[];
  items: Awaited<ReturnType<typeof loadStorage>>["items"];
  empty: { title: string; description: string; example?: string };
}) {
  const locations = [{ value: location, label: storagePlace(location).label }];
  const low = items.filter((i) => i.lowStockThreshold != null && Number(i.quantity) <= Number(i.lowStockThreshold)).length;
  if (!items.length) {
    return (
      <Card>
        <EmptyState icon={<Boxes />} title={empty.title} description={empty.description} example={empty.example} action={<StorageAddButton viewer={viewer} location={location} areaId={areaId} cats={cats} />} />
      </Card>
    );
  }
  return (
    <>
      {low > 0 && (
        <p className="mb-3 text-sm text-olive-700">
          {low} item{low === 1 ? " is" : "s are"} running low.
        </p>
      )}
      <ul className="grid gap-2 lg:grid-cols-2">
        {items.map((i) => (
          <InventoryRow key={i.id} item={i} categories={cats} canEdit={canChangeStorage(viewer, i)} showLocation={false} locations={locations} />
        ))}
      </ul>
    </>
  );
}
