import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { families, familyMembers, files, visibility } from "./core";
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
    /** How to look after this animal (for the family and sitters). */
    careInstructions: text("care_instructions"),
    /** Care routine, one step per entry, in order. */
    careSteps: text("care_steps").array().notNull().default([]),
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
    /** Who sees this map (family, selected people, Parents & me, Only me). */
    visibility: visibility("visibility").notNull().default("family"),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("farm_plans_family_idx").on(t.familyId)],
);

/** Feed we need to buy, by a due date: one order with several items. Visibility like other records. */
export const feedOrders = pgTable(
  "feed_orders",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    dueDate: date("due_date").notNull(),
    store: text("store"),
    notes: text("notes"),
    visibility: visibility("visibility").notNull().default("family"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("feed_orders_family_due_idx").on(t.familyId, t.dueDate)],
);

export const feedOrderItems = pgTable(
  "feed_order_items",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => feedOrders.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    quantity: text("quantity"),
    got: boolean("got").notNull().default(false),
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("feed_order_items_order_idx").on(t.orderId)],
);
