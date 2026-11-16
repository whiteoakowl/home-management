/**
 * Pure permission rules, shared by the DAL and UI. No DB access here.
 * See docs/ARCHITECTURE.md §3.
 */
import { MODULES, type AccessLevel, type Module } from "@/db/schema/_shared";
import { MODULE_META } from "./modules";

export type Role = "parent" | "member";

/**
 * none: hidden · view: look only · use: check things off, mark done, log, earn
 * points (no adding or editing) · add: also create, and change what you added
 * (Family Pantry) · edit: create and change your own things anywhere.
 */
const RANK: Record<AccessLevel, number> = { none: 0, view: 1, use: 2, add: 3, edit: 4 };

/** Modules that offer the "Add" level (create, and change only what you added): the Family Pantry. */
export const ADD_LEVEL_MODULES: readonly Module[] = ["kitchen", "recipes", "meals", "shopping"];

export function atLeast(actual: AccessLevel, required: AccessLevel) {
  return RANK[actual] >= RANK[required];
}

export function defaultPermissions(role: Role): Record<Module, AccessLevel> {
  return Object.fromEntries(
    MODULES.map((m) => [m, role === "parent" ? "edit" : MODULE_META[m].defaultMemberAccess]),
  ) as Record<Module, AccessLevel>;
}

/**
 * Effective access for a member to a module:
 * disabled module → none; parent → edit; otherwise stored level or default.
 */
export function effectiveAccess(opts: {
  role: Role;
  module: Module;
  enabledModules: readonly string[];
  stored: Partial<Record<Module, AccessLevel>>;
}): AccessLevel {
  if (!opts.enabledModules.includes(opts.module)) return "none";
  if (opts.role === "parent") return "edit";
  const level = opts.stored[opts.module] ?? MODULE_META[opts.module].defaultMemberAccess;
  return level === "add" && !ADD_LEVEL_MODULES.includes(opts.module) ? "use" : level;
}
