import { index, integer, jsonb, numeric, pgTable, smallint, text, time, timestamp, uuid, date } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { families, familyMembers, files } from "./core";

/** A baby being tracked: a family member, or a name for a baby not in the family list yet. */
export const babies = pgTable(
  "babies",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    birthDate: date("birth_date"),
    /** Bottle / pumping amounts in ounces or millilitres. */
    volumeUnit: text("volume_unit").$type<"oz" | "ml">().notNull().default("oz"),
    weightUnit: text("weight_unit").$type<"lb" | "kg">().notNull().default("lb"),
    notes: text("notes"),
    imageFileId: uuid("image_file_id").references(() => files.id, { onDelete: "set null" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("babies_family_idx").on(t.familyId)],
);

export type BabyLogKind =
  | "nursing"
  | "bottle"
  | "solids"
  | "pump"
  | "diaper"
  | "sleep"
  | "growth"
  | "temperature"
  | "medicine"
  | "symptom"
  | "vaccine"
  | "doctor"
  | "milestone"
  | "tummy"
  | "bath"
  | "teeth"
  | "activity"
  | "note";

/**
 * Everything logged for a baby. `startedAt` is when it happened; `endedAt` is
 * set for things with a duration (nursing, sleep, tummy time) and is null while
 * a timer is running. Kind-specific details live in `data`.
 */
export const babyLogs = pgTable(
  "baby_logs",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    babyId: uuid("baby_id")
      .notNull()
      .references(() => babies.id, { onDelete: "cascade" }),
    kind: text("kind").$type<BabyLogKind>().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    /** Bottle/pump volume, weight, temperature or dose, depending on kind. */
    amount: numeric("amount"),
    data: jsonb("data").$type<Record<string, string | number | boolean | null>>().notNull().default({}),
    notes: text("notes"),
    imageFileId: uuid("image_file_id").references(() => files.id, { onDelete: "set null" }),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("baby_logs_baby_idx").on(t.babyId, t.startedAt), index("baby_logs_kind_idx").on(t.babyId, t.kind)],
);

/** The baby's daily routine: feeds, naps, bath, bedtime… */
export const babySchedule = pgTable(
  "baby_schedule",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    babyId: uuid("baby_id")
      .notNull()
      .references(() => babies.id, { onDelete: "cascade" }),
    time: time("time").notNull(),
    /** Minutes it usually lasts (naps, bath…). */
    minutes: integer("minutes"),
    kind: text("kind").$type<"feed" | "nap" | "bath" | "bedtime" | "wake" | "medicine" | "play" | "tummy" | "meal" | "other">().notNull().default("feed"),
    title: text("title").notNull(),
    /** Days of the week (0 = Sunday); empty = every day. */
    days: smallint("days").array().notNull().default([]),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("baby_schedule_baby_idx").on(t.babyId, t.time)],
);
