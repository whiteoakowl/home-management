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
import type { BlueprintLayout } from "./garden";

export const animalSex = pgEnum("animal_sex", ["female", "male", "unknown"]);
export const animalStatus = pgEnum("animal_status", ["active", "sold", "deceased", "processed"]);
export const productionKind = pgEnum("production_kind", [
  "eggs",
  "milk",
  "meat",
  "honey",
  "wool",
  "produce",
  "other",
]);

export const animals = pgTable(
  "animals",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    species: text("species").notNull(),
    breed: text("breed"),
    sex: animalSex("sex").notNull().default("unknown"),
    /** Flock/herd/hive grouping, e.g. "Layer flock". */
    groupName: text("group_name"),
    /** For groups tracked as one record (e.g. 12 hens). */
    headCount: integer("head_count").notNull().default(1),
    birthDate: date("birth_date"),
    acquiredOn: date("acquired_on"),
    imageFileId: uuid("image_file_id").references(() => files.id, { onDelete: "set null" }),
    feed: text("feed"),
    status: animalStatus("status").notNull().default("active"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("animals_family_idx").on(t.familyId)],
);

export const animalHealthRecords = pgTable(
  "animal_health_records",
  {
    id: id(),
    animalId: uuid("animal_id")
      .notNull()
      .references(() => animals.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    kind: text("kind").notNull(), // vaccination, treatment, vet visit, weight…
    description: text("description"),
    nextDueOn: date("next_due_on"),
    costCents: integer("cost_cents"),
    ...timestamps,
  },
  (t) => [index("health_animal_idx").on(t.animalId, t.date)],
);

export const feedLogs = pgTable(
  "feed_logs",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    animalId: uuid("animal_id").references(() => animals.id, { onDelete: "set null" }),
    groupName: text("group_name"),
    date: date("date").notNull(),
    feed: text("feed").notNull(),
    quantity: numeric("quantity").notNull(),
    unit: text("unit").notNull(),
    costCents: integer("cost_cents"),
    ...timestamps,
  },
  (t) => [index("feed_family_date_idx").on(t.familyId, t.date)],
);

export const productionLogs = pgTable(
  "production_logs",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    animalId: uuid("animal_id").references(() => animals.id, { onDelete: "set null" }),
    groupName: text("group_name"),
    kind: productionKind("kind").notNull(),
    date: date("date").notNull(),
    quantity: numeric("quantity").notNull(),
    unit: text("unit").notNull(),
    notes: text("notes"),
    /** Inventory item this production was added to, if any. */
    inventoryItemId: uuid("inventory_item_id"),
    memberId: uuid("member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("production_family_date_idx").on(t.familyId, t.kind, t.date)],
);

export const farmPlans = pgTable(
  "farm_plans",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    layout: jsonb("layout").$type<BlueprintLayout>().notNull(),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("farm_plans_family_idx").on(t.familyId)],
);
