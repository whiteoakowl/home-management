import { boolean, date, doublePrecision, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { families, familyMembers, files } from "./core";

/** A pool or spa/hot tub. Chemistry rules live in src/lib/pool.ts. */
export const pools = pgTable(
  "pools",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** "pool" | "spa" */
    kind: text("kind").$type<"pool" | "spa">().notNull().default("pool"),
    gallons: integer("gallons").notNull(),
    /** "chlorine" | "salt" | "bromine" */
    sanitizer: text("sanitizer").$type<"chlorine" | "salt" | "bromine">().notNull().default("chlorine"),
    /** "plaster" | "vinyl" | "fiberglass" */
    surface: text("surface").$type<"plaster" | "vinyl" | "fiberglass">().notNull().default("plaster"),
    /** Chlorine the family uses, for dose amounts (see CHLORINE_PRODUCTS). */
    chlorineProduct: text("chlorine_product").$type<"liquid10" | "liquid12" | "calhypo65" | "calhypo73" | "dichlor" | "trichlor">().notNull().default("liquid10"),
    /** Salt pools: the cell's recommended salt level (ppm). */
    saltTarget: integer("salt_target"),
    filterType: text("filter_type"),
    /** In season (open) or winterized (closed). */
    isOpen: boolean("is_open").notNull().default(true),
    notes: text("notes"),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("pools_family_idx").on(t.familyId)],
);

/** A water test. Every reading is optional (strips often skip some). */
export const poolTests = pgTable(
  "pool_tests",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    poolId: uuid("pool_id")
      .notNull()
      .references(() => pools.id, { onDelete: "cascade" }),
    testedAt: timestamp("tested_at", { withTimezone: true }).notNull().defaultNow(),
    fc: doublePrecision("fc"),
    cc: doublePrecision("cc"),
    ph: doublePrecision("ph"),
    ta: doublePrecision("ta"),
    ch: doublePrecision("ch"),
    cya: doublePrecision("cya"),
    salt: doublePrecision("salt"),
    tempF: doublePrecision("temp_f"),
    phosphates: doublePrecision("phosphates"),
    notes: text("notes"),
    photoFileId: uuid("photo_file_id").references(() => files.id, { onDelete: "set null" }),
    testedByMemberId: uuid("tested_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("pool_tests_pool_idx").on(t.poolId, t.testedAt)],
);

/** Chemicals added (and optionally their cost, recorded in the family budget). */
export const poolAdditions = pgTable(
  "pool_additions",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    poolId: uuid("pool_id")
      .notNull()
      .references(() => pools.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    chemical: text("chemical").notNull(),
    amount: text("amount"),
    costCents: integer("cost_cents"),
    notes: text("notes"),
    addedByMemberId: uuid("added_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("pool_additions_pool_idx").on(t.poolId, t.date)],
);

/** Pump, filter, heater, salt cell, cleaner… with service dates. */
export const poolEquipment = pgTable(
  "pool_equipment",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    poolId: uuid("pool_id")
      .notNull()
      .references(() => pools.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("other"),
    model: text("model"),
    installedOn: date("installed_on"),
    lastServicedOn: date("last_serviced_on"),
    serviceEveryMonths: integer("service_every_months"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("pool_equipment_pool_idx").on(t.poolId)],
);
