import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { categories, families, familyMembers, files, visibility } from "./core";
import { recurrenceRules } from "./household";

export const eventSource = pgEnum("event_source", [
  "manual",
  "chore",
  "workout",
  "meal",
  "garden",
  "farm",
  "medical",
  "pet",
  "celebration",
  "maintenance",
]);

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    location: text("location"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    allDay: boolean("all_day").notNull().default(false),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    color: text("color"),
    recurrenceRuleId: uuid("recurrence_rule_id").references(() => recurrenceRules.id, {
      onDelete: "set null",
    }),
    reminderMinutes: integer("reminder_minutes"),
    notes: text("notes"),
    visibility: visibility("visibility").notNull().default("family"),
    source: eventSource("source").notNull().default("manual"),
    sourceId: uuid("source_id"),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [index("events_family_start_idx").on(t.familyId, t.startsAt)],
);

export const eventAttendees = pgTable(
  "event_attendees",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => calendarEvents.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.memberId] })],
);

export const eventAttachments = pgTable(
  "event_attachments",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => calendarEvents.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.fileId] })],
);
