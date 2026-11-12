import {
  date,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { categories, families, familyMembers, files } from "./core";

export const storageLocation = pgEnum("storage_location", [
  "pantry",
  "fridge",
  "freezer",
  "supplies",
  "farm",
  "garden",
  "other",
]);
export const inventoryEventKind = pgEnum("inventory_event_kind", [
  "added",
  "used",
  "discarded",
  "donated",
  "replaced",
  "adjusted",
]);
export const inventorySource = pgEnum("inventory_source", [
  "manual",
  "barcode",
  "shopping",
  "garden_harvest",
  "farm_production",
  "recipe",
]);

/** Product catalogue: cache of barcode lookups and manually named products. */
export const products = pgTable(
  "products",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    barcode: text("barcode"),
    name: text("name").notNull(),
    brand: text("brand"),
    defaultUnit: text("default_unit"),
    defaultLocation: storageLocation("default_location"),
    imageUrl: text("image_url"),
    lookupData: jsonb("lookup_data"),
    ...timestamps,
  },
  (t) => [uniqueIndex("products_family_barcode_uq").on(t.familyId, t.barcode)],
);

export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    quantity: numeric("quantity").notNull().default("1"),
    unit: text("unit"),
    location: storageLocation("location").notNull().default("pantry"),
    /** Sub-location, e.g. "Top shelf", "Chest freezer". */
    spot: text("spot"),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    purchasedOn: date("purchased_on"),
    expiresOn: date("expires_on"),
    lowStockThreshold: numeric("low_stock_threshold"),
    imageFileId: uuid("image_file_id").references(() => files.id, { onDelete: "set null" }),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("inventory_family_location_idx").on(t.familyId, t.location),
    index("inventory_family_expires_idx").on(t.familyId, t.expiresOn),
  ],
);

/** Ledger of inventory changes: powers kitchen history & waste reports. */
export const inventoryEvents = pgTable(
  "inventory_events",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "cascade" }),
    kind: inventoryEventKind("kind").notNull(),
    quantityDelta: numeric("quantity_delta").notNull(),
    source: inventorySource("source").notNull().default("manual"),
    sourceId: uuid("source_id"),
    memberId: uuid("member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("inventory_events_item_idx").on(t.itemId, t.createdAt)],
);
