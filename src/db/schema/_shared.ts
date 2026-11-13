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
] as const;
export type Module = (typeof MODULES)[number];

export const ACCESS_LEVELS = ["none", "view", "edit"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const VISIBILITIES = ["family", "private", "selected"] as const;
export type Visibility = (typeof VISIBILITIES)[number];
