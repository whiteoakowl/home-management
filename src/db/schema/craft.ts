import { boolean, date, index, integer, jsonb, pgTable, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { families, familyMembers, files, visibility } from "./core";
import { plants } from "./garden";
import { inventoryItems } from "./kitchen";
import { lists } from "./lists";
import { recipes } from "./meals";

/**
 * Witchcraft & spirituality library. One table for every reference kind
 * (spell, ritual, crystal, herb, tool, wellness) with kind-specific fields in
 * JSONB. family_id NULL = built-in reference entry (crystals, herbs, tools).
 */
export const craftItems = pgTable(
  "craft_items",
  {
    id: id(),
    familyId: uuid("family_id").references(() => families.id, { onDelete: "cascade" }),
    /** spell | ritual | crystal | herb | tool | wellness */
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    category: text("category"),
    description: text("description"),
    imageFileId: uuid("image_file_id").references(() => files.id, { onDelete: "set null" }),
    /** Emoji illustration for built-in entries. */
    emoji: text("emoji"),
    moonPhase: text("moon_phase"),
    /** Wheel of the Year association (samhain, yule…). */
    sabbat: text("sabbat"),
    /** Herb ↔ garden plant link (no duplicate plant records). */
    plantId: uuid("plant_id").references(() => plants.id, { onDelete: "set null" }),
    fields: jsonb("fields").$type<Record<string, string>>().notNull().default({}),
    notes: text("notes"),
    source: text("source"),
    isFavorite: boolean("is_favorite").notNull().default(false),
    visibility: visibility("visibility").notNull().default("family"),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("craft_items_family_kind_idx").on(t.familyId, t.kind)],
);

export const craftItemImages = pgTable(
  "craft_item_images",
  {
    itemId: uuid("item_id")
      .notNull()
      .references(() => craftItems.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.fileId] })],
);

/** Personal collection: owned crystals & tools (references a library item). */
export const craftCollection = pgTable(
  "craft_collection",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => craftItems.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    acquiredOn: date("acquired_on"),
    location: text("location"),
    /** owned | wishlist | gifted */
    status: text("status").notNull().default("owned"),
    photoFileId: uuid("photo_file_id").references(() => files.id, { onDelete: "set null" }),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("craft_collection_family_idx").on(t.familyId)],
);

/** Spell/ritual → supplies (shared inventory items). */
export const craftItemSupplies = pgTable(
  "craft_item_supplies",
  {
    itemId: uuid("item_id")
      .notNull()
      .references(() => craftItems.id, { onDelete: "cascade" }),
    inventoryItemId: uuid("inventory_item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.inventoryItemId] })],
);

/** Per-family overrides for Wheel of the Year dates & notes, plus custom celebrations. */
export const sabbatSettings = pgTable(
  "sabbat_settings",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    /** samhain…mabon, or custom:<slug> for personal celebrations */
    key: text("key").notNull(),
    name: text("name"),
    /** MM-DD override (recurring yearly). */
    monthDay: text("month_day"),
    notes: text("notes"),
    imageFileId: uuid("image_file_id").references(() => files.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("sabbat_settings_family_key_uq").on(t.familyId, t.key)],
);

export const celebrations = pgTable(
  "celebrations",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sabbat: text("sabbat"),
    date: date("date").notNull(),
    guestList: text("guest_list"),
    decorations: text("decorations"),
    activities: text("activities"),
    ritualPlan: text("ritual_plan"),
    supplies: text("supplies"),
    budgetCents: integer("budget_cents"),
    notes: text("notes"),
    imageFileId: uuid("image_file_id").references(() => files.id, { onDelete: "set null" }),
    calendarEventId: uuid("calendar_event_id"),
    shoppingListId: uuid("shopping_list_id").references(() => lists.id, { onDelete: "set null" }),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("celebrations_family_idx").on(t.familyId, t.date)],
);

export const celebrationLinks = pgTable(
  "celebration_links",
  {
    celebrationId: uuid("celebration_id")
      .notNull()
      .references(() => celebrations.id, { onDelete: "cascade" }),
    recipeId: uuid("recipe_id").references(() => recipes.id, { onDelete: "cascade" }),
    craftItemId: uuid("craft_item_id").references(() => craftItems.id, { onDelete: "cascade" }),
    id: id(),
  },
  (t) => [index("celebration_links_idx").on(t.celebrationId)],
);
