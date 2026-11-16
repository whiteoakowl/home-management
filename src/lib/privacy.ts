import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { familyMembers, privacySettings, type PrivacyAudience, type PrivacyCategory } from "@/db/schema";
import type { Viewer } from "./dal";
import { todayIn } from "./dates";

/**
 * Personal privacy (Privacy Center). Every person decides who can see each of their
 * personal areas: Private (default), Share with parents, or Share with selected people.
 * Two extra rules, both visible to the person:
 *  - Family members without a login (young kids) are managed by parents.
 *  - Parent oversight: for a minor, parents may turn on access to chosen areas
 *    (family_members.parent_access). The member sees this in their Privacy Center.
 * See docs/ARCHITECTURE.md §3 "Personal privacy".
 */
export const PRIVACY_META: Record<PrivacyCategory, { label: string; description: string; href: string; perEntry?: boolean }> = {
  period: { label: "Period Tracker", description: "Your cycle, flow, symptoms and notes.", href: "/health/period" },
  food: { label: "Food Journal", description: "What you eat and drink, and how you felt.", href: "/health/food" },
  wellness: { label: "Mental Wellness", description: "Check-ins, moods, wellness journal and goals. You choose each item you share.", href: "/wellness" },
  fitness: { label: "Fitness", description: "Workouts, measurements and records.", href: "/fitness" },
  journal: { label: "Journal", description: "Default for new journal entries. Each entry can still be changed.", href: "/journal", perEntry: true },
  goals: { label: "Goals", description: "Default for new goals. Each goal can still be changed.", href: "/goals", perEntry: true },
  medical: { label: "Medical Information", description: "Default for new medical records about you. Each record can still be changed.", href: "/medical", perEntry: true },
};

export type PrivacySetting = { category: PrivacyCategory; audience: PrivacyAudience; memberIds: string[]; options: Record<string, boolean> };
export type PersonalOwner = { id: string; userId: string | null; role: string; birthday: string | null; parentAccess: string[] };

const PRIVATE = (category: PrivacyCategory): PrivacySetting => ({ category, audience: "private", memberIds: [], options: {} });

export async function privacyFor(memberId: string, category: PrivacyCategory): Promise<PrivacySetting> {
  const [row] = await db.select().from(privacySettings).where(and(eq(privacySettings.memberId, memberId), eq(privacySettings.category, category)));
  return row ? { category, audience: row.audience, memberIds: row.memberIds, options: row.options ?? {} } : PRIVATE(category);
}

export async function allPrivacy(memberId: string): Promise<Record<PrivacyCategory, PrivacySetting>> {
  const rows = await db.select().from(privacySettings).where(eq(privacySettings.memberId, memberId));
  const out = {} as Record<PrivacyCategory, PrivacySetting>;
  for (const c of Object.keys(PRIVACY_META) as PrivacyCategory[]) out[c] = PRIVATE(c);
  for (const r of rows) if (r.category in out) out[r.category] = { category: r.category, audience: r.audience, memberIds: r.memberIds, options: r.options ?? {} };
  return out;
}

/** Under 18, or no birthday recorded. Parent oversight is only offered for minors. */
export function isMinor(o: Pick<PersonalOwner, "role" | "birthday">, today: string) {
  if (o.role === "parent") return false;
  if (!o.birthday) return true;
  const [y, m, d] = o.birthday.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  const age = ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
  return age < 18;
}

/** Why the viewer can see this person's area ('self', 'managed', 'oversight', 'shared'), or null. */
export function personalAccess(viewer: Viewer, owner: PersonalOwner, category: PrivacyCategory, setting: PrivacySetting): "self" | "managed" | "oversight" | "shared" | null {
  if (owner.id === viewer.member.id) return "self";
  if (viewer.isParent && owner.role !== "parent" && owner.userId === null) return "managed";
  if (viewer.isParent && owner.parentAccess.includes(category) && isMinor(owner, todayIn(viewer.family.timezone))) return "oversight";
  if (setting.audience === "parents" && viewer.isParent) return "shared";
  if (setting.audience === "selected" && setting.memberIds.includes(viewer.member.id)) return "shared";
  return null;
}

/** Only the owner (or parents for a member without a login) may change personal records. */
export const canManagePersonal = (viewer: Viewer, owner: PersonalOwner) => owner.id === viewer.member.id || (viewer.isParent && owner.role !== "parent" && owner.userId === null);

