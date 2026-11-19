"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { wishlistItems } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { AuthorizationError, getFamilyMember, requireModule, type Viewer } from "@/lib/dal";
import { f } from "@/lib/records";

/**
 * Wishlists (in Lists). Everyone with Lists access keeps their own wishlist;
 * parents (Lists "Add & edit") can also help with someone else's.
 * Claims are for everyone except the wishlist's owner.
 */
const canEditFor = (viewer: Viewer, memberId: string) => memberId === viewer.member.id || viewer.can("lists", "edit");

async function item(viewer: Viewer, id: string | null) {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new AuthorizationError("Item not found.");
  const [it] = await db.select().from(wishlistItems).where(and(eq(wishlistItems.id, id), eq(wishlistItems.familyId, viewer.family.id)));
  if (!it) throw new AuthorizationError("Item not found.");
  return it;
}

const revalidate = () => revalidatePath("/lists/wishlists");

function cleanLink(v: string | null) {
  if (!v) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export async function saveWishlistItem(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("lists", "view");
    const id = f.str(fd, "id");
    const existing = id ? await item(viewer, id) : null;
    const memberId = existing?.memberId ?? f.str(fd, "memberId") ?? viewer.member.id;
    if (!(await getFamilyMember(viewer, memberId))) return fail("Choose whose wishlist.");
    if (!canEditFor(viewer, memberId)) throw new AuthorizationError("You can only change your own wishlist.");
    const title = f.str(fd, "title");
    if (!title) return fail("What would you like?", "title");
    const rawLink = f.str(fd, "link");
    const link = cleanLink(rawLink);
    if (rawLink && !link) return fail("That link doesn't look right.", "link");
    const priority = f.int(fd, "priority");
    const values = {
      title: title.slice(0, 200),
      link,
      priceCents: f.cents(fd, "price"),
      priority: priority && priority >= 1 && priority <= 3 ? priority : 2,
      details: f.str(fd, "details"),
      occasion: f.str(fd, "occasion")?.slice(0, 60) ?? "Holidays",
    };
    if (existing) await db.update(wishlistItems).set(values).where(eq(wishlistItems.id, existing.id));
    else await db.insert(wishlistItems).values({ ...values, familyId: viewer.family.id, memberId });
    revalidate();
    return ok(existing ? "Saved." : "Added to the wishlist.");
  });
}

export async function deleteWishlistItem(fd: FormData) {
  const viewer = await requireModule("lists", "view");
  const it = await item(viewer, f.str(fd, "id"));
  if (!canEditFor(viewer, it.memberId)) throw new AuthorizationError("You can only change your own wishlist.");
  await db.delete(wishlistItems).where(eq(wishlistItems.id, it.id));
  revalidate();
}

/** The owner got it: move to "Got it" (or back). */
export async function toggleReceived(fd: FormData) {
  const viewer = await requireModule("lists", "view");
  const it = await item(viewer, f.str(fd, "id"));
  if (!canEditFor(viewer, it.memberId)) throw new AuthorizationError("You can only change your own wishlist.");
  await db.update(wishlistItems).set({ received: !it.received }).where(eq(wishlistItems.id, it.id));
  revalidate();
}

/** claim | unclaim | bought | notBought — never on your own wishlist. */
export async function claimWishlistItem(fd: FormData) {
  const viewer = await requireModule("lists", "view");
  const it = await item(viewer, f.str(fd, "id"));
  if (it.memberId === viewer.member.id) throw new AuthorizationError("No peeking at your own gifts!");
  const op = String(fd.get("op"));
  const mineOrFree = !it.claimedByMemberId || it.claimedByMemberId === viewer.member.id;
  if (!mineOrFree && !viewer.isParent) throw new AuthorizationError("Someone else is already getting this.");
  if (op === "claim") await db.update(wishlistItems).set({ claimedByMemberId: viewer.member.id }).where(eq(wishlistItems.id, it.id));
  else if (op === "unclaim") await db.update(wishlistItems).set({ claimedByMemberId: null, purchased: false }).where(eq(wishlistItems.id, it.id));
  else if (op === "bought") await db.update(wishlistItems).set({ claimedByMemberId: it.claimedByMemberId ?? viewer.member.id, purchased: true }).where(eq(wishlistItems.id, it.id));
  else if (op === "notBought") await db.update(wishlistItems).set({ purchased: false }).where(eq(wishlistItems.id, it.id));
  revalidate();
}
