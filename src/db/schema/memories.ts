import { date, index, integer, pgTable, primaryKey, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { families, familyMembers, files } from "./core";

/**
 * Memories & Photos: family entries and milestones with photos and videos,
 * shown on a year-by-year timeline with photo albums and trips.
 */
export const memories = pgTable(
  "memories",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    /** memory | milestone */
    kind: text("kind").notNull().default("memory"),
    /** Who it's about. */
    memberIds: uuid("member_ids").array().notNull().default([]),
    place: text("place"),
    /** family | private (only the author) */
    visibility: text("visibility").notNull().default("family"),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("memories_family_date_idx").on(t.familyId, t.date)],
);

export const memoryMedia = pgTable(
  "memory_media",
  {
    id: id(),
    memoryId: uuid("memory_id")
      .notNull()
      .references(() => memories.id, { onDelete: "cascade" }),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    /** photo | video */
    mediaType: text("media_type").notNull().default("photo"),
    caption: text("caption"),
    sort: smallint("sort").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("memory_media_memory_idx").on(t.memoryId)],
);

/** Comments on a photo (entity_photos) or a memory. */
export const mediaComments = pgTable(
  "media_comments",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    /** photo | memory */
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("media_comments_entity_idx").on(t.entityType, t.entityId)],
);

export const mediaReactions = pgTable(
  "media_reactions",
  {
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.entityType, t.entityId, t.memberId, t.emoji] })],
);

/** Each person's favorite photos and memories. */
export const mediaFavorites = pgTable(
  "media_favorites",
  {
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.memberId, t.entityType, t.entityId] })],
);

/**
 * Anniversaries and other yearly dates (birthdays come from family members'
 * profiles and contacts). year null = unknown.
 */
export const familyDates = pgTable(
  "family_dates",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    /** anniversary | birthday | other */
    kind: text("kind").notNull().default("anniversary"),
    title: text("title").notNull(),
    month: smallint("month").notNull(),
    day: smallint("day").notNull(),
    year: smallint("year"),
    memberIds: uuid("member_ids").array().notNull().default([]),
    /** Reminder this many days before (and on the day). */
    remindDays: integer("remind_days").notNull().default(7),
    notes: text("notes"),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("family_dates_family_idx").on(t.familyId, t.month, t.day)],
);
