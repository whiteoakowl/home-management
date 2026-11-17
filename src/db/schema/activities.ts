import { boolean, date, index, pgTable, smallint, text, time, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { families, familyMembers } from "./core";

// ─── Dance ────────────────────────────────────────────────────────────────────

/** A dancer's team, level or company (several per dancer, e.g. "Junior Competition Team" + "Ballet Level 3"). */
export const danceEnrollments = pgTable(
  "dance_enrollments",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").$type<"team" | "level" | "class" | "company">().notNull().default("team"),
    level: text("level"),
    studio: text("studio"),
    style: text("style"),
    season: text("season"),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("dance_enrollments_member_idx").on(t.memberId)],
);

/** A weekly class or rehearsal (repeats every week on `weekday` during the season). */
export const danceClasses = pgTable(
  "dance_classes",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    enrollmentId: uuid("enrollment_id").references(() => danceEnrollments.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    /** 0 = Sunday … 6 = Saturday */
    weekday: smallint("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time"),
    location: text("location"),
    /** Season dates; classes only show between these (inclusive). */
    startsOn: date("starts_on"),
    endsOn: date("ends_on"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("dance_classes_family_idx").on(t.familyId)],
);

/** Studio closed / break / holiday. memberId null = applies to every dancer (studio closed). */
export const danceDaysOff = pgTable(
  "dance_days_off",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").references(() => familyMembers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    ...timestamps,
  },
  (t) => [index("dance_days_off_family_idx").on(t.familyId, t.startDate)],
);

/** Recital, competition, showcase, dress rehearsal, photo day… for one or more dancers. */
export const danceEvents = pgTable(
  "dance_events",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    memberIds: uuid("member_ids").array().notNull().default([]),
    kind: text("kind").$type<"performance" | "competition" | "recital" | "rehearsal" | "photos" | "other">().notNull().default("performance"),
    title: text("title").notNull(),
    date: date("date").notNull(),
    endDate: date("end_date"),
    callTime: time("call_time"),
    startTime: time("start_time"),
    endTime: time("end_time"),
    location: text("location"),
    /** Costume, hair & makeup, what to bring. */
    details: text("details"),
    ...timestamps,
  },
  (t) => [index("dance_events_family_idx").on(t.familyId, t.date)],
);

// ─── Work schedules ───────────────────────────────────────────────────────────

/** One work shift. Schedules change week to week, so each shift is its own row. */
export const workShifts = pgTable(
  "work_shifts",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    /** Job or place, e.g. "Hospital", "Café". */
    job: text("job"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("work_shifts_family_date_idx").on(t.familyId, t.date)],
);
