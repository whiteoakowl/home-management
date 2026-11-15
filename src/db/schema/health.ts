import { boolean, date, index, integer, jsonb, numeric, pgTable, primaryKey, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { families, familyMembers, files } from "./core";
import { inventoryItems } from "./kitchen";

/**
 * Personal spaces: period tracker, personal food journal, mental wellness and the
 * Privacy Center. Every row belongs to one family member and is private to them
 * unless their privacy settings (or parent oversight for a minor) say otherwise.
 * See docs/ARCHITECTURE.md §3 "Personal privacy".
 */

/** Areas each person controls in the Privacy Center. */
export const PRIVACY_CATEGORIES = ["period", "food", "wellness", "fitness", "journal", "goals", "medical"] as const;
export type PrivacyCategory = (typeof PRIVACY_CATEGORIES)[number];
export type PrivacyAudience = "private" | "parents" | "selected";

/** Who may see one person's area. One row per member per category; missing = private. */
export const privacySettings = pgTable(
  "privacy_settings",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    category: text("category").notNull().$type<PrivacyCategory>(),
    audience: text("audience").notNull().default("private").$type<PrivacyAudience>(),
    /** For audience 'selected'. */
    memberIds: uuid("member_ids").array().notNull().default([]),
    /** Category extras, e.g. period { showOnCalendar }, wellness { shareMood, shareJournal }. */
    options: jsonb("options").$type<Record<string, boolean>>().notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.memberId, t.category] }), index("privacy_settings_family_idx").on(t.familyId)],
);

export type ReminderFrequency = "off" | "daily" | "weekdays" | "weekly";
export type WellnessReminders = Partial<Record<"checkIn" | "journal" | "gratitude" | "selfCare" | "goals" | "period", ReminderFrequency>>;

/** One per member: personal-health preferences (custom symptoms/feelings, typical cycle, reminders). */
export const personalHealthProfiles = pgTable("personal_health_profiles", {
  memberId: uuid("member_id")
    .primaryKey()
    .references(() => familyMembers.id, { onDelete: "cascade" }),
  familyId: uuid("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  periodEnabled: boolean("period_enabled").notNull().default(false),
  /** Used for predictions until enough cycles are recorded. */
  typicalCycleLength: smallint("typical_cycle_length").notNull().default(28),
  typicalPeriodLength: smallint("typical_period_length").notNull().default(5),
  customSymptoms: text("custom_symptoms").array().notNull().default([]),
  customFeelings: text("custom_feelings").array().notNull().default([]),
  customSelfCare: text("custom_self_care").array().notNull().default([]),
  reminders: jsonb("reminders").$type<WellnessReminders>().notNull().default({}),
  ...timestamps,
});

/** Period tracker: one row per day the person recorded something. Cycles are derived from flow days. */
export const periodDays = pgTable(
  "period_days",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    /** none | spotting | light | medium | heavy (null = not recorded). */
    flow: text("flow"),
    symptoms: text("symptoms").array().notNull().default([]),
    feelings: text("feelings").array().notNull().default([]),
    /** 1 low · 2 medium · 3 high */
    moodIntensity: smallint("mood_intensity"),
    note: text("note"),
    ...timestamps,
  },
  (t) => [uniqueIndex("period_days_member_date_idx").on(t.memberId, t.date)],
);

/** Mental wellness: one check-in per person per day. */
export const wellnessCheckIns = pgTable(
  "wellness_check_ins",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    /** great | good | okay | low | rough */
    mood: text("mood"),
    feelings: text("feelings").array().notNull().default([]),
    /** low | medium | high */
    intensity: text("intensity"),
    selfCare: text("self_care").array().notNull().default([]),
    note: text("note"),
    /** "Share today's mood": visible to the person's wellness audience. */
    shared: boolean("shared").notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex("wellness_check_ins_member_date_idx").on(t.memberId, t.date)],
);

/** Gentle personal habits ("Journal 3 times this week"). Progress comes from check-ins and journal entries. */
export const wellnessGoals = pgTable(
  "wellness_goals",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** journal | gratitude | check_in | self_care | custom */
    kind: text("kind").notNull().default("custom"),
    /** For kind self_care: which activity counts. */
    selfCareKey: text("self_care_key"),
    timesPerWeek: smallint("times_per_week").notNull().default(3),
    shared: boolean("shared").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("wellness_goals_member_idx").on(t.memberId)],
);

/** Days a custom wellness goal was done (other kinds are counted from activity). */
export const wellnessGoalMarks = pgTable(
  "wellness_goal_marks",
  {
    goalId: uuid("goal_id")
      .notNull()
      .references(() => wellnessGoals.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
  },
  (t) => [primaryKey({ columns: [t.goalId, t.date] })],
);

/** Saved / favourite daily quotes (quotes themselves live in src/lib/quotes.ts). */
export const quoteFavorites = pgTable(
  "quote_favorites",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    quoteId: text("quote_id").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.memberId, t.quoteId] })],
);

/** Imported grocery receipts (kept when the person chooses to save them). */
export const groceryReceipts = pgTable(
  "grocery_receipts",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    /** NULL = family receipt; set = in that member's private food space. */
    ownerMemberId: uuid("owner_member_id").references(() => familyMembers.id, { onDelete: "cascade" }),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    store: text("store"),
    date: date("date"),
    totalCents: integer("total_cents"),
    imageFileId: uuid("image_file_id").references(() => files.id, { onDelete: "set null" }),
    notes: text("notes"),
    /** Budget expense created from this receipt, if any. */
    transactionId: uuid("transaction_id"),
    ...timestamps,
  },
  (t) => [index("grocery_receipts_family_idx").on(t.familyId, t.date)],
);

export const groceryReceiptItems = pgTable(
  "grocery_receipt_items",
  {
    id: id(),
    receiptId: uuid("receipt_id")
      .notNull()
      .references(() => groceryReceipts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    quantity: numeric("quantity"),
    unit: text("unit"),
    priceCents: integer("price_cents"),
    category: text("category"),
    location: text("location"),
    expiresOn: date("expires_on"),
    addedToPantry: boolean("added_to_pantry").notNull().default(false),
    inventoryItemId: uuid("inventory_item_id").references(() => inventoryItems.id, { onDelete: "set null" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("grocery_receipt_items_receipt_idx").on(t.receiptId)],
);
