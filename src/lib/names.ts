import "server-only";
import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { Viewer } from "./dal";

/**
 * Parents can choose the name kids see ("Dad", "Mom"). Parents always see real
 * names; kids and other non-parent members see the chosen one. Applied where
 * names are loaded, so every page shows the same thing.
 */
type Named = { id: string; role: string; displayName: string; kidName?: string | null };

export const seesKidNames = (viewer: Viewer) => !viewer.isParent;

/** The name this viewer should see for a member. */
export function nameFor<T extends Named>(viewer: Viewer, m: T): string {
  if (seesKidNames(viewer) && m.role === "parent" && m.kidName?.trim() && m.id !== viewer.member.id) return m.kidName.trim();
  return m.displayName;
}

/** The same rule for a list of members (keeps every other field). */
export function withViewerNames<T extends Named>(viewer: Viewer, members: T[]): T[] {
  if (!seesKidNames(viewer)) return members;
  return members.map((m) => ({ ...m, displayName: nameFor(viewer, m) }));
}

/** The same rule inside a query, for a family_members table (or an alias of it). */
export function memberNameSql(viewer: Viewer, t: { id: AnyPgColumn; role: AnyPgColumn; displayName: AnyPgColumn; kidName: AnyPgColumn }) {
  if (!seesKidNames(viewer)) return sql<string>`${t.displayName}`;
  return sql<string>`case when ${t.role} = 'parent' and nullif(trim(${t.kidName}), '') is not null and ${t.id} <> ${viewer.member.id} then trim(${t.kidName}) else ${t.displayName} end`;
}

/** For raw SQL on a family_members row aliased as `alias` (e.g. "fm"). */
export function memberNameRaw(viewer: Viewer, alias: string) {
  if (!seesKidNames(viewer)) return sql.raw(`${alias}.display_name`);
  return sql`case when ${sql.raw(alias)}.role = 'parent' and nullif(trim(${sql.raw(alias)}.kid_name), '') is not null and ${sql.raw(alias)}.id <> ${viewer.member.id} then trim(${sql.raw(alias)}.kid_name) else ${sql.raw(alias)}.display_name end`;
}

/** The family's members with names as this viewer should see them. */
export async function familyMembersFor(viewer: Viewer) {
  const { listFamilyMembers } = await import("./dal");
  return withViewerNames(viewer, await listFamilyMembers(viewer.family.id));
}
