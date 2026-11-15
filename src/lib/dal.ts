import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { and, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  families,
  familyMembers,
  memberPermissions,
  recordAccess,
  type AccessLevel,
  type Module,
  MODULES,
} from "@/db/schema";
import { readSessionUser } from "./auth/session";
import { atLeast, effectiveAccess } from "./permissions";

export type Family = typeof families.$inferSelect;
export type Member = typeof familyMembers.$inferSelect;

export type Viewer = {
  user: NonNullable<Awaited<ReturnType<typeof readSessionUser>>>;
  member: Member;
  family: Family;
  isParent: boolean;
  isOwner: boolean;
  access: Record<Module, AccessLevel>;
  can: (module: Module, level?: AccessLevel) => boolean;
  /** Parents: members who chose to let parents see their private food space. */
  sharedFoodOwners: string[];
};

/** Signed-in user, or redirect to /login. Does not require a family. */
export const requireUser = cache(async () => {
  const user = await readSessionUser();
  if (!user) redirect("/login");
  return user;
});

/** User + their membership (may be null before onboarding step 1). */
export const getMembership = cache(async () => {
  const user = await requireUser();
  const [row] = await db
    .select({ member: familyMembers, family: families })
    .from(familyMembers)
    .innerJoin(families, eq(families.id, familyMembers.familyId))
    .where(and(eq(familyMembers.userId, user.id), eq(familyMembers.isActive, true)))
    .limit(1);
  return { user, member: row?.member ?? null, family: row?.family ?? null };
});

/**
 * The fully-resolved viewer for app pages and actions.
 * Redirects to onboarding until the family is set up.
 */
export const getViewer = cache(async (opts?: { allowOnboarding?: boolean }): Promise<Viewer> => {
  const { user, member, family } = await getMembership();
  if (!member || !family) redirect("/onboarding");
  if (!family.onboardingCompletedAt && !opts?.allowOnboarding) redirect("/onboarding");

  const stored = await db
    .select()
    .from(memberPermissions)
    .where(eq(memberPermissions.memberId, member.id));
  const storedMap = Object.fromEntries(stored.map((p) => [p.module, p.level]));
  const access = Object.fromEntries(
    MODULES.map((m) => [
      m,
      effectiveAccess({ role: member.role, module: m, enabledModules: family.enabledModules, stored: storedMap }),
    ]),
  ) as Record<Module, AccessLevel>;

  const sharedFoodOwners =
    member.role === "parent"
      ? (
          await db
            .select({ id: familyMembers.id })
            .from(familyMembers)
            .where(and(eq(familyMembers.familyId, family.id), eq(familyMembers.isActive, true), eq(familyMembers.privateFood, true), eq(familyMembers.shareFoodWithParents, true)))
        )
          .map((r) => r.id)
          .filter((id) => id !== member.id)
      : [];

  return {
    user,
    member,
    family,
    sharedFoodOwners,
    isParent: member.role === "parent",
    isOwner: family.ownerMemberId === member.id,
    access,
    can: (module, level = "view") => atLeast(access[module], level),
  };
});

export class AuthorizationError extends Error {
  readonly userFacing = true;
}

export async function requireParent() {
  const viewer = await getViewer({ allowOnboarding: true });
  if (!viewer.isParent) throw new AuthorizationError("Only parents can do that.");
  return viewer;
}

export async function requireModule(module: Module, level: AccessLevel = "view") {
  const viewer = await getViewer();
  if (!viewer.can(module, level)) throw new AuthorizationError("You don't have access to that.");
  return viewer;
}

/** Load a member and assert they belong to the viewer's family. */
export async function getFamilyMember(viewer: Viewer, memberId: string) {
  const [m] = await db
    .select()
    .from(familyMembers)
    .where(and(eq(familyMembers.id, memberId), eq(familyMembers.familyId, viewer.family.id)))
    .limit(1);
  return m ?? null;
}

export async function listFamilyMembers(familyId: string) {
  return db
    .select()
    .from(familyMembers)
    .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.isActive, true)))
    .orderBy(sql`case when ${familyMembers.role} = 'parent' then 0 else 1 end`, familyMembers.createdAt);
}

/**
 * SQL filter implementing record visibility (§3 layer 3) for any table with
 * `visibility`, an author column and an id. Parents get no special access: what
 * each person sees is what the creator chose.
 *   family   → everyone (with module access)
 *   selected → the creator and the people they picked (parents only if picked)
 *   parents  → the creator and parents ("Parents & me")
 *   private  → the creator only ("Only me")
 * Anyone listed in record_access for the record can see it, whatever the visibility.
 */
export function visibleTo(
  viewer: Viewer,
  t: { id: PgColumn; visibility: PgColumn; author: PgColumn | null },
  entityType: (typeof recordAccess.$inferSelect)["entityType"],
): SQL {
  const own = t.author ? eq(t.author, viewer.member.id) : sql`false`;
  const shared = inArray(
    t.id,
    db
      .select({ id: recordAccess.entityId })
      .from(recordAccess)
      .where(and(eq(recordAccess.entityType, entityType), eq(recordAccess.memberId, viewer.member.id))),
  );
  return or(
    sql`${t.visibility} = 'family'`,
    own,
    viewer.isParent ? sql`${t.visibility} = 'parents'` : sql`false`,
    shared,
  )!;
}

/** True when a record is someone else's "Only me" record: nobody else may open or change it, parents included. */
export function isOthersPrivate(viewer: Viewer, r: { visibility: string; author: string | null }) {
  return r.visibility === "private" && r.author !== viewer.member.id;
}

/**
 * Who may change or delete a shared record (list, event, note, document, book, recipe…):
 * parents, and whoever created it. "Add & edit" lets a member add things and change
 * their own; it never lets them change what someone else added.
 */
export function canChangeItem(viewer: Viewer, createdBy: string | null | undefined) {
  return viewer.isParent || (!!createdBy && createdBy === viewer.member.id);
}

export function assertCanChange(viewer: Viewer, createdBy: string | null | undefined, what = "this") {
  if (!canChangeItem(viewer, createdBy)) throw new AuthorizationError(`Only the person who added ${what} (or a parent) can change it.`);
}
