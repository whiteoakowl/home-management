import { boolean, date, index, integer, jsonb, numeric, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { calendarEvents } from "./calendar";
import { families, familyMembers, files, visibility } from "./core";

export type PregnancyStatus = "active" | "paused" | "archived" | "completed" | "born";
export type BirthOutcome = { date?: string | null; time?: string | null; location?: string | null; weight?: string | null; length?: string | null; notes?: string | null; memberIds?: string[]; babyIds?: string[] };
export type PregnancyReminders = { kicks?: string | null; hydration?: boolean; journal?: string | null; weekly?: boolean; prep?: boolean; questions?: boolean };
export type IvfInfo = { transferDate?: string | null; embryoDays?: number | null; notes?: string | null };

/**
 * One pregnancy. A family (and a member) can have any number over time; each
 * is kept separately and never overwritten. `memberId` is the person who is
 * pregnant (the owner); who else sees it follows `visibility` and record_access.
 */
export const pregnancies = pgTable(
  "pregnancies",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    nickname: text("nickname"),
    babyNickname: text("baby_nickname"),
    babySex: text("baby_sex").$type<"girl" | "boy" | "unknown" | "surprise" | "mixed">().notNull().default("unknown"),
    dueDate: date("due_date"),
    lmpDate: date("lmp_date"),
    conceptionDate: date("conception_date"),
    /** How the due date was worked out: due (entered), lmp, conception, ivf or ultrasound. */
    dueSource: text("due_source").$type<"due" | "lmp" | "conception" | "ivf" | "ultrasound">().notNull().default("due"),
    ivf: jsonb("ivf").$type<IvfInfo>(),
    pregnancyNumber: smallint("pregnancy_number"),
    previousPregnancies: text("previous_pregnancies"),
    /** 1 singleton, 2 twins, 3 triplets, 4+ other multiples. */
    babyCount: smallint("baby_count").notNull().default(1),
    provider: text("provider"),
    providerPhone: text("provider_phone"),
    providerEmail: text("provider_email"),
    providerAddress: text("provider_address"),
    hospital: text("hospital"),
    birthLocation: text("birth_location"),
    notes: text("notes"),
    status: text("status").$type<PregnancyStatus>().notNull().default("active"),
    endedOn: date("ended_on"),
    outcome: jsonb("outcome").$type<BirthOutcome>(),
    /** Birth Preferences Plan: section key → text. */
    birthPlan: jsonb("birth_plan").$type<Record<string, string>>().notNull().default({}),
    reminders: jsonb("reminders").$type<PregnancyReminders>().notNull().default({}),
    /** Last day each reminder went out (so each sends at most once a day). */
    reminderState: jsonb("reminder_state").$type<Record<string, string>>().notNull().default({}),
    visibility: visibility("visibility").notNull().default("parents"),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("pregnancies_family_idx").on(t.familyId, t.status), index("pregnancies_member_idx").on(t.memberId)],
);

export type PregnancyLogKind = "symptom" | "mood" | "weight" | "measure" | "kicks" | "contractions" | "hydration" | "meal" | "sleep" | "dose";

/**
 * Everything tracked over time: symptoms, mood, weight, blood pressure and
 * other measurements, kick-count and contraction sessions, water, meals,
 * sleep and medicine doses. Details live in `data`.
 */
export const pregnancyLogs = pgTable(
  "pregnancy_logs",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    pregnancyId: uuid("pregnancy_id")
      .notNull()
      .references(() => pregnancies.id, { onDelete: "cascade" }),
    kind: text("kind").$type<PregnancyLogKind>().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    amount: numeric("amount"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    notes: text("notes"),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("pregnancy_logs_idx").on(t.pregnancyId, t.kind, t.startedAt)],
);

export type PregnancyItemKind = "question" | "medication" | "name" | "checklist";

/**
 * Lists: questions for the provider, medicines & supplements, baby names and
 * preparation checklists. `list` groups them (question category, name list,
 * checklist section); `status` is the item's state.
 */
export const pregnancyItems = pgTable(
  "pregnancy_items",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    pregnancyId: uuid("pregnancy_id")
      .notNull()
      .references(() => pregnancies.id, { onDelete: "cascade" }),
    kind: text("kind").$type<PregnancyItemKind>().notNull(),
    list: text("list"),
    title: text("title").notNull(),
    status: text("status"),
    done: boolean("done").notNull().default(false),
    favorite: boolean("favorite").notNull().default(false),
    rating: smallint("rating"),
    notes: text("notes"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    appointmentId: uuid("appointment_id"),
    dueOn: date("due_on"),
    position: integer("position").notNull().default(0),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("pregnancy_items_idx").on(t.pregnancyId, t.kind, t.list)],
);

/**
 * Prenatal appointments. The date, time, place and reminder live on the
 * family calendar event (so they show on the Calendar and use its reminders);
 * this row holds the pregnancy-specific details.
 */
export const pregnancyAppointments = pgTable(
  "pregnancy_appointments",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    pregnancyId: uuid("pregnancy_id")
      .notNull()
      .references(() => pregnancies.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => calendarEvents.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"prenatal" | "ultrasound" | "lab" | "specialist" | "hospital" | "class" | "other">().notNull().default("prenatal"),
    provider: text("provider"),
    tests: text("tests"),
    results: text("results"),
    followUpOn: date("follow_up_on"),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("pregnancy_appointments_idx").on(t.pregnancyId), uniqueIndex("pregnancy_appointments_event_idx").on(t.eventId)],
);

/** Journal entries, photos (bump, ultrasound, milestones) and private documents. */
export const pregnancyEntries = pgTable(
  "pregnancy_entries",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    pregnancyId: uuid("pregnancy_id")
      .notNull()
      .references(() => pregnancies.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"journal" | "photo" | "document">().notNull(),
    /** journal: memory, milestone, emotion, appointment, note. photo: bump, ultrasound, announcement, milestone, family. document: ultrasound, results, appointment, instructions, birth, other. */
    category: text("category"),
    title: text("title"),
    body: text("body"),
    date: date("date").notNull(),
    /** Pregnancy week on that date (saved so it never shifts if the due date changes later). */
    week: smallint("week"),
    mood: text("mood"),
    fileId: uuid("file_id").references(() => files.id, { onDelete: "set null" }),
    appointmentId: uuid("appointment_id").references(() => pregnancyAppointments.id, { onDelete: "set null" }),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("pregnancy_entries_idx").on(t.pregnancyId, t.kind, t.date)],
);

/**
 * Educational week-by-week content overrides, edited by the platform admin.
 * The built-in content lives in src/lib/pregnancy/weeks.ts; a row here
 * replaces fields for one week without changing the app.
 */
export const pregnancyWeekContent = pgTable("pregnancy_week_content", {
  week: smallint("week").primaryKey(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
