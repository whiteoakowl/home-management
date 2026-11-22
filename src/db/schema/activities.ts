import { boolean, date, index, integer, jsonb, pgTable, smallint, text, time, uuid } from "drizzle-orm/pg-core";
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
    kind: text("kind").$type<"performance" | "competition" | "recital" | "rehearsal" | "audition" | "photos" | "other">().notNull().default("performance"),
    title: text("title").notNull(),
    date: date("date").notNull(),
    endDate: date("end_date"),
    callTime: time("call_time"),
    startTime: time("start_time"),
    endTime: time("end_time"),
    location: text("location"),
    /** Costume, hair & makeup, what to bring. */
    details: text("details"),
    /** What it costs us (entry, costume, photo package…), in cents. */
    costCents: integer("cost_cents"),
    /** Price of one audience ticket, in cents. */
    ticketCents: integer("ticket_cents"),
    /** Tickets, registration or info page. */
    link: text("link"),
    ...timestamps,
  },
  (t) => [index("dance_events_family_idx").on(t.familyId, t.date)],
);

/** One pair of pointe shoes: ordered → on hand → in use → retired. */
export const pointeShoes = pgTable(
  "pointe_shoes",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    brand: text("brand").notNull(),
    model: text("model"),
    size: text("size"),
    width: text("width"),
    shank: text("shank"),
    /** Box wings (e.g. "Medium", "3/4 wing"). */
    wings: text("wings"),
    status: text("status").$type<"ordered" | "on_hand" | "in_use" | "retired">().notNull().default("on_hand"),
    store: text("store"),
    priceCents: integer("price_cents"),
    orderedOn: date("ordered_on"),
    receivedOn: date("received_on"),
    firstWornOn: date("first_worn_on"),
    retiredOn: date("retired_on"),
    /** Manual "order the next pair by" date (otherwise worked out from how long pairs last). */
    reorderBy: date("reorder_by"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("pointe_shoes_member_idx").on(t.familyId, t.memberId)],
);

/** A dancer's favourite pointe shoe fits and brands. */
export const pointeFavorites = pgTable(
  "pointe_favorites",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    brand: text("brand").notNull(),
    model: text("model"),
    size: text("size"),
    width: text("width"),
    shank: text("shank"),
    wings: text("wings"),
    /** Fitter notes, where to buy, toe pads… */
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("pointe_favorites_member_idx").on(t.familyId, t.memberId)],
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

// ─── Sports ───────────────────────────────────────────────────────────────────

/** A family member's team for a season (several per athlete). */
export const sportTeams = pgTable(
  "sport_teams",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    /** Key from src/lib/sports.ts SPORTS ("soccer", "basketball", … "other"). */
    sport: text("sport").notNull(),
    sportName: text("sport_name"),
    name: text("name").notNull(),
    season: text("season"),
    league: text("league"),
    position: text("position"),
    jerseyNumber: text("jersey_number"),
    coach: text("coach"),
    coachContact: text("coach_contact"),
    /** Extra stat names the family tracks for this team. */
    customStats: text("custom_stats").array().notNull().default([]),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("sport_teams_member_idx").on(t.memberId)],
);

/** Weekly practice (repeats on `weekday` between startsOn and endsOn). */
export const sportPractices = pgTable(
  "sport_practices",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => sportTeams.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time"),
    location: text("location"),
    startsOn: date("starts_on"),
    endsOn: date("ends_on"),
    ...timestamps,
  },
  (t) => [index("sport_practices_family_idx").on(t.familyId)],
);

/** A game, match, meet, tournament or tryout, with the result once played. */
export const sportGames = pgTable(
  "sport_games",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => sportTeams.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"game" | "tournament" | "meet" | "scrimmage" | "tryout" | "other">().notNull().default("game"),
    opponent: text("opponent"),
    date: date("date").notNull(),
    arriveTime: time("arrive_time"),
    startTime: time("start_time"),
    location: text("location"),
    homeAway: text("home_away").$type<"home" | "away" | "neutral">(),
    ourScore: integer("our_score"),
    theirScore: integer("their_score"),
    /** win | loss | tie (when there's no score, e.g. a meet) */
    outcome: text("outcome"),
    /** Uniform, snacks duty, what to bring. */
    details: text("details"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("sport_games_family_idx").on(t.familyId, t.date)],
);

/** One athlete's stat line for one game ({ pts: 12, reb: 4 }). */
export const sportStatLines = pgTable(
  "sport_stat_lines",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    gameId: uuid("game_id")
      .notNull()
      .references(() => sportGames.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    stats: jsonb("stats").$type<Record<string, number>>().notNull().default({}),
    note: text("note"),
    ...timestamps,
  },
  (t) => [index("sport_stats_game_idx").on(t.gameId)],
);
