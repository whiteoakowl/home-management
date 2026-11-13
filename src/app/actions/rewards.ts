"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { familyMembers, pointAdjustments, rewardRedemptions, rewards } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { notify } from "@/lib/automation";
import { AuthorizationError, requireModule, requireParent } from "@/lib/dal";
import { todayIn } from "@/lib/dates";
import { recordExpense } from "@/lib/expenses";
import { logActivity } from "@/lib/family";
import { f, familyMemberIdOrNull, familyMemberIds } from "@/lib/records";
import { pointBalances } from "@/lib/rewards";

const revalidate = () => {
  revalidatePath("/house", "layout");
  revalidatePath("/");
};

export async function saveReward(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireParent();
    const title = f.str(fd, "title");
    const cost = f.int(fd, "cost");
    if (!title) return fail("Name the reward.", "title");
    if (!cost || cost < 1) return fail("Set a point cost of at least 1.", "cost");
    const values = {
      familyId: viewer.family.id,
      title,
      description: f.str(fd, "description"),
      emoji: f.str(fd, "emoji"),
      cost: Math.min(100000, cost),
      cashCents: f.cents(fd, "cash"),
      forMemberIds: await familyMemberIds(viewer.family.id, f.list(fd, "forMemberIds")),
      active: fd.has("activeField") ? f.bool(fd, "active") : true,
    };
    const id = f.str(fd, "id");
    if (id) await db.update(rewards).set(values).where(and(eq(rewards.id, id), eq(rewards.familyId, viewer.family.id)));
    else await db.insert(rewards).values({ ...values, createdByMemberId: viewer.member.id });
    revalidate();
    return ok("Saved.");
  });
}

export async function deleteReward(fd: FormData) {
  const viewer = await requireParent();
  await db.delete(rewards).where(and(eq(rewards.id, String(fd.get("id"))), eq(rewards.familyId, viewer.family.id)));
  revalidate();
}

/** A member asks to redeem a reward; points are held until a parent decides. */
export async function requestReward(fd: FormData) {
  const viewer = await requireModule("chores", "view");
  const [r] = await db.select().from(rewards).where(and(eq(rewards.id, String(fd.get("id"))), eq(rewards.familyId, viewer.family.id), eq(rewards.active, true)));
  if (!r) throw new AuthorizationError("That reward isn't available.");
  if (r.forMemberIds.length && !r.forMemberIds.includes(viewer.member.id)) throw new AuthorizationError("That reward isn't offered to you.");
  const bal = (await pointBalances(viewer.family.id)).get(viewer.member.id)?.balance ?? 0;
  if (bal < r.cost) throw new AuthorizationError(`You need ${r.cost - bal} more points.`);
  // Parents redeeming for themselves are approved straight away.
  const auto = viewer.isParent;
  await db.insert(rewardRedemptions).values({ familyId: viewer.family.id, rewardId: r.id, title: r.title, memberId: viewer.member.id, points: r.cost, status: auto ? "approved" : "requested", ...(auto ? { decidedByMemberId: viewer.member.id, decidedAt: todayIn(viewer.family.timezone) } : {}) });
  if (!auto) {
    const parents = (await db.select({ id: familyMembers.id }).from(familyMembers).where(and(eq(familyMembers.familyId, viewer.family.id), eq(familyMembers.role, "parent")))).map((p) => p.id);
    await notify(viewer.family.id, parents, { kind: "chore_due", title: `${viewer.member.displayName} wants to redeem "${r.title}"`, href: "/house/rewards" }, todayIn(viewer.family.timezone));
  }
  revalidate();
}

export async function decideRedemption(fd: FormData) {
  const viewer = await requireParent();
  const status = String(fd.get("status"));
  if (status !== "approved" && status !== "denied") return;
  const [x] = await db.select().from(rewardRedemptions).where(and(eq(rewardRedemptions.id, String(fd.get("id"))), eq(rewardRedemptions.familyId, viewer.family.id), eq(rewardRedemptions.status, "requested")));
  if (!x) return;
  const today = todayIn(viewer.family.timezone);
  await db.update(rewardRedemptions).set({ status, decidedByMemberId: viewer.member.id, decidedAt: today, note: f.str(fd, "note") }).where(eq(rewardRedemptions.id, x.id));
  if (status === "approved") {
    const [r] = x.rewardId ? await db.select().from(rewards).where(eq(rewards.id, x.rewardId)) : [];
    if (r?.cashCents && viewer.can("budget", "edit")) await recordExpense(viewer, { name: `Reward: ${x.title}`, amountCents: r.cashCents, date: today, categoryName: "Allowance" });
    await logActivity(db, viewer.family.id, x.memberId, "reward.redeemed", `redeemed "${x.title}" 🎉`, { module: "chores" });
  }
  await notify(viewer.family.id, [x.memberId], { kind: "chore_due", title: status === "approved" ? `"${x.title}" approved! 🎉` : `"${x.title}" wasn't approved this time`, href: "/house/rewards" }, today);
  revalidate();
}

/** Parents can cancel a pending request on behalf of a member; members can cancel their own. */
export async function cancelRedemption(fd: FormData) {
  const viewer = await requireModule("chores", "view");
  const [x] = await db.select().from(rewardRedemptions).where(and(eq(rewardRedemptions.id, String(fd.get("id"))), eq(rewardRedemptions.familyId, viewer.family.id), eq(rewardRedemptions.status, "requested")));
  if (!x || (!viewer.isParent && x.memberId !== viewer.member.id)) return;
  await db.delete(rewardRedemptions).where(eq(rewardRedemptions.id, x.id));
  revalidate();
}

export async function adjustPoints(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireParent();
    const memberId = await familyMemberIdOrNull(viewer.family.id, f.str(fd, "memberId"));
    const points = f.int(fd, "points");
    const reason = f.str(fd, "reason");
    if (!memberId) return fail("Choose who.", "memberId");
    if (!points) return fail("Enter points (negative to deduct).", "points");
    if (!reason) return fail("Say why.", "reason");
    await db.insert(pointAdjustments).values({ familyId: viewer.family.id, memberId, points: Math.max(-10000, Math.min(10000, points)), reason, createdByMemberId: viewer.member.id });
    await notify(viewer.family.id, [memberId], { kind: "chore_due", title: `${points > 0 ? "+" : ""}${points} points: ${reason}`, href: "/house/rewards" }, todayIn(viewer.family.timezone));
    revalidate();
    return ok("Points updated.");
  });
}
