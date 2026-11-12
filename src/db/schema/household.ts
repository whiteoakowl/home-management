import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { categories, families, familyMembers, files, visibility } from "./core";

export const recurrenceFreq = pgEnum("recurrence_freq", [
  "daily",
  "weekly",
  "monthly",
  "yearly",
]);
export const priority = pgEnum("priority", ["low", "normal", "high"]);
export const choreKind = pgEnum("chore_kind", ["chore", "cleaning", "maintenance", "task"]);
export const cleaningCadence = pgEnum("cleaning_cadence", [
  "daily",
  "weekly",
  "monthly",
  "seasonal",
  "biannual",
  "annual",
  "custom",
]);
export const occurrenceStatus = pgEnum("occurrence_status", [
  "pending",
  "done",
  "skipped",
  "missed",
]);

/**
 * Shared recurrence definition (RFC 5545-lite). Referenced by chores, events,
 * workouts and recurring transactions so there is a single materialiser.
 */
export const recurrenceRules = pgTable("recurrence_rules", {
  id: id(),
  familyId: uuid("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  freq: recurrenceFreq("freq").notNull(),
  interval: smallint("interval").notNull().default(1),
  /** 0 = Sunday … 6 = Saturday */
  byWeekday: smallint("by_weekday").array(),
  byMonthDay: smallint("by_month_day").array(),
  byMonth: smallint("by_month").array(),
  startsOn: date("starts_on").notNull(),
  until: date("until"),
  count: integer("count"),
  enabled: boolean("enabled").notNull().default(true),
  ...timestamps,
});

export const rooms = pgTable(
  "rooms",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    icon: text("icon"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("rooms_family_idx").on(t.familyId)],
);

/** Template for chores, cleaning tasks, maintenance and one-off tasks. */
export const chores = pgTable(
  "chores",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    kind: choreKind("kind").notNull().default("chore"),
    title: text("title").notNull(),
    description: text("description"),
    instructions: text("instructions"),
    roomId: uuid("room_id").references(() => rooms.id, { onDelete: "set null" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    cleaningCadence: cleaningCadence("cleaning_cadence"),
    priority: priority("priority").notNull().default("normal"),
    estimatedMinutes: integer("estimated_minutes"),
    defaultAssigneeId: uuid("default_assignee_id").references(() => familyMembers.id, {
      onDelete: "set null",
    }),
    recurrenceRuleId: uuid("recurrence_rule_id").references(() => recurrenceRules.id, {
      onDelete: "set null",
    }),
    /** For one-off tasks without recurrence. */
    dueDate: date("due_date"),
    notes: text("notes"),
    points: integer("points"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [index("chores_family_kind_idx").on(t.familyId, t.kind)],
);

export const choreChecklistItems = pgTable(
  "chore_checklist_items",
  {
    id: id(),
    choreId: uuid("chore_id")
      .notNull()
      .references(() => chores.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    assigneeId: uuid("assignee_id").references(() => familyMembers.id, {
      onDelete: "set null",
    }),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("chore_items_chore_idx").on(t.choreId)],
);

/** Concrete, dated instance of a chore. Completion history lives here. */
export const choreOccurrences = pgTable(
  "chore_occurrences",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    choreId: uuid("chore_id")
      .notNull()
      .references(() => chores.id, { onDelete: "cascade" }),
    dueDate: date("due_date").notNull(),
    assigneeId: uuid("assignee_id").references(() => familyMembers.id, {
      onDelete: "set null",
    }),
    status: occurrenceStatus("status").notNull().default("pending"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedByMemberId: uuid("completed_by_member_id").references(() => familyMembers.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("occurrence_chore_date_uq").on(t.choreId, t.dueDate),
    index("occurrence_family_due_idx").on(t.familyId, t.dueDate),
    index("occurrence_assignee_idx").on(t.assigneeId, t.status),
  ],
);

export const choreOccurrenceItems = pgTable(
  "chore_occurrence_items",
  {
    id: id(),
    occurrenceId: uuid("occurrence_id")
      .notNull()
      .references(() => choreOccurrences.id, { onDelete: "cascade" }),
    checklistItemId: uuid("checklist_item_id").references(() => choreChecklistItems.id, {
      onDelete: "set null",
    }),
    text: text("text").notNull(),
    assigneeId: uuid("assignee_id").references(() => familyMembers.id, {
      onDelete: "set null",
    }),
    position: integer("position").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedByMemberId: uuid("completed_by_member_id").references(() => familyMembers.id, {
      onDelete: "set null",
    }),
  },
  (t) => [index("occ_items_occurrence_idx").on(t.occurrenceId)],
);

export const homeProjects = pgTable(
  "home_projects",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("planned"),
    roomId: uuid("room_id").references(() => rooms.id, { onDelete: "set null" }),
    budgetCents: integer("budget_cents"),
    startDate: date("start_date"),
    targetDate: date("target_date"),
    ownerMemberId: uuid("owner_member_id").references(() => familyMembers.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [index("projects_family_idx").on(t.familyId)],
);

export const homeDocuments = pgTable(
  "home_documents",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    fileId: uuid("file_id").references(() => files.id, { onDelete: "set null" }),
    notes: text("notes"),
    expiresOn: date("expires_on"),
    visibility: visibility("visibility").notNull().default("family"),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [index("documents_family_idx").on(t.familyId)],
);

/** Important household info: wifi password, alarm code, contractor numbers… */
export const householdInfo = pgTable(
  "household_info",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    visibility: visibility("visibility").notNull().default("family"),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [index("household_info_family_idx").on(t.familyId)],
);
