import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, inventoryItems } from "@/db/schema";
import { AuthorizationError, type Viewer } from "./dal";
import { canChange } from "./food-space";
import { isPantryLocation, storagePlace } from "./storage-places";

/** May the viewer open this storage area? */
export const canSeeStorage = (viewer: Viewer, loc: string) => storagePlace(loc).modules.some((m) => viewer.can(m));

/** May the viewer add things to this storage area (family items)? */
export function canAddStorage(viewer: Viewer, loc: string) {
  if (isPantryLocation(loc)) return viewer.can("kitchen", "add");
  return storagePlace(loc).modules.some((m) => viewer.can(m, "use"));
}

/**
 * May the viewer change or remove this item? Pantry items follow the Family
 * Pantry rules. Other storage: parents and Add & edit change anything; Use
 * changes what they added themselves.
 */
export function canChangeStorage(viewer: Viewer, item: { location: string; ownerMemberId: string | null; createdByMemberId: string | null }) {
  if (item.ownerMemberId || isPantryLocation(item.location)) return canChange(viewer, "kitchen", item);
  if (viewer.isParent) return true;
  const mods = storagePlace(item.location).modules;
  if (mods.some((m) => viewer.can(m, "edit"))) return true;
  return mods.some((m) => viewer.can(m, "use")) && item.createdByMemberId === viewer.member.id;
}

export function assertChangeStorage(viewer: Viewer, item: { location: string; ownerMemberId: string | null; createdByMemberId: string | null }) {
  if (!canChangeStorage(viewer, item)) throw new AuthorizationError("You can view this but not change it.");
}

/** The family's own storage areas (House → Storage → Add a storage area). */
export function storageAreas(familyId: string) {
  return db
    .select({ id: categories.id, name: categories.name, n: sql<number>`(select count(*)::int from inventory_items ii where ii.storage_area_id = "categories"."id" and ii.archived_at is null)` })
    .from(categories)
    .where(and(eq(categories.familyId, familyId), eq(categories.domain, "storage")))
    .orderBy(categories.name);
}

export async function storageArea(familyId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [a] = await db.select().from(categories).where(and(eq(categories.id, id), eq(categories.familyId, familyId), eq(categories.domain, "storage")));
  return a ?? null;
}

/** Family (not private) item counts per location. */
export async function storageCounts(familyId: string) {
  const rows = await db
    .select({ location: inventoryItems.location, n: sql<number>`count(*) filter (where ${inventoryItems.storageAreaId} is null)::int` })
    .from(inventoryItems)
    .where(and(eq(inventoryItems.familyId, familyId), isNull(inventoryItems.ownerMemberId), isNull(inventoryItems.archivedAt)))
    .groupBy(inventoryItems.location);
  return new Map(rows.map((r) => [r.location as string, r.n]));
}
