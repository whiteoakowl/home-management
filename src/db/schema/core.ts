import {
  boolean,
  date,
  doublePrecision,
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
import { ACCESS_LEVELS, MODULES, VISIBILITIES, id, timestamps } from "./_shared";

export const memberRole = pgEnum("member_role", ["parent", "member"]);
export const accessLevel = pgEnum("access_level", ACCESS_LEVELS);
export const moduleEnum = pgEnum("app_module", MODULES);
export const visibility = pgEnum("visibility", VISIBILITIES);
export const categoryDomain = pgEnum("category_domain", [
  "chore",
  "calendar",
  "budget",
  "list",
  "garden",
  "farm",
  "recipe",
  "household",
  "inventory",
  "book",
]);
export const entityType = pgEnum("entity_type", [
  "event",
  "list",
  "journal_entry",
  "document",
  "goal",
  "household_info",
  "announcement",
  "medical",
  "pet",
  "craft_item",
  "book",
  "feed_order",
  "farm_plan",
  "garden_plan",
  "work_schedule",
  "plan",
]);

// ─── Identity ────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  /** When the person proved they own this email (verification or reset link). */
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  ...timestamps,
});

/**
 * One-time links sent by email: password reset (1 hour) and email
 * verification (3 days). Only a SHA-256 hash of the token is stored.
 */
export const authTokens = pgTable(
  "auth_tokens",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** reset | verify */
    kind: text("kind").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    /** For verify links: the address being confirmed. */
    email: text("email"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auth_tokens_user_idx").on(t.userId, t.kind)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// ─── Tenant ──────────────────────────────────────────────────────────────────

export type FamilyTheme = { accent?: string };
export type FamilySettings = {
  /** Automation switches (see src/lib/automation.ts AUTOMATIONS). Missing = on. */
  automations?: Record<string, boolean>;
  weekStartsOn?: 0 | 1;
  /** First day of the family meal planner's week (0 = Sunday … 6 = Saturday). */
  mealWeekStartsOn?: number;
  /** The family's own keyword-bank groups (words that mean the same grocery), on top of the built-in ones. */
  ingredientSynonyms?: string[][];
  /** Members' own meal-plan week starts, by member id. */
  privateMealWeekStartsOn?: Record<string, number>;
  /** ISO date the daily automation last ran for this family. */
  lastAutomationOn?: string;
  /** Parents may open members' private food spaces. Off unless a parent turns it on. */
  /** @deprecated Replaced by each member's own family_members.share_food_with_parents. */
  parentsSeePrivateFood?: boolean;
};

export const families = pgTable("families", {
  id: id(),
  name: text("name").notNull(),
  imageFileId: uuid("image_file_id"),
  timezone: text("timezone").notNull().default("America/New_York"),
  locationName: text("location_name"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  /** Set after the first member is created (circular FK kept app-level). */
  ownerMemberId: uuid("owner_member_id"),
  onboardingStep: integer("onboarding_step").notNull().default(1),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  enabledModules: text("enabled_modules")
    .array()
    .notNull()
    .default([...MODULES]),
  theme: jsonb("theme").$type<FamilyTheme>().notNull().default({}),
  settings: jsonb("settings").$type<FamilySettings>().notNull().default({}),
  ...timestamps,
});

export const familyMembers = pgTable(
  "family_members",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    displayName: text("display_name").notNull(),
    /** For parents: the name kids (and other non-parent members) see, e.g. "Dad" or "Mom". */
    kidName: text("kid_name"),
    role: memberRole("role").notNull().default("member"),
    color: text("color").notNull().default("plum"),
    avatarFileId: uuid("avatar_file_id"),
    /** Let parents see (not edit) my fitness & food journal. The member's own choice. */
    shareFitness: boolean("share_fitness").notNull().default(false),
    /** Has a private food space (My Pantry / Recipes / Meal Plans / Shopping List). Set by parents. */
    privateFood: boolean("private_food").notNull().default(false),
    /** Let parents open (read-only) my private food space. The member's own choice; off by default. */
    shareFoodWithParents: boolean("share_food_with_parents").notNull().default(false),
    /** Has a private money space (My Budget). Set by parents. Only the member ever sees it, never parents. */
    privateFinance: boolean("private_finance").notNull().default(false),
    /** Their own private Important Info (only they see it, never parents). On by default; parents can turn it off. */
    privateInfo: boolean("private_info").notNull().default(true),
    /** Their own private House Projects, for older kids with a home of their own. Set by parents; parents can't see it. */
    privateProjects: boolean("private_projects").notNull().default(false),
    /** Their own private Vehicles ("My Vehicles"), e.g. a teen's first car. Set by parents; parents can't see it. */
    privateVehicles: boolean("private_vehicles").notNull().default(false),
    /** Calendar categories this member chose to show (null = the default set). Kept until they change it. */
    calendarLayers: text("calendar_layers").array(),
    /** Event categories this member hid on the calendar ("none" = events without a category). */
    calendarHiddenCategories: text("calendar_hidden_categories").array(),
    /** Who sees this member's work schedule (selected people are in record_access as "work_schedule"). */
    workVisibility: visibility("work_visibility").notNull().default("family"),
    /**
     * Parent oversight for a minor: personal areas (privacy categories) parents may view
     * even if the member keeps them private. Set by parents; always shown to the member.
     */
    parentAccess: text("parent_access").array().notNull().default([]),
    /** My own app colour theme (a palette key; null = the family default). Only changes my app. */
    appTheme: text("app_theme"),
    /** Personal areas parents turned off for this profile ("period", "wellness"). Data is kept. */
    hiddenAreas: text("hidden_areas").array().notNull().default([]),
    birthday: date("birthday"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index("members_family_idx").on(t.familyId),
    uniqueIndex("members_family_user_uq").on(t.familyId, t.userId),
  ],
);

export const memberPermissions = pgTable(
  "member_permissions",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    module: moduleEnum("module").notNull(),
    level: accessLevel("level").notNull(),
  },
  (t) => [primaryKey({ columns: [t.memberId, t.module] })],
);

/** Explicit per-record sharing for records with visibility = 'selected'. */
export const recordAccess = pgTable(
  "record_access",
  {
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    entityType: entityType("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    canEdit: boolean("can_edit").notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.entityType, t.entityId, t.memberId] }),
    index("record_access_member_idx").on(t.memberId),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    domain: categoryDomain("domain").notNull(),
    name: text("name").notNull(),
    color: text("color"),
    icon: text("icon"),
    sortOrder: integer("sort_order").notNull().default(0),
    /** Set = a category in this member's private money space; null = the family's. */
    ownerMemberId: uuid("owner_member_id").references(() => familyMembers.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index("categories_family_domain_idx").on(t.familyId, t.domain)],
);

export const files = pgTable(
  "files",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    uploadedByMemberId: uuid("uploaded_by_member_id").references(() => familyMembers.id, {
      onDelete: "set null",
    }),
    storageKey: text("storage_key").notNull(),
    thumbnailKey: text("thumbnail_key"),
    originalName: text("original_name"),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    ...timestamps,
  },
  (t) => [index("files_family_idx").on(t.familyId)],
);

// ─── Dashboard, announcements, activity, notifications ───────────────────────

export type WidgetPref = { id: string; visible: boolean; size: "sm" | "md" | "lg" };

export const dashboardLayouts = pgTable("dashboard_layouts", {
  memberId: uuid("member_id")
    .primaryKey()
    .references(() => familyMembers.id, { onDelete: "cascade" }),
  widgets: jsonb("widgets").$type<WidgetPref[]>().notNull(),
  ...timestamps,
});

/** Per-member card layout for a section dashboard (Spiritual, Library, …). */
export const sectionLayouts = pgTable(
  "section_layouts",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    section: text("section").notNull(),
    widgets: jsonb("widgets").$type<WidgetPref[]>().notNull(),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.memberId, t.section] })],
);

