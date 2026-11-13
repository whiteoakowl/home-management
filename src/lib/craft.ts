import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { CRAFT_REFERENCE } from "@/db/craft-data";
import { craftCollection, craftItems, plants, sabbatSettings } from "@/db/schema";
import { moonForDate, phasesBetween, type MoonInfo } from "./astro";
import type { CraftKind } from "./craft-config";
import { visibleTo, type Viewer } from "./dal";
import { tzOffset } from "./dates";
import { upcomingSabbats, wheelForYear } from "./sabbats";

/** Insert the built-in crystals, herbs and tools once (idempotent), linking herbs to garden plants by name. */
export async function ensureCraftReference() {
  const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(craftItems).where(isNull(craftItems.familyId));
  if (n > 0) return;
  const refPlants = await db.select({ id: plants.id, name: plants.name }).from(plants).where(isNull(plants.familyId));
  await db.insert(craftItems).values(
    CRAFT_REFERENCE.map((r) => ({
      familyId: null,
      kind: r.kind,
      name: r.name,
      emoji: r.emoji,
      category: r.category,
      description: r.description,
      fields: r.fields,
      plantId: r.plantName ? (refPlants.find((p) => p.name === r.plantName)?.id ?? null) : null,
      source: "Vanderbilt Family reference library",
    })),
  );
}

/** Built-in rows + this family's rows the viewer may see. */
export function craftVisible(viewer: Viewer) {
  return or(
    isNull(craftItems.familyId),
    and(eq(craftItems.familyId, viewer.family.id), visibleTo(viewer, { id: craftItems.id, visibility: craftItems.visibility, author: craftItems.createdByMemberId }, "craft_item")),
  )!;
}

export async function listCraft(viewer: Viewer, kind: CraftKind, opts: { q?: string; category?: string; favorites?: boolean; moon?: string; sabbat?: string } = {}) {
  await ensureCraftReference();
  const q = opts.q?.trim();
  return db
    .select()
    .from(craftItems)
    .where(
      and(
        eq(craftItems.kind, kind),
        craftVisible(viewer),
        q ? or(ilike(craftItems.name, `%${q}%`), ilike(craftItems.description, `%${q}%`), sql`${craftItems.fields}::text ilike ${`%${q}%`}`) : undefined,
        opts.category ? eq(craftItems.category, opts.category) : undefined,
        opts.favorites ? eq(craftItems.isFavorite, true) : undefined,
        opts.moon ? eq(craftItems.moonPhase, opts.moon) : undefined,
        opts.sabbat ? eq(craftItems.sabbat, opts.sabbat) : undefined,
      ),
    )
    .orderBy(desc(craftItems.isFavorite), asc(craftItems.name));
}

export async function getCraftItem(viewer: Viewer, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  await ensureCraftReference();
  const [r] = await db.select().from(craftItems).where(and(eq(craftItems.id, id), craftVisible(viewer)));
  return r ?? null;
}

export async function collectionFor(viewer: Viewer, itemIds?: string[]) {
  return db
    .select({ c: craftCollection, item: craftItems })
    .from(craftCollection)
    .innerJoin(craftItems, eq(craftItems.id, craftCollection.itemId))
    .where(and(eq(craftCollection.familyId, viewer.family.id), itemIds ? (itemIds.length ? inArray(craftCollection.itemId, itemIds) : sql`false`) : undefined))
    .orderBy(asc(craftItems.name));
}

// ─── Moon & wheel for the family's location ─────────────────────────────────

export const offsetMinutes = (tz: string, isoDate: string) => tzOffset(new Date(`${isoDate}T12:00:00Z`), tz) / 60000;

export function moonFor(viewer: Viewer, isoDate: string): MoonInfo {
  return moonForDate(isoDate, offsetMinutes(viewer.family.timezone, isoDate));
}

export function upcomingMoonPhases(viewer: Viewer, count = 4) {
  const now = new Date();
  return phasesBetween(now, new Date(now.getTime() + 45 * 86400000)).slice(0, count);
}

export const isSouthern = (viewer: Viewer) => (viewer.family.latitude ?? 1) < 0;

export async function sabbatOverrides(viewer: Viewer) {
  const rows = await db.select().from(sabbatSettings).where(eq(sabbatSettings.familyId, viewer.family.id));
  return { rows, overrides: Object.fromEntries(rows.map((r) => [r.key, r.monthDay])) as Record<string, string | null> };
}

export async function familyWheel(viewer: Viewer, year: number) {
  const { overrides, rows } = await sabbatOverrides(viewer);
  return { wheel: wheelForYear(year, { tz: viewer.family.timezone, southern: isSouthern(viewer), overrides }), settings: rows };
}

export async function familyUpcomingSabbats(viewer: Viewer, today: string, count = 3) {
  const { overrides } = await sabbatOverrides(viewer);
  return upcomingSabbats(today, { tz: viewer.family.timezone, southern: isSouthern(viewer), overrides }, count);
}
