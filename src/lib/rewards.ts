import "server-only";
import { memberNameSql } from "./names";
import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { choreOccurrences, chores, familyMembers, pointAdjustments, rewardRedemptions, rewards } from "@/db/schema";
import type { Viewer } from "./dal";

/**
 * One row per person who earned a completion: everyone on the team when the
 * chore was shared, otherwise whoever finished it (older records too).
 */
const earners = sql`${choreOccurrences} cross join lateral unnest(case when cardinality(${choreOccurrences.awardedMemberIds}) > 0 then ${choreOccurrences.awardedMemberIds} else array[${choreOccurrences.completedByMemberId}] end) as earner(id)`;

/** Points balance per member: earned from chores + adjustments − redemptions (pending ones are held). */
export async function pointBalances(familyId: string) {
  const [earned, adj, spent] = await Promise.all([
    db
      .select({ memberId: sql<string | null>`earner.id`, n: sql<number>`coalesce(sum(${choreOccurrences.pointsAwarded}),0)::int` })
      .from(earners)
      .where(and(eq(choreOccurrences.familyId, familyId), eq(choreOccurrences.status, "done"), isNotNull(choreOccurrences.pointsAwarded)))
      .groupBy(sql`earner.id`),
    db.select({ memberId: pointAdjustments.memberId, n: sql<number>`sum(${pointAdjustments.points})::int` }).from(pointAdjustments).where(eq(pointAdjustments.familyId, familyId)).groupBy(pointAdjustments.memberId),
    db
      .select({ memberId: rewardRedemptions.memberId, n: sql<number>`sum(${rewardRedemptions.points})::int` })
      .from(rewardRedemptions)
      .where(and(eq(rewardRedemptions.familyId, familyId), inArray(rewardRedemptions.status, ["requested", "approved"])))
      .groupBy(rewardRedemptions.memberId),
  ]);
  const out = new Map<string, { earned: number; adjusted: number; spent: number; balance: number }>();
  const get = (id: string) => out.get(id) ?? (out.set(id, { earned: 0, adjusted: 0, spent: 0, balance: 0 }), out.get(id)!);
  for (const r of earned) if (r.memberId) get(r.memberId).earned += r.n;
  for (const r of adj) get(r.memberId).adjusted += r.n;
  for (const r of spent) get(r.memberId).spent += r.n;
  for (const v of out.values()) v.balance = v.earned + v.adjusted - v.spent;
  return out;
}

/** Work share since a date: completions, points and minutes per member (for the fairness view). */
export async function workShare(familyId: string, from: string) {
  return db
    .select({
      memberId: familyMembers.id,
      name: familyMembers.displayName,
      color: familyMembers.color,
      done: sql<number>`count(*)::int`,
      points: sql<number>`coalesce(sum(${choreOccurrences.pointsAwarded}),0)::int`,
      minutes: sql<number>`coalesce(sum(coalesce(${chores.estimatedMinutes}, 15)),0)::int`,
    })
    .from(earners)
    .innerJoin(chores, eq(chores.id, choreOccurrences.choreId))
    .innerJoin(familyMembers, sql`${familyMembers.id} = earner.id`)
    .where(and(eq(choreOccurrences.familyId, familyId), eq(choreOccurrences.status, "done"), gte(choreOccurrences.dueDate, from)))
    .groupBy(familyMembers.id, familyMembers.displayName, familyMembers.color)
    .orderBy(desc(sql`4`));
}

export async function rewardsFor(viewer: Viewer) {
  return db.select().from(rewards).where(eq(rewards.familyId, viewer.family.id)).orderBy(rewards.cost);
}

export async function redemptionsFor(viewer: Viewer) {
  return db
    .select({ r: rewardRedemptions, name: memberNameSql(viewer, familyMembers), color: familyMembers.color })
    .from(rewardRedemptions)
    .innerJoin(familyMembers, eq(familyMembers.id, rewardRedemptions.memberId))
    .where(and(eq(rewardRedemptions.familyId, viewer.family.id), viewer.isParent ? undefined : eq(rewardRedemptions.memberId, viewer.member.id)))
    .orderBy(desc(rewardRedemptions.createdAt))
    .limit(50);
}
