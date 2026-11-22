import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
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
    /** Repeating events: dates ("YYYY-MM-DD") removed from the series ("delete this one only"). */
    skippedDates: text("skipped_dates").array().notNull().default([]),
    notes: text("notes"),
    visibility: visibility("visibility").notNull().default("family"),
    source: eventSource("source").notNull().default("manual"),
    sourceId: uuid("source_id"),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [index("events_family_start_idx").on(t.familyId, t.startsAt), index("events_starts_idx").on(t.startsAt)],
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

/**
 * Calendar sync, part 1: a member's private subscribe link (an .ics feed) for
 * Google Calendar, Outlook or Apple Calendar. Whoever has the link can read
 * what that member sees, so it's long and random and can be reset.
 */
export const calendarFeeds = pgTable(
  "calendar_feeds",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    /** Calendar layers included (events, chores, sports…). */
    layers: text("layers").array().notNull(),
    /** Only things this member is part of (their events, their chores). */
    onlyMine: boolean("only_mine").notNull().default(false),
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("calendar_feeds_token_uq").on(t.token), uniqueIndex("calendar_feeds_member_uq").on(t.memberId)],
);

/**
 * Calendar sync, part 2: someone's own Google / Outlook / iCloud calendar,
 * added by its private iCal link and shown on the family calendar.
 */
export const calendarImports = pgTable(
  "calendar_imports",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    url: text("url").notNull(),
    color: text("color").notNull().default("sky"),
    /** family = everyone sees these events; private = only the person who added it. */
    shared: boolean("shared").notNull().default(true),
    /** Parsed events (kept so the calendar never waits on Google/Microsoft/Apple). */
    events: jsonb("events").$type<ImportedEvent[]>().notNull().default([]),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }),
    lastError: text("last_error"),
    ...timestamps,
  },
  (t) => [index("calendar_imports_family_idx").on(t.familyId)],
);

/** One occurrence from an imported calendar (recurring events are expanded). */
export type ImportedEvent = { uid: string; title: string; start: string; end: string | null; allDay: boolean; location?: string | null; description?: string | null };

/**
 * Event templates: "Soccer practice, every Tuesday 5:30, the park, Jack,
 * remind 1 hour before". Using one creates a repeating calendar event.
 */
export const eventTemplates = pgTable(
  "event_templates",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    /** What the template is called in the list. */
    name: text("name").notNull(),
    /** Event title (defaults to the name). */
    title: text("title").notNull(),
    location: text("location"),
    description: text("description"),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    color: text("color"),
    /** "HH:MM" local time; null = all day. */
    startTime: text("start_time"),
    durationMin: integer("duration_min").notNull().default(60),
    /** Repeats weekly on these days (0 = Sunday); empty = a one-time event. */
    weekdays: integer("weekdays").array().notNull().default([]),
    memberIds: uuid("member_ids").array().notNull().default([]),
    reminderMinutes: integer("reminder_minutes"),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("event_templates_family_idx").on(t.familyId)],
);

/** Timed reminders already sent (one per event occurrence). */
export const eventRemindersSent = pgTable(
  "event_reminders_sent",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => calendarEvents.id, { onDelete: "cascade" }),
    occursAt: timestamp("occurs_at", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.occursAt] }), index("event_reminders_sent_at_idx").on(t.sentAt)],
);
