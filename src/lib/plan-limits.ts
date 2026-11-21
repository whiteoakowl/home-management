import "server-only";
import { and, count, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { familyMembers, lists } from "@/db/schema";
import { AuthorizationError, type Viewer } from "./dal";
import { FREE_LIMITS } from "./plan-tiers";

type Limit = keyof typeof FREE_LIMITS;

const UPGRADE = "The account holder can upgrade in Account settings → Subscription.";
const MESSAGES: Record<Limit, (n: number) => string> = {
  members: (n) => `The Free plan includes up to ${n} family members. ${UPGRADE}`,
  lists: (n) => `The Free plan includes up to ${n} lists (your grocery list doesn't count). Archive or delete one, or upgrade. ${UPGRADE}`,
};

/** How many the family has now (what the Free limits count). */
export async function usage(familyId: string, what: Limit): Promise<number> {
  if (what === "members") {
    const [r] = await db.select({ n: count() }).from(familyMembers).where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.isActive, true)));
    return r?.n ?? 0;
  }
  const [r] = await db.select({ n: count() }).from(lists).where(and(eq(lists.familyId, familyId), ne(lists.kind, "shopping"), isNull(lists.archivedAt)));
  return r?.n ?? 0;
}

/** How many more can be added on this plan (Infinity on Premium). */
export async function roomFor(viewer: Viewer, what: Limit): Promise<number> {
  if (viewer.premium) return Infinity;
  return Math.max(0, FREE_LIMITS[what] - (await usage(viewer.family.id, what)));
}

/** Throws a friendly message when adding `adding` would go over a Free-plan limit. */
export async function assertRoom(viewer: Viewer, what: Limit, adding = 1) {
  if ((await roomFor(viewer, what)) < adding) throw new AuthorizationError(MESSAGES[what](FREE_LIMITS[what]));
}
