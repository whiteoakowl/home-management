import "server-only";
import { and, asc, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { familyMembers, poolAdditions, poolEquipment, pools, poolTests } from "@/db/schema";
import type { Viewer } from "./dal";
import type { PoolProfile, Reading, ReadingKey } from "./pool";

export const READING_KEYS: ReadingKey[] = ["fc", "cc", "ph", "ta", "ch", "cya", "salt", "tempF", "phosphates"];

export async function familyPools(viewer: Viewer) {
  return db.select().from(pools).where(eq(pools.familyId, viewer.family.id)).orderBy(asc(pools.createdAt));
}

export const profileOf = (p: typeof pools.$inferSelect): PoolProfile => ({ kind: p.kind, gallons: p.gallons, sanitizer: p.sanitizer, surface: p.surface, chlorineProduct: p.chlorineProduct, saltTarget: p.saltTarget });

export async function poolTestsFor(viewer: Viewer, poolId: string, limit = 60) {
  return db
    .select({ t: poolTests, by: familyMembers.displayName })
    .from(poolTests)
    .leftJoin(familyMembers, eq(familyMembers.id, poolTests.testedByMemberId))
    .where(and(eq(poolTests.familyId, viewer.family.id), eq(poolTests.poolId, poolId)))
    .orderBy(desc(poolTests.testedAt))
    .limit(limit);
}

export async function poolAdditionsFor(viewer: Viewer, poolId: string, limit = 30) {
  return db
    .select({ a: poolAdditions, by: familyMembers.displayName })
    .from(poolAdditions)
    .leftJoin(familyMembers, eq(familyMembers.id, poolAdditions.addedByMemberId))
    .where(and(eq(poolAdditions.familyId, viewer.family.id), eq(poolAdditions.poolId, poolId)))
    .orderBy(desc(poolAdditions.date), desc(poolAdditions.createdAt))
    .limit(limit);
}

export async function poolEquipmentFor(viewer: Viewer, poolId: string) {
  return db.select().from(poolEquipment).where(and(eq(poolEquipment.familyId, viewer.family.id), eq(poolEquipment.poolId, poolId))).orderBy(asc(poolEquipment.name));
}

/**
 * The water "now": for each reading, the latest value from the last 30 days
 * (a quick FC/pH test today plus last week's full test), with when it was taken.
 */
export function currentWater(tests: { t: typeof poolTests.$inferSelect }[], now = new Date()) {
  const reading: Reading = {};
  const when: Partial<Record<ReadingKey, Date>> = {};
  const cutoff = now.getTime() - 30 * 86400_000;
  for (const { t } of tests) {
    if (t.testedAt.getTime() < cutoff) break;
    for (const k of READING_KEYS) {
      const v = t[k];
      if (reading[k] == null && v != null) {
        reading[k] = v;
        when[k] = t.testedAt;
      }
    }
  }
  return { reading, when, lastTested: tests[0]?.t.testedAt ?? null };
}

export async function testsSince(viewer: Viewer, poolId: string, since: Date) {
  return db
    .select()
    .from(poolTests)
    .where(and(eq(poolTests.familyId, viewer.family.id), eq(poolTests.poolId, poolId), gte(poolTests.testedAt, since)))
    .orderBy(asc(poolTests.testedAt));
}
