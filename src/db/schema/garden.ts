import {
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { families, familyMembers, files } from "./core";

/**
 * Shared geometry for garden and farm blueprints. Stored as JSONB so the
 * editor can evolve without migrations; plantings reference objects by key.
 */
export type BlueprintObject = {
  key: string;
  type: string; // "bed" | "row" | "path" | "tree" | "barn" | "coop" | "fence" | ...
  label?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  color?: string;
  zIndex?: number;
  meta?: Record<string, unknown>;
};
export type BlueprintLayout = {
  width: number;
  height: number;
  unit: "ft" | "m";
  gridSize: number;
  objects: BlueprintObject[];
};

export const sunRequirement = pgEnum("sun_requirement", [
  "full_sun",
  "partial_sun",
  "partial_shade",
  "full_shade",
]);
export const plantingStatus = pgEnum("planting_status", [
  "planned",
  "sown",
  "growing",
  "harvesting",
  "finished",
  "failed",
]);
export const gardenLogKind = pgEnum("garden_log_kind", [
  "sown",
  "germinated",
  "transplanted",
  "watered",
  "fertilized",
  "pest",
  "disease",
  "harvest",
  "seed_saved",
  "note",
]);

/** Plant database. family_id NULL = built-in reference plant. */
export const plants = pgTable(
  "plants",
  {
    id: id(),
    familyId: uuid("family_id").references(() => families.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    variety: text("variety"),
    category: text("category"),
    imageUrl: text("image_url"),
    imageFileId: uuid("image_file_id").references(() => files.id, { onDelete: "set null" }),
    growingZones: text("growing_zones"),
    sun: sunRequirement("sun"),
    soil: text("soil"),
    water: text("water"),
    plantingDepthIn: numeric("planting_depth_in"),
    spacingIn: numeric("spacing_in"),
    germinationDays: text("germination_days"),
    daysToMaturity: text("days_to_maturity"),
    companionPlants: text("companion_plants").array().notNull().default([]),
    avoidPlants: text("avoid_plants").array().notNull().default([]),
    plantingWindow: text("planting_window"),
    harvestWindow: text("harvest_window"),
    soilAmendments: text("soil_amendments"),
    fertilizer: text("fertilizer"),
    seedInfo: text("seed_info"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("plants_family_idx").on(t.familyId)],
);

export const seedInventory = pgTable("seed_inventory", {
  id: id(),
  familyId: uuid("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  plantId: uuid("plant_id").references(() => plants.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  quantity: text("quantity"),
  source: text("source"),
  packedFor: text("packed_for"),
  purchasedOn: date("purchased_on"),
  notes: text("notes"),
  ...timestamps,
});

export const gardenPlans = pgTable(
  "garden_plans",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    year: integer("year"),
    layout: jsonb("layout").$type<BlueprintLayout>().notNull(),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("garden_plans_family_idx").on(t.familyId)],
);

export const gardenPlantings = pgTable(
  "garden_plantings",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    planId: uuid("plan_id").references(() => gardenPlans.id, { onDelete: "cascade" }),
    /** Key of the bed/row object in the plan layout. */
    bedKey: text("bed_key"),
    plantId: uuid("plant_id")
      .notNull()
      .references(() => plants.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(1),
    /** Position inside the bed (relative units) for drawing. */
    x: numeric("x"),
    y: numeric("y"),
    status: plantingStatus("status").notNull().default("planned"),
    plannedOn: date("planned_on"),
    plantedOn: date("planted_on"),
    expectedHarvestOn: date("expected_harvest_on"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("plantings_plan_idx").on(t.planId)],
);

export const gardenLogs = pgTable(
  "garden_logs",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    plantingId: uuid("planting_id").references(() => gardenPlantings.id, {
      onDelete: "cascade",
    }),
    plantId: uuid("plant_id").references(() => plants.id, { onDelete: "set null" }),
    kind: gardenLogKind("kind").notNull(),
    date: date("date").notNull(),
    quantity: numeric("quantity"),
    unit: text("unit"),
    notes: text("notes"),
    photoFileId: uuid("photo_file_id").references(() => files.id, { onDelete: "set null" }),
    memberId: uuid("member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("garden_logs_family_date_idx").on(t.familyId, t.date)],
);