const ownerCols = { id: familyMembers.id, userId: familyMembers.userId, role: familyMembers.role, birthday: familyMembers.birthday, parentAccess: familyMembers.parentAccess, hiddenAreas: familyMembers.hiddenAreas, displayName: familyMembers.displayName, color: familyMembers.color };

/** Personal areas parents can remove from a profile (Family → Manage). Records are kept. */
export const HIDEABLE_AREAS = [
  { key: "period", label: "Period Tracker" },
  { key: "wellness", label: "Mental Wellness" },
] as const;
export type HideableArea = (typeof HIDEABLE_AREAS)[number]["key"];
export const areaHidden = (m: { hiddenAreas: string[] }, area: string) => m.hiddenAreas.includes(area);

/** Family members whose `category` area the viewer may open (always includes the viewer). */
export async function personalSubjects(viewer: Viewer, category: PrivacyCategory) {
  const members = await db.select(ownerCols).from(familyMembers).where(and(eq(familyMembers.familyId, viewer.family.id), eq(familyMembers.isActive, true)));
  const settings = await db.select().from(privacySettings).where(and(eq(privacySettings.familyId, viewer.family.id), eq(privacySettings.category, category)));
  const byMember = new Map(settings.map((s) => [s.memberId, { category, audience: s.audience, memberIds: s.memberIds, options: s.options ?? {} } as PrivacySetting]));
  return members
    .map((m) => ({ ...m, access: personalAccess(viewer, m, category, byMember.get(m.id) ?? PRIVATE(category)), setting: byMember.get(m.id) ?? PRIVATE(category) }))
    // An area removed from someone's profile isn't shown to anyone else either.
    .filter((m) => m.access && (m.id === viewer.member.id || !m.hiddenAreas.includes(category)))
    .sort((a, b) => (a.id === viewer.member.id ? -1 : b.id === viewer.member.id ? 1 : a.displayName.localeCompare(b.displayName)));
}

/** Whose area is the viewer looking at? The requested member if allowed, else themselves. */
export async function personalSubject(viewer: Viewer, category: PrivacyCategory, requested: unknown) {
  const subjects = await personalSubjects(viewer, category);
  const pick = (typeof requested === "string" && subjects.find((s) => s.id === requested)) || subjects.find((s) => s.id === viewer.member.id)!;
  return { subject: pick, subjects, canManage: canManagePersonal(viewer, pick), own: pick.id === viewer.member.id };
}

/** Members (ids) who can see someone's area, for "Shared with …" labels. */
export async function audienceNames(viewer: Viewer, setting: PrivacySetting) {
  if (setting.audience === "private") return [];
  const members = await db.select({ id: familyMembers.id, name: familyMembers.displayName, role: familyMembers.role }).from(familyMembers).where(and(eq(familyMembers.familyId, viewer.family.id), eq(familyMembers.isActive, true)));
  return members.filter((m) => m.id !== viewer.member.id && (setting.audience === "parents" ? m.role === "parent" : setting.memberIds.includes(m.id))).map((m) => m.name);
}

/** Owners (ids) of a category whose area the viewer can see, excluding themselves. Used by search. */
export async function sharedOwnerIds(viewer: Viewer, category: PrivacyCategory) {
  return (await personalSubjects(viewer, category)).filter((s) => s.id !== viewer.member.id).map((s) => s.id);
}

export async function membersByIds(familyId: string, ids: string[]) {
  if (!ids.length) return [];
  return db.select({ id: familyMembers.id, displayName: familyMembers.displayName }).from(familyMembers).where(and(eq(familyMembers.familyId, familyId), inArray(familyMembers.id, ids)));
}

export const AUDIENCE_LABEL: Record<PrivacyAudience, string> = { private: "Private to me", parents: "Shared with parents", selected: "Shared with selected people" };

/** A Privacy Center default ("journal", "goals", "medical") as a record visibility for new entries. */
export async function newEntryVisibility(memberId: string, category: "journal" | "goals" | "medical", fallback?: "private" | "parents" | "selected") {
  const [row] = await db.select().from(privacySettings).where(and(eq(privacySettings.memberId, memberId), eq(privacySettings.category, category)));
  if (!row && fallback) return { visibility: fallback, sharedWith: [] as string[] };
  return { visibility: (row?.audience ?? "private") as "private" | "parents" | "selected", sharedWith: row?.memberIds ?? [] };
}
