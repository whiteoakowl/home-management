import "server-only";
import { and, eq, inArray, isNull, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { familyMembers, type Module } from "@/db/schema";
import { AuthorizationError, type Viewer } from "./dal";

/**
 * Family Pantry spaces.
 *
 * Food records (pantry items, recipes, recipe collections, meal plans and
 * shopping lists) live either in the FAMILY space (owner_member_id NULL,
 * governed by the member's Family Pantry permissions) or in a member's
 * PRIVATE space (owner_member_id = that member). A private space is only
 * available when a parent has enabled it for the member, and it is visible to
 * that member alone, unless the family has turned on "parents can open private
 * food spaces", which gives parents read-only access. Nothing private is ever
 * shown in family views, search, dashboards, the calendar or automations.
 */
export type FoodSpace = { kind: "family" } | { kind: "private"; memberId: string; memberName: string; own: boolean };

export const FAMILY: FoodSpace = { kind: "family" };

/** Food modules → their names in the two spaces. */
export const FOOD_LABELS: Record<"kitchen" | "recipes" | "meals" | "shopping", { family: string; mine: string; href: string }> = {
  kitchen: { family: "Family Pantry", mine: "My Pantry", href: "/kitchen" },
  recipes: { family: "Family Recipes", mine: "My Recipes", href: "/recipes" },
  meals: { family: "Family Meal Plans", mine: "My Meal Plans", href: "/meals" },
  shopping: { family: "Family Shopping", mine: "My Shopping List", href: "/shopping" },
};

export const hasPrivateFood = (viewer: Viewer) => viewer.member.privateFood;
/** May this parent open (read-only) that member's private food space? Only if the member chose to share it. */
export const canPeekFood = (viewer: Viewer, ownerMemberId: string) => viewer.isParent && viewer.sharedFoodOwners.includes(ownerMemberId);

/**
 * Resolve the `?space=` search param: "mine" (own private space), a member id
 * (a parent opening a member's space, when that member shares it), or the
 * family space. Anything not allowed falls back to the family space.
 */
export async function resolveSpace(viewer: Viewer, raw: unknown): Promise<FoodSpace> {
  if (raw === "mine" && hasPrivateFood(viewer)) return { kind: "private", memberId: viewer.member.id, memberName: viewer.member.displayName, own: true };
  if (typeof raw === "string" && /^[0-9a-f-]{36}$/i.test(raw)) {
    if (raw === viewer.member.id && hasPrivateFood(viewer)) return { kind: "private", memberId: raw, memberName: viewer.member.displayName, own: true };
    if (canPeekFood(viewer, raw)) {
      const [m] = await db
        .select({ id: familyMembers.id, name: familyMembers.displayName, privateFood: familyMembers.privateFood })
        .from(familyMembers)
        .where(and(eq(familyMembers.id, raw), eq(familyMembers.familyId, viewer.family.id)));
      if (m?.privateFood) return { kind: "private", memberId: m.id, memberName: m.name, own: false };
    }
  }
  return FAMILY;
}

/** Rows in the given space. */
export function inSpace(owner: PgColumn, space: FoodSpace): SQL {
  return space.kind === "family" ? isNull(owner) : eq(owner, space.memberId);
}

/** Family-space rows only: use in every shared view (dashboards, search, calendar, automation). */
export const familyFood = (owner: PgColumn) => isNull(owner);

/** May the viewer open this space for this module at all? */
export function canViewSpace(viewer: Viewer, module: Module, space: FoodSpace) {
  return space.kind === "family" ? viewer.can(module, "view") : true; // resolveSpace already checked private access
}

/** May the viewer add new records in this space? */
export function canAddIn(viewer: Viewer, module: Module, space: FoodSpace) {
  return space.kind === "family" ? viewer.can(module, "add") : space.own;
}

/**
 * May the viewer change or delete this record? Own private records: always.
 * Someone else's private records: never (parents' access is read-only).
 * Family records: Edit access, or Add access for records they added.
 */
export function canChange(viewer: Viewer, module: Module, row: { ownerMemberId: string | null; createdByMemberId?: string | null }) {
  if (row.ownerMemberId) return row.ownerMemberId === viewer.member.id;
  if (viewer.can(module, "edit")) return true;
  return viewer.can(module, "add") && !!row.createdByMemberId && row.createdByMemberId === viewer.member.id;
}

export function assertChange(viewer: Viewer, module: Module, row: { ownerMemberId: string | null; createdByMemberId?: string | null }) {
  if (!canChange(viewer, module, row)) throw new AuthorizationError("You can view this but not change it.");
}

/** Owner to store on a new record, from the form's `space` field. Throws when not allowed. */
export function ownerForNew(viewer: Viewer, module: Module, fd: FormData): string | null {
  if (fd.get("space") === "mine") {
    if (!hasPrivateFood(viewer)) throw new AuthorizationError("Your private food space isn't turned on. Ask a parent.");
    return viewer.member.id;
  }
  if (!viewer.can(module, "add")) throw new AuthorizationError("You can't add to the family's food yet. Ask a parent for Add access.");
  return null;
}

/** Can the viewer reach the food page at all (family access or their own private space)? */
export const canOpenFood = (viewer: Viewer, module: Module) => viewer.can(module) || hasPrivateFood(viewer);

/** Query-string for links that should stay in the current space. */
export const spaceParam = (space: FoodSpace) => (space.kind === "family" ? "" : space.own ? "space=mine" : `space=${space.memberId}`);
export const withSpace = (href: string, space: FoodSpace) => {
  const p = spaceParam(space);
  return p ? `${href}${href.includes("?") ? "&" : "?"}${p}` : href;
};

/** Members whose private spaces a parent may open (those who chose to share with parents). */
export async function privateSpaceMembers(viewer: Viewer) {
  if (!viewer.sharedFoodOwners.length) return [];
  return db
    .select({ id: familyMembers.id, displayName: familyMembers.displayName })
    .from(familyMembers)
    .where(and(eq(familyMembers.familyId, viewer.family.id), inArray(familyMembers.id, viewer.sharedFoodOwners)));
}

/** May the viewer read a record in this owner's space? (family: module access; private: owner, or parent when allowed) */
export function canReadOwned(viewer: Viewer, module: Module, ownerMemberId: string | null) {
  if (!ownerMemberId) return viewer.can(module);
  return ownerMemberId === viewer.member.id || canPeekFood(viewer, ownerMemberId);
}
