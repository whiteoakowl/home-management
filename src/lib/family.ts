import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  activityLog,
  families,
  familyMembers,
  memberPermissions,
  users,
  MODULES,
  type AccessLevel,
  type Module,
} from "@/db/schema";
import { hashPassword } from "./auth/session";
import { nextMemberColor } from "./colors";
import { defaultPermissions, type Role } from "./permissions";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function createFamilyForUser(opts: {
  userId: string;
  userName: string;
  familyName: string;
  timezone: string;
  locationName?: string | null;
}) {
  return db.transaction(async (tx) => {
    const [family] = await tx
      .insert(families)
      .values({
        name: opts.familyName,
        timezone: opts.timezone,
        locationName: opts.locationName || null,
        onboardingStep: 2,
      })
      .returning();
    const [member] = await tx
      .insert(familyMembers)
      .values({ familyId: family!.id, userId: opts.userId, displayName: opts.userName, role: "parent", color: "plum" })
      .returning();
    await tx.update(families).set({ ownerMemberId: member!.id }).where(eq(families.id, family!.id));
    await logActivity(tx, family!.id, member!.id, "family.created", `created the ${opts.familyName} family`);
    return { family: family!, member: member! };
  });
}

export class MemberError extends Error {}

export async function addMember(opts: {
  familyId: string;
  actorMemberId: string;
  displayName: string;
  role: Role;
  color?: string;
  birthday?: string | null;
  login?: { email: string; password: string } | null;
}) {
  return db.transaction(async (tx) => {
    let userId: string | null = null;
    if (opts.login) {
      const existing = await tx.select({ id: users.id }).from(users).where(eq(users.email, opts.login.email)).limit(1);
      if (existing.length) throw new MemberError("That email already has a Vanderbilt Family account.");
      const [u] = await tx
        .insert(users)
        .values({ email: opts.login.email, name: opts.displayName, passwordHash: await hashPassword(opts.login.password) })
        .returning({ id: users.id });
      userId = u!.id;
    }
    const used = await tx.select({ color: familyMembers.color }).from(familyMembers).where(eq(familyMembers.familyId, opts.familyId));
    const [member] = await tx
      .insert(familyMembers)
      .values({
        familyId: opts.familyId,
        userId,
        displayName: opts.displayName,
        role: opts.role,
        color: opts.color || nextMemberColor(used.map((u) => u.color)),
        birthday: opts.birthday || null,
      })
      .returning();
    await writePermissions(tx, member!.id, defaultPermissions(opts.role));
    await logActivity(tx, opts.familyId, opts.actorMemberId, "member.added", `added ${opts.displayName} to the family`);
    return member!;
  });
}

export async function grantLogin(opts: { familyId: string; memberId: string; email: string; password: string }) {
  return db.transaction(async (tx) => {
    const existing = await tx.select({ id: users.id }).from(users).where(eq(users.email, opts.email)).limit(1);
    if (existing.length) throw new MemberError("That email already has a Vanderbilt Family account.");
    const [m] = await tx
      .select()
      .from(familyMembers)
      .where(and(eq(familyMembers.id, opts.memberId), eq(familyMembers.familyId, opts.familyId)));
    if (!m) throw new MemberError("Member not found.");
    if (m.userId) throw new MemberError(`${m.displayName} already has a login.`);
    const [u] = await tx
      .insert(users)
      .values({ email: opts.email, name: m.displayName, passwordHash: await hashPassword(opts.password) })
      .returning({ id: users.id });
    await tx.update(familyMembers).set({ userId: u!.id }).where(eq(familyMembers.id, m.id));
  });
}

async function writePermissions(tx: Tx, memberId: string, perms: Partial<Record<Module, AccessLevel>>) {
  const rows = MODULES.filter((m) => perms[m]).map((m) => ({ memberId, module: m, level: perms[m]! }));
  await tx.delete(memberPermissions).where(eq(memberPermissions.memberId, memberId));
  if (rows.length) await tx.insert(memberPermissions).values(rows);
}

export async function setMemberPermissions(memberId: string, perms: Partial<Record<Module, AccessLevel>>) {
  await db.transaction((tx) => writePermissions(tx, memberId, perms));
}

export async function getStoredPermissions(memberIds: string[]) {
  if (!memberIds.length) return new Map<string, Partial<Record<Module, AccessLevel>>>();
  const rows = await db.select().from(memberPermissions).where(inArray(memberPermissions.memberId, memberIds));
  const map = new Map<string, Partial<Record<Module, AccessLevel>>>();
  for (const r of rows) {
    const entry = map.get(r.memberId) ?? {};
    entry[r.module] = r.level;
    map.set(r.memberId, entry);
  }
  return map;
}

export async function logActivity(
  tx: Tx | typeof db,
  familyId: string,
  actorMemberId: string | null,
  verb: string,
  summary: string,
  extra: { module?: Module; entityId?: string } = {},
) {
  await tx.insert(activityLog).values({ familyId, actorMemberId, verb, summary, ...extra });
}
