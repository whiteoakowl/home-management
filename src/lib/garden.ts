import "server-only";
import { and, asc, desc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { gardenLogs, gardenPlans, gardenPlantings, plants } from "@/db/schema";
import type { Viewer } from "./dal";
import { fileUrl } from "./files";
import { ensurePlantDatabase } from "./plant-seed";

export async function plantOptions(viewer: Viewer) {
  await ensurePlantDatabase();
  const rows = await db
    .select()
    .from(plants)
    .where(or(isNull(plants.familyId), eq(plants.familyId, viewer.family.id)))
    .orderBy(asc(plants.name), asc(plants.variety));
  return rows.map((p) => ({ ...p, photoUrl: fileUrl(p.imageFileId, true), isCustom: p.familyId !== null }));
}

export async function plantingsWithPlants(viewer: Viewer, opts: { planId?: string } = {}) {
  const rows = await db
    .select({ p: gardenPlantings, plant: plants, planName: gardenPlans.name })
    .from(gardenPlantings)
    .innerJoin(plants, eq(plants.id, gardenPlantings.plantId))
    .leftJoin(gardenPlans, eq(gardenPlans.id, gardenPlantings.planId))
    .where(and(eq(gardenPlantings.familyId, viewer.family.id), opts.planId ? eq(gardenPlantings.planId, opts.planId) : undefined))
    .orderBy(asc(plants.name));
  return rows.map(({ p, plant, planName }) => ({
    ...p,
    planName,
    plantName: plant.name,
    variety: plant.variety,
    category: plant.category,
    imageUrl: plant.imageUrl,
    photoUrl: fileUrl(plant.imageFileId, true),
    spacingIn: plant.spacingIn,
  }));
}

export async function gardenLog(viewer: Viewer, limit = 50) {
  return db
    .select({ l: gardenLogs, plantName: plants.name, imageUrl: plants.imageUrl, category: plants.category, plantPhoto: plants.imageFileId })
    .from(gardenLogs)
    .leftJoin(plants, eq(plants.id, gardenLogs.plantId))
    .where(eq(gardenLogs.familyId, viewer.family.id))
    .orderBy(desc(gardenLogs.date), desc(gardenLogs.createdAt))
    .limit(limit);
}

export async function gardenPlanList(viewer: Viewer) {
  return db.select().from(gardenPlans).where(eq(gardenPlans.familyId, viewer.family.id)).orderBy(desc(gardenPlans.year), asc(gardenPlans.name));
}

/** Meteorological season for the northern hemisphere (south flips by latitude). */
export function seasonFor(isoDate: string, latitude: number | null) {
  const m = Number(isoDate.slice(5, 7));
  const north = ["Winter", "Winter", "Spring", "Spring", "Spring", "Summer", "Summer", "Summer", "Fall", "Fall", "Fall", "Winter"][m - 1]!;
  if (latitude !== null && latitude < 0) return { Winter: "Summer", Spring: "Fall", Summer: "Winter", Fall: "Spring" }[north]!;
  return north;
}

export const SEASON_TIPS: Record<string, string> = {
  Spring: "Direct-sow cool crops (peas, lettuce, radish) and start warm-season seedlings indoors.",
  Summer: "Water deeply in the morning, mulch, and harvest often to keep plants producing.",
  Fall: "Plant garlic, sow cover crops, and save seeds from your best plants.",
  Winter: "Plan next year's beds, order seeds, and maintain tools.",
};
