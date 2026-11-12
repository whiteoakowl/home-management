import "server-only";
import { isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { referencePlantRows } from "@/db/plant-data";
import { plants } from "@/db/schema";

export const PLANT_CATEGORIES = ["Vegetable", "Herb", "Fruit", "Flower"];

/** Insert the reference plants once (idempotent). */
export async function ensurePlantDatabase() {
  const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(plants).where(isNull(plants.familyId));
  if (n > 0) return;
  await db.insert(plants).values(referencePlantRows());
}
