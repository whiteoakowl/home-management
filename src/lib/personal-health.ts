import "server-only";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { periodDays, personalHealthProfiles } from "@/db/schema";
import { AuthorizationError, getFamilyMember, type Viewer } from "./dal";
import { canManagePersonal } from "./privacy";

export type HealthProfile = typeof personalHealthProfiles.$inferSelect;

/** A member's personal-health preferences (created with defaults on first use). */
export async function healthProfile(familyId: string, memberId: string): Promise<HealthProfile> {
  const [row] = await db.select().from(personalHealthProfiles).where(eq(personalHealthProfiles.memberId, memberId));
  if (row) return row;
  const [created] = await db.insert(personalHealthProfiles).values({ memberId, familyId }).onConflictDoNothing().returning();
  return created ?? (await db.select().from(personalHealthProfiles).where(eq(personalHealthProfiles.memberId, memberId)))[0]!;
}

export async function periodDaysFor(memberId: string, from?: string, to?: string) {
  return db
    .select()
    .from(periodDays)
    .where(and(eq(periodDays.memberId, memberId), from ? gte(periodDays.date, from) : undefined, to ? lte(periodDays.date, to) : undefined))
    .orderBy(asc(periodDays.date));
}

/** The member whose personal health is being changed: yourself, or a member without a login (by a parent). */
export async function managedMember(viewer: Viewer, raw: FormDataEntryValue | null) {
  const id = typeof raw === "string" && raw ? raw : viewer.member.id;
  if (id === viewer.member.id) return viewer.member;
  const m = await getFamilyMember(viewer, id);
  if (!m || !canManagePersonal(viewer, m)) throw new AuthorizationError("Only they can change their own records.");
  return m;
}
