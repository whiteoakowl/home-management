import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, rooms } from "@/db/schema";
import { listFamilyMembers, type Viewer } from "./dal";

export type CategoryDomain = (typeof categories.$inferSelect)["domain"];

export async function memberOptions(viewer: Viewer) {
  return (await listFamilyMembers(viewer.family.id)).map((m) => ({ id: m.id, displayName: m.displayName, color: m.color, role: m.role }));
}

export async function categoryOptions(viewer: Viewer, domain: CategoryDomain) {
  return db
    .select({ id: categories.id, name: categories.name, color: categories.color })
    .from(categories)
    .where(and(eq(categories.familyId, viewer.family.id), eq(categories.domain, domain)))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function roomOptions(viewer: Viewer) {
  return db
    .select({ id: rooms.id, name: rooms.name })
    .from(rooms)
    .where(eq(rooms.familyId, viewer.family.id))
    .orderBy(asc(rooms.sortOrder), asc(rooms.name));
}

/** Validate a category id from a form against the family + domain. */
export async function ownedCategoryId(viewer: Viewer, domain: CategoryDomain, id: string | null) {
  if (!id) return null;
  const [c] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.familyId, viewer.family.id), eq(categories.domain, domain)));
  return c?.id ?? null;
}

export async function ownedRoomId(viewer: Viewer, id: string | null) {
  if (!id) return null;
  const [r] = await db.select({ id: rooms.id }).from(rooms).where(and(eq(rooms.id, id), eq(rooms.familyId, viewer.family.id)));
  return r?.id ?? null;
}
