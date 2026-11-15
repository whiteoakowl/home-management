import { timestamp, uuid } from "drizzle-orm/pg-core";

/** Standard UUID primary key. */
export const id = () => uuid("id").primaryKey().defaultRandom();

/** created_at / updated_at pair used by every table. */
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/**
 * Every app module. Used for nav, per-member permissions, enabled modules,
 * dashboard widgets and search scopes.
 */
export const MODULES = [
  "calendar",
  "house",
  "cleaning",
  "projects",
  "info",
  "chores",
  "lists",
  "kitchen",
  "meals",
  "recipes",
  "shopping",
  "garden",
  "farm",
  "journal",
  "goals",
  "fitness",
  "budget",
  "reports",
  "medical",
  "pets",
  "witchcraft",
  "maintenance",
  "library",
] as const;
export type Module = (typeof MODULES)[number];

/** "add" (create, and change only what you added) is offered for the Family Pantry modules. */
export const ACCESS_LEVELS = ["none", "view", "add", "edit"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

/**
 * family = everyone with module access · selected = listed people (+ parents) ·
 * parents = parents only (+ the creator) · private = only the creator.
 */
export const VISIBILITIES = ["family", "private", "selected", "parents"] as const;
export type Visibility = (typeof VISIBILITIES)[number];
