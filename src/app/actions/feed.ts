"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { feedOrderItems, feedOrders, listItems } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { mainShoppingListId } from "@/lib/automation";
import { AuthorizationError, canChangeItem, getViewer, type Viewer } from "@/lib/dal";
import { getFeedOrder } from "@/lib/feed";
import { logActivity } from "@/lib/family";
import { f, saveRecordAccess, visibilityFromForm } from "@/lib/records";

function revalidateFeed() {
  revalidatePath("/farm", "layout");
  revalidatePath("/shopping", "layout");
  revalidatePath("/");
}

/** Lines like "2 bags 16% layer pellets" → quantity "2 bags", name "16% layer pellets". */
function parseLine(line: string) {
  const m = line.match(/^(\d+(?:[.,/]\d+)?\s*(?:x|×|bags?|sacks?|lbs?|pounds?|kg|bales?|blocks?|buckets?|boxes?|gal(?:lons?)?|qts?|oz|tubs?)?\.?)\s+(.+)$/i);
  return m ? { quantity: m[1]!.trim(), name: m[2]!.trim() } : { quantity: null, name: line.trim() };
}

async function changeable(viewer: Viewer, id: string) {
  const o = await getFeedOrder(viewer, id);
  if (!o) throw new AuthorizationError("Feed order not found.");
  if (!canChangeItem(viewer, o.createdByMemberId) && !viewer.can("farm", "edit")) throw new AuthorizationError("Only the person who added it (or a parent) can change it.");
  return o;
}

export async function saveFeedOrder(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await getViewer();
    const id = f.str(fd, "id");
    if (id) await changeable(viewer, id);
    else if (!viewer.can("farm", "add")) throw new AuthorizationError("You can't add feed orders. Ask a parent for Add access to Farm.");
    const dueDate = f.date(fd, "dueDate");
    if (!dueDate) return fail("When do you need it by?", "dueDate");
    const lines = (f.str(fd, "items") ?? "")
      .split(/\r?\n/)
      .map((l) => l.replace(/^[-•*\s]+/, "").trim())
      .filter(Boolean);
    if (!lines.length) return fail("List at least one item (one per line).", "items");
    const title = f.str(fd, "title") ?? (lines.length === 1 ? parseLine(lines[0]!).name : `Feed run (${lines.length} items)`);
    const { visibility, memberIds } = visibilityFromForm(fd);
    const values = { title, dueDate, store: f.str(fd, "store"), notes: f.str(fd, "notes"), visibility };
    await db.transaction(async (tx) => {
      let orderId = id;
      const gotBefore = new Set<string>();
      if (id) {
        const old = await tx.select().from(feedOrderItems).where(eq(feedOrderItems.orderId, id));
        for (const o of old) if (o.got) gotBefore.add(`${o.quantity ?? ""}|${o.name}`.toLowerCase());
        await tx.update(feedOrders).set(values).where(eq(feedOrders.id, id));
        await tx.delete(feedOrderItems).where(eq(feedOrderItems.orderId, id));
      } else {
        const [row] = await tx.insert(feedOrders).values({ ...values, familyId: viewer.family.id, createdByMemberId: viewer.member.id }).returning({ id: feedOrders.id });
        orderId = row!.id;
      }
      await tx.insert(feedOrderItems).values(
        lines.map((l, position) => {
          const p = parseLine(l);
          return { orderId: orderId!, name: p.name, quantity: p.quantity, position, got: gotBefore.has(`${p.quantity ?? ""}|${p.name}`.toLowerCase()) };
        }),
      );
      await saveRecordAccess(tx, viewer.family.id, "feed_order", orderId!, memberIds);
    });
    if (!id && visibility === "family") await logActivity(db, viewer.family.id, viewer.member.id, "farm.feed_order", `added a feed order: ${title}`, { module: "farm" });
    revalidateFeed();
    return ok(id ? "Saved." : "Feed order added.");
  });
}

/** Tick one item as bought (anyone who can see the order and has Use access). */
export async function toggleFeedItem(fd: FormData) {
  const viewer = await getViewer();
  if (!viewer.can("farm", "use")) throw new AuthorizationError("You can view this but not check it off.");
  const [item] = await db.select().from(feedOrderItems).where(eq(feedOrderItems.id, String(fd.get("id"))));
  if (!item || !(await getFeedOrder(viewer, item.orderId))) throw new AuthorizationError("Not found.");
  const got = fd.get("done") === "true";
  await db.update(feedOrderItems).set({ got }).where(eq(feedOrderItems.id, item.id));
  // All bought → the order is done; un-ticking reopens it.
  const [{ left } = { left: 0 }] = await db.select({ left: sql<number>`count(*)::int` }).from(feedOrderItems).where(and(eq(feedOrderItems.orderId, item.orderId), eq(feedOrderItems.got, false)));
  await db.update(feedOrders).set({ completedAt: left === 0 ? new Date() : null }).where(eq(feedOrders.id, item.orderId));
  revalidateFeed();
}

/** Mark the whole order bought (or reopen it). */
export async function completeFeedOrder(fd: FormData) {
  const viewer = await getViewer();
  if (!viewer.can("farm", "use")) throw new AuthorizationError("You can view this but not check it off.");
  const o = await getFeedOrder(viewer, String(fd.get("id")));
  if (!o) throw new AuthorizationError("Not found.");
  const done = !o.completedAt;
  await db.update(feedOrders).set({ completedAt: done ? new Date() : null }).where(eq(feedOrders.id, o.id));
  await db.update(feedOrderItems).set({ got: done }).where(eq(feedOrderItems.orderId, o.id));
  revalidateFeed();
}

export async function deleteFeedOrder(fd: FormData) {
  const viewer = await getViewer();
  const o = await changeable(viewer, String(fd.get("id")));
  await db.delete(feedOrders).where(eq(feedOrders.id, o.id));
  revalidateFeed();
}

/** Copy the items still needed onto the family's shopping list. */
export async function feedOrderToShopping(fd: FormData) {
  const viewer = await getViewer();
  if (!viewer.can("shopping", "add")) throw new AuthorizationError("You can't add to the shopping list.");
  const o = await getFeedOrder(viewer, String(fd.get("id")));
  if (!o) throw new AuthorizationError("Not found.");
  const items = await db.select().from(feedOrderItems).where(and(eq(feedOrderItems.orderId, o.id), eq(feedOrderItems.got, false)));
  if (!items.length) return;
  const listId = await mainShoppingListId(viewer.family.id);
  const existing = new Set((await db.select({ text: listItems.text }).from(listItems).where(and(eq(listItems.listId, listId), eq(listItems.checked, false)))).map((r) => r.text.toLowerCase()));
  const [{ max } = { max: 0 }] = await db.select({ max: sql<number>`coalesce(max(${listItems.position}),0)::int` }).from(listItems).where(eq(listItems.listId, listId));
  const rows = items
    .filter((i) => !existing.has(i.name.toLowerCase()))
    .map((i, n) => ({ listId, text: i.name, quantity: i.quantity, unit: null, source: "manual" as const, shoppingCategory: "farm" as const, addedByMemberId: viewer.member.id, position: max + 1 + n }));
  if (rows.length) await db.insert(listItems).values(rows);
  revalidateFeed();
}
