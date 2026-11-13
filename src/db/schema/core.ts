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
]);

// ─── Identity ────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  ...timestamps,
});

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
  /** ISO date the daily automation last ran for this family. */
  lastAutomationOn?: string;
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
    role: memberRole("role").notNull().default("member"),
    color: text("color").notNull().default("plum"),
    avatarFileId: uuid("avatar_file_id"),
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
