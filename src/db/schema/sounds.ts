import { boolean, date, index, jsonb, pgTable, smallint, text, time, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { families, familyMembers } from "./core";

/** One sound in a mix: which sound, how loud (0–100), muted or not. */
export type MixItem = { soundId: string; volume: number; muted?: boolean };
/** Recently played: kept short (see RECENT_LIMIT) and only what's needed to replay it. */
export type RecentSound = { type: "sound" | "mix" | "preset"; id: string; at: string };

/**
 * Sleep Sounds preferences, one row per member. Personal: never changes
 * anyone else's settings. Audio itself is generated in the browser, so
 * nothing here is audio data.
 */
export const soundPreferences = pgTable("sound_preferences", {
  memberId: uuid("member_id")
    .primaryKey()
    .references(() => familyMembers.id, { onDelete: "cascade" }),
  familyId: uuid("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  defaultVolume: smallint("default_volume").notNull().default(60),
  /** Minutes; 0 = keep playing until stopped. */
  defaultTimer: smallint("default_timer").notNull().default(60),
  fadeOut: boolean("fade_out").notNull().default(true),
  preferredSound: text("preferred_sound"),
  favoriteSounds: text("favorite_sounds").array().notNull().default([]),
  favoriteMixes: uuid("favorite_mixes").array().notNull().default([]),
  recent: jsonb("recent").$type<RecentSound[]>().notNull().default([]),
  /** Optional reminder ("bedtime", "relax", "meditation", "routine") at a local time on chosen days. */
  reminderKind: text("reminder_kind"),
  reminderTime: time("reminder_time"),
  /** Days of the week (0 = Sunday); empty = every day. */
  reminderDays: smallint("reminder_days").array().notNull().default([]),
  lastReminderOn: date("last_reminder_on"),
  ...timestamps,
});

/** A member's own sound mix. Private unless they share it with the household. */
export const soundMixes = pgTable(
  "sound_mixes",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    items: jsonb("items").$type<MixItem[]>().notNull().default([]),
    isShared: boolean("is_shared").notNull().default(false),
    /** The owner lets household members change it (only when shared). */
    allowEdits: boolean("allow_edits").notNull().default(false),
    lastPlayedAt: timestamp("last_played_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("sound_mixes_family_idx").on(t.familyId, t.isShared), index("sound_mixes_member_idx").on(t.memberId)],
);
