import { boolean, date, index, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { families, familyMembers } from "./core";

/**
 * Faith paths in the Spiritual section (Christian, Jewish, Hindu, Buddhist and
 * the Spiritual path). Each member picks their own paths on My settings
 * (family_members.faith_paths). Practices, reading, prayers and journal
 * entries belong to one member and are private unless they share them.
 */

/** A member's devotion/practice checklist for one faith (built-ins are copied in, then editable). */
export const faithPractices = pgTable(
  "faith_practices",
  {
    id: id(),
    familyId: uuid("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").notNull().references(() => familyMembers.id, { onDelete: "cascade" }),
    faith: text("faith").notNull(),
    name: text("name").notNull(),
    emoji: text("emoji"),
    /** Optional amount to record: "minutes", "rounds", "chapters"… */
    unit: text("unit"),
    builtinKey: text("builtin_key"),
    sort: integer("sort").notNull().default(0),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("faith_practices_member_idx").on(t.memberId, t.faith)],
);

export const faithPracticeLogs = pgTable(
  "faith_practice_logs",
  {
    id: id(),
    familyId: uuid("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").notNull().references(() => familyMembers.id, { onDelete: "cascade" }),
    practiceId: uuid("practice_id").notNull().references(() => faithPractices.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    amount: integer("amount"),
    note: text("note"),
    ...timestamps,
  },
  (t) => [uniqueIndex("faith_practice_logs_uq").on(t.practiceId, t.date), index("faith_practice_logs_member_idx").on(t.memberId, t.date)],
);

/** A member's own book or text to track (beyond the built-in ones). */
export const faithTexts = pgTable(
  "faith_texts",
  {
    id: id(),
    familyId: uuid("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").notNull().references(() => familyMembers.id, { onDelete: "cascade" }),
    faith: text("faith").notNull(),
    title: text("title").notNull(),
    sectionLabel: text("section_label").notNull().default("Chapter"),
    sections: integer("sections").notNull(),
    ...timestamps,
  },
  (t) => [index("faith_texts_member_idx").on(t.memberId)],
);

/** One row per section (chapter, portion…) a member has read. text_key = built-in key or a faith_texts id. */
export const faithReadingLogs = pgTable(
  "faith_reading_logs",
  {
    id: id(),
    familyId: uuid("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").notNull().references(() => familyMembers.id, { onDelete: "cascade" }),
    textKey: text("text_key").notNull(),
    section: integer("section").notNull(),
    readOn: date("read_on").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("faith_reading_logs_uq").on(t.memberId, t.textKey, t.section), index("faith_reading_logs_date_idx").on(t.memberId, t.readOn)],
);

/** Prayer requests / intentions. Private to the member unless shared with the family. */
export const faithPrayers = pgTable(
  "faith_prayers",
  {
    id: id(),
    familyId: uuid("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").notNull().references(() => familyMembers.id, { onDelete: "cascade" }),
    faith: text("faith").notNull(),
    title: text("title").notNull(),
    forWhom: text("for_whom"),
    details: text("details"),
    shared: boolean("shared").notNull().default(false),
    answeredOn: date("answered_on"),
    answerNote: text("answer_note"),
    ...timestamps,
  },
  (t) => [index("faith_prayers_family_idx").on(t.familyId, t.faith)],
);

/** Devotional / study journal. */
export const faithEntries = pgTable(
  "faith_entries",
  {
    id: id(),
    familyId: uuid("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").notNull().references(() => familyMembers.id, { onDelete: "cascade" }),
    faith: text("faith").notNull(),
    date: date("date").notNull(),
    title: text("title"),
    reference: text("reference"),
    body: text("body").notNull(),
    shared: boolean("shared").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("faith_entries_member_idx").on(t.memberId, t.faith, t.date)],
);

/**
 * Family holidays: a custom day (holiday_key null; yearly = same month/day every
 * year) or a one-year date change for a built-in holiday (holiday_key set).
 */
export const faithHolidays = pgTable(
  "faith_holidays",
  {
    id: id(),
    familyId: uuid("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
    faith: text("faith").notNull(),
    holidayKey: text("holiday_key"),
    name: text("name").notNull(),
    emoji: text("emoji"),
    date: date("date").notNull(),
    yearly: boolean("yearly").notNull().default(false),
    notes: text("notes"),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("faith_holidays_family_idx").on(t.familyId, t.faith)],
);
