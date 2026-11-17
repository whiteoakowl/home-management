import "server-only";
import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { feedOrderItems, feedOrders } from "@/db/schema";
import { visibleTo, type Viewer } from "./dal";

export type FeedOrder = typeof feedOrders.$inferSelect & { items: (typeof feedOrderItems.$inferSelect)[] };

/** Feed orders the viewer may see (family, "Parents & me", "Only me", selected people). */
export async function listFeedOrders(viewer: Viewer, opts: { done?: boolean; limit?: number } = {}): Promise<FeedOrder[]> {
  if (!viewer.can("farm")) return [];
  const orders = await db
    .select()
    .from(feedOrders)
    .where(
      and(
        eq(feedOrders.familyId, viewer.family.id),
        visibleTo(viewer, { id: feedOrders.id, visibility: feedOrders.visibility, author: feedOrders.createdByMemberId }, "feed_order"),
        opts.done ? isNotNull(feedOrders.completedAt) : isNull(feedOrders.completedAt),
      ),
    )
    .orderBy(asc(feedOrders.dueDate), asc(feedOrders.createdAt))
    .limit(opts.limit ?? 100);
  if (!orders.length) return [];
  const items = await db.select().from(feedOrderItems).where(inArray(feedOrderItems.orderId, orders.map((o) => o.id))).orderBy(asc(feedOrderItems.position));
  const by = Map.groupBy(items, (i) => i.orderId);
  return orders.map((o) => ({ ...o, items: by.get(o.id) ?? [] }));
}

/** One feed order the viewer may see, or null. */
export async function getFeedOrder(viewer: Viewer, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !viewer.can("farm")) return null;
  const [o] = await db
    .select()
    .from(feedOrders)
    .where(
      and(
        eq(feedOrders.id, id),
        eq(feedOrders.familyId, viewer.family.id),
        visibleTo(viewer, { id: feedOrders.id, visibility: feedOrders.visibility, author: feedOrders.createdByMemberId }, "feed_order"),
      ),
    );
  return o ?? null;
}