export const announcements = pgTable(
  "announcements",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    authorMemberId: uuid("author_member_id").references(() => familyMembers.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    pinned: boolean("pinned").notNull().default(false),
    visibility: visibility("visibility").notNull().default("family"),
    expiresOn: date("expires_on"),
    ...timestamps,
  },
  (t) => [index("announcements_family_idx").on(t.familyId, t.createdAt)],
);

export const activityLog = pgTable(
  "activity_log",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    actorMemberId: uuid("actor_member_id").references(() => familyMembers.id, {
      onDelete: "set null",
    }),
    /** e.g. "chore.completed", "member.added", "harvest.recorded" */
    verb: text("verb").notNull(),
    module: moduleEnum("module"),
    entityId: uuid("entity_id"),
    /** Human summary rendered in the feed, e.g. 'completed "Clean Kitchen"'. */
    summary: text("summary").notNull(),
    /** Only shown to these modules' viewers; null = whole family. */
    visibleToMemberIds: uuid("visible_to_member_ids").array(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("activity_family_idx").on(t.familyId, t.createdAt)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    readAt: timestamp("read_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_member_idx").on(t.memberId, t.readAt)],
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    inApp: boolean("in_app").notNull().default(true),
    email: boolean("email").notNull().default(false),
    push: boolean("push").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.memberId, t.kind] })],
);

/**
 * Photo albums for things that don't have their own gallery table: farm animals,
 * garden plants and family member profiles. (Pets keep pet_photos.)
 */
export const entityPhotos = pgTable(
  "entity_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    /** animal | plant | member */
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    caption: text("caption"),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("entity_photos_entity_idx").on(t.entityType, t.entityId)],
);
