import "server-only";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { animals, productionLogs } from "@/db/schema";
import { addDays } from "./dates";
import type { Viewer } from "./dal";

export async function animalOptions(viewer: Viewer) {
  return db
    .select({ id: animals.id, name: animals.name, species: animals.species })
    .from(animals)
    .where(and(eq(animals.familyId, viewer.family.id), eq(animals.status, "active")))
    .orderBy(asc(animals.species), asc(animals.name));
}

/** Daily totals for one product over the last `days` days (zero-filled). */
export async function productionSeries(viewer: Viewer, kind: string, today: string, days = 30) {
  const from = addDays(today, -(days - 1));
  const rows = await db
    .select({ date: productionLogs.date, total: sql<number>`sum(${productionLogs.quantity})::float` })
    .from(productionLogs)
    .where(and(eq(productionLogs.familyId, viewer.family.id), eq(productionLogs.kind, kind as "eggs"), gte(productionLogs.date, from)))
    .groupBy(productionLogs.date);
  const map = new Map(rows.map((r) => [r.date, r.total]));
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(from, i);
    return { date: d, label: new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }), value: map.get(d) ?? 0 };
  });
}

export async function productionKindsUsed(viewer: Viewer) {
  const rows = await db
    .select({ kind: productionLogs.kind, unit: productionLogs.unit, total: sql<number>`sum(${productionLogs.quantity})::float`, n: sql<number>`count(*)::int` })
    .from(productionLogs)
    .where(eq(productionLogs.familyId, viewer.family.id))
    .groupBy(productionLogs.kind, productionLogs.unit)
    .orderBy(desc(sql`count(*)`));
  return rows;
}
