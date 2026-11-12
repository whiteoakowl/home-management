import {
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { families, familyMembers, files, visibility } from "./core";
import { recurrenceRules } from "./household";

// ─── Journal ─────────────────────────────────────────────────────────────────

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    authorMemberId: uuid("author_member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    title: text("title"),
    body: text("body").notNull(),
    mood: text("mood"),
    tags: text("tags").array().notNull().default([]),
    /** 'private' = author only (parents included). */
    visibility: visibility("visibility").notNull().default("private"),
    ...timestamps,
  },
  (t) => [index("journal_family_date_idx").on(t.familyId, t.date)],
);

export const journalEntryMembers = pgTable(
  "journal_entry_members",
  {
    entryId: uuid("entry_id")
      .notNull()
      .references(() => journalEntries.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.entryId, t.memberId] })],
);

export const journalEntryFiles = pgTable(
  "journal_entry_files",
  {
    entryId: uuid("entry_id")
      .notNull()
      .references(() => journalEntries.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.entryId, t.fileId] })],
);

// ─── Goals ───────────────────────────────────────────────────────────────────

export const goalKind = pgEnum("goal_kind", ["savings", "fitness", "personal", "family"]);
export const goalHorizon = pgEnum("goal_horizon", ["6m", "1y", "5y", "10y", "20y", "custom"]);
export const goalStatus = pgEnum("goal_status", ["active", "achieved", "paused", "abandoned"]);

export const goals = pgTable(
  "goals",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    /** null = a family goal */
    ownerMemberId: uuid("owner_member_id").references(() => familyMembers.id, {
      onDelete: "cascade",
    }),
    kind: goalKind("kind").notNull(),
    horizon: goalHorizon("horizon").notNull().default("1y"),
    name: text("name").notNull(),
    description: text("description"),
    /** Savings goals use cents; other goals use target_value + unit. */
    targetCents: integer("target_cents"),
    currentCents: integer("current_cents").notNull().default(0),
    monthlyContributionCents: integer("monthly_contribution_cents"),
    targetValue: numeric("target_value"),
    currentValue: numeric("current_value"),
    unit: text("unit"),
    targetDate: date("target_date"),
    status: goalStatus("status").notNull().default("active"),
    visibility: visibility("visibility").notNull().default("family"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("goals_family_idx").on(t.familyId)],
);

export const goalMilestones = pgTable("goal_milestones", {
  id: id(),
  goalId: uuid("goal_id")
    .notNull()
    .references(() => goals.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  targetCents: integer("target_cents"),
  targetValue: numeric("target_value"),
  dueOn: date("due_on"),
  achievedAt: timestamp("achieved_at", { withTimezone: true }),
  position: integer("position").notNull().default(0),
});

export const goalContributions = pgTable(
  "goal_contributions",
  {
    id: id(),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    amountCents: integer("amount_cents"),
    value: numeric("value"),
    /** Linked finance transaction, when contribution came from the budget. */
    transactionId: uuid("transaction_id"),
    notes: text("notes"),
    memberId: uuid("member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("contributions_goal_idx").on(t.goalId, t.date)],
);

// ─── Fitness ─────────────────────────────────────────────────────────────────

export const fitnessPlans = pgTable(
  "fitness_plans",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    startsOn: date("starts_on"),
    endsOn: date("ends_on"),
    ...timestamps,
  },
  (t) => [index("fitness_plans_member_idx").on(t.memberId)],
);

/** A workout template within a plan, scheduled on weekdays via recurrence. */
export const workouts = pgTable("workouts", {
  id: id(),
  planId: uuid("plan_id")
    .notNull()
    .references(() => fitnessPlans.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // "Strength", "Cardio"
  focus: text("focus"),
  recurrenceRuleId: uuid("recurrence_rule_id").references(() => recurrenceRules.id, {
    onDelete: "set null",
  }),
  notes: text("notes"),
  position: integer("position").notNull().default(0),
  ...timestamps,
});

export const workoutExercises = pgTable("workout_exercises", {
  id: id(),
  workoutId: uuid("workout_id")
    .notNull()
    .references(() => workouts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sets: smallint("sets"),
  reps: smallint("reps"),
  durationSeconds: integer("duration_seconds"),
  distance: numeric("distance"),
  distanceUnit: text("distance_unit"),
  videoUrl: text("video_url"),
  notes: text("notes"),
  position: integer("position").notNull().default(0),
});

export const workoutLogs = pgTable(
  "workout_logs",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    workoutId: uuid("workout_id").references(() => workouts.id, { onDelete: "set null" }),
    date: date("date").notNull(),
    title: text("title").notNull(),
    durationMinutes: integer("duration_minutes"),
    distance: numeric("distance"),
    distanceUnit: text("distance_unit"),
    effort: smallint("effort"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("workout_logs_member_date_idx").on(t.memberId, t.date)],
);

export const workoutLogSets = pgTable("workout_log_sets", {
  id: id(),
  logId: uuid("log_id")
    .notNull()
    .references(() => workoutLogs.id, { onDelete: "cascade" }),
  exercise: text("exercise").notNull(),
  setNumber: smallint("set_number").notNull(),
  reps: smallint("reps"),
  weight: numeric("weight"),
  weightUnit: text("weight_unit"),
  durationSeconds: integer("duration_seconds"),
});

export const bodyMetrics = pgTable(
  "body_metrics",
  {
    id: id(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    metric: text("metric").notNull(), // weight, waist, resting_hr…
    value: numeric("value").notNull(),
    unit: text("unit").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("body_metrics_member_idx").on(t.memberId, t.metric, t.date)],
);

export const personalRecords = pgTable("personal_records", {
  id: id(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => familyMembers.id, { onDelete: "cascade" }),
  exercise: text("exercise").notNull(),
  value: numeric("value").notNull(),
  unit: text("unit").notNull(),
  achievedOn: date("achieved_on").notNull(),
  workoutLogId: uuid("workout_log_id").references(() => workoutLogs.id, {
    onDelete: "set null",
  }),
});
