import { boolean, date, doublePrecision, index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { families, familyMembers, files } from "./core";

/** A family car, truck, motorcycle, RV… with its paperwork and optional loan. */
export const vehicles = pgTable(
  "vehicles",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    nickname: text("nickname").notNull(),
    year: integer("year"),
    make: text("make"),
    model: text("model"),
    trim: text("trim"),
    color: text("color"),
    vin: text("vin"),
    plate: text("plate"),
    driverMemberId: uuid("driver_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    imageFileId: uuid("image_file_id").references(() => files.id, { onDelete: "set null" }),
    purchaseDate: date("purchase_date"),
    purchasePriceCents: integer("purchase_price_cents"),
    oilType: text("oil_type"),
    tireSize: text("tire_size"),
    insuranceCompany: text("insurance_company"),
    insurancePolicy: text("insurance_policy"),
    insuranceRenewsOn: date("insurance_renews_on"),
    registrationExpiresOn: date("registration_expires_on"),
    inspectionDueOn: date("inspection_due_on"),
    // Loan (all optional)
    loanLender: text("loan_lender"),
    loanAmountCents: integer("loan_amount_cents"),
    loanApr: doublePrecision("loan_apr"),
    loanPaymentCents: integer("loan_payment_cents"),
    loanStartDate: date("loan_start_date"),
    loanTermMonths: integer("loan_term_months"),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    /** Set = in this member's own "My Vehicles" (only they see it, never parents); null = the family's (parents). */
    privateOwnerId: uuid("private_owner_id").references(() => familyMembers.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index("vehicles_family_idx").on(t.familyId)],
);

/** Odometer readings (also added automatically from service records). */
export const vehicleOdometer = pgTable(
  "vehicle_odometer",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    miles: integer("miles").notNull(),
    ...timestamps,
  },
  (t) => [index("vehicle_odometer_vehicle_idx").on(t.vehicleId, t.date)],
);

/** Recurring maintenance (oil change every 5,000 mi or 6 months…). */
export const vehicleSchedule = pgTable(
  "vehicle_schedule",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    everyMiles: integer("every_miles"),
    everyMonths: integer("every_months"),
    lastDate: date("last_date"),
    lastMiles: integer("last_miles"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("vehicle_schedule_vehicle_idx").on(t.vehicleId)],
);

/** Work done: maintenance, repairs, inspections, with parts and cost. */
export const vehicleServices = pgTable(
  "vehicle_services",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    scheduleId: uuid("schedule_id").references(() => vehicleSchedule.id, { onDelete: "set null" }),
    date: date("date").notNull(),
    miles: integer("miles"),
    kind: text("kind").notNull().default("maintenance"),
    title: text("title").notNull(),
    shop: text("shop"),
    /** Parts used, one per line ("Oil filter Fram PH7317"). */
    parts: text("parts"),
    costCents: integer("cost_cents"),
    receiptFileId: uuid("receipt_file_id").references(() => files.id, { onDelete: "set null" }),
    notes: text("notes"),
    loggedByMemberId: uuid("logged_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("vehicle_services_vehicle_idx").on(t.vehicleId, t.date)],
);

/** Parts & specs to remember (wiper sizes, bulbs, filters, part numbers). */
export const vehicleParts = pgTable(
  "vehicle_parts",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    partNumber: text("part_number"),
    brand: text("brand"),
    whereToBuy: text("where_to_buy"),
    lastReplacedOn: date("last_replaced_on"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("vehicle_parts_vehicle_idx").on(t.vehicleId)],
);
