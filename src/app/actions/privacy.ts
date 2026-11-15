"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { familyMembers, PRIVACY_CATEGORIES, privacySettings, type PrivacyAudience, type PrivacyCategory } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { getFamilyMember, getViewer, requireParent } from "@/lib/dal";
import { todayIn } from "@/lib/dates";
import { isMinor, PRIVACY_META } from "@/lib/privacy";
import { familyMemberIds } from "@/lib/records";

const AUDIENCES: PrivacyAudience[] = ["private", "parents", "selected"];
const OPTION_KEYS: Partial<Record<PrivacyCategory, string[]>> = { period: ["showOnCalendar"] };

/** Save who can see one of my personal areas (Privacy Center). Only I can change my own. */
export async function savePrivacy(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await getViewer();
    const category = String(fd.get("category")) as PrivacyCategory;
    if (!PRIVACY_CATEGORIES.includes(category)) return fail("Unknown area.");
    const audience = String(fd.get("audience")) as PrivacyAudience;
    if (!AUDIENCES.includes(audience)) return fail("Choose who can see it.");
    const picked = audience === "selected" ? (await familyMemberIds(viewer.family.id, fd.getAll("memberIds").map(String))).filter((id) => id !== viewer.member.id) : [];
    if (audience === "selected" && !picked.length) return fail("Pick at least one person, or choose Private.");
    const options = Object.fromEntries((OPTION_KEYS[category] ?? []).map((k) => [k, fd.get(k) === "on"]));
    await db
      .insert(privacySettings)
      .values({ memberId: viewer.member.id, familyId: viewer.family.id, category, audience, memberIds: picked, options })
      .onConflictDoUpdate({ target: [privacySettings.memberId, privacySettings.category], set: { audience, memberIds: picked, options, updatedAt: new Date() } });
    revalidatePath("/", "layout");
    return ok(`${PRIVACY_META[category].label}: saved.`);
  });
}

/** Parents: which personal areas parents may view for a minor (parent oversight). Shown to the member. */
export async function saveParentAccess(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireParent();
    const target = await getFamilyMember(viewer, String(fd.get("memberId") ?? ""));
    if (!target || target.role === "parent") return fail("Parent oversight is only for family members who aren't parents.");
    if (!isMinor(target, todayIn(viewer.family.timezone))) return fail(`${target.displayName} is 18 or older, so their personal areas are theirs to share.`);
    const areas = fd.getAll("areas").map(String).filter((c): c is PrivacyCategory => PRIVACY_CATEGORIES.includes(c as PrivacyCategory));
    await db.update(familyMembers).set({ parentAccess: areas }).where(and(eq(familyMembers.id, target.id), eq(familyMembers.familyId, viewer.family.id)));
    revalidatePath("/", "layout");
    return ok(areas.length ? `Parents can view ${target.displayName}'s ${areas.map((a) => PRIVACY_META[a].label).join(", ")}. ${target.displayName} will see this in their Privacy Center.` : `Parent oversight is off for ${target.displayName}.`);
  });
}
