"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import * as z from "zod";
import { db } from "@/db";
import { groceryReceiptItems, groceryReceipts, inventoryEvents, inventoryItems } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { AuthorizationError, getViewer } from "@/lib/dal";
import { todayIn } from "@/lib/dates";
import { recordExpense } from "@/lib/expenses";
import { deleteFamilyFile, saveUpload } from "@/lib/files";
import { logActivity } from "@/lib/family";
import { ownerForNew } from "@/lib/food-space";
import { f } from "@/lib/records";
import { SHOPPING_CATEGORY_KEYS } from "@/lib/shopping-category";

const LOCATIONS = ["pantry", "fridge", "freezer", "supplies", "farm", "garden", "other"] as const;

const Item = z.object({
  include: z.boolean(),
  name: z.string().trim().min(1).max(120),
  quantity: z.number().positive().max(10000).catch(1),
  unit: z.string().trim().max(20).nullable().catch(null),
  priceCents: z.number().int().min(0).max(10_000_000).nullable().catch(null),
  category: z.enum(SHOPPING_CATEGORY_KEYS).catch("other"),
  location: z.enum(LOCATIONS).catch("pantry"),
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().catch(null),
  /** Inventory item to add to instead of creating a duplicate. */
  mergeWith: z.uuid().nullable().catch(null),
});

/**
 * Add reviewed receipt items to the Family Pantry or My Pantry. Nothing reaches the
 * pantry without this review step. Optionally saves the receipt to history and records
 * the total as a household expense.
 */
export async function importReceipt(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await getViewer();
    // "mine" → my private pantry (needs a private food space); otherwise the Family Pantry (needs Add access).
    const owner = ownerForNew(viewer, "kitchen", fd);
    let raw: unknown;
    try {
      raw = JSON.parse(String(fd.get("items") ?? "[]"));
    } catch {
      return fail("The item list couldn't be read. Try again.");
    }
    const parsed = z.array(z.unknown()).max(200).safeParse(raw);
    if (!parsed.success) return fail("Too many items. Split the receipt into two imports.");
    const items = parsed.data.map((x) => Item.safeParse(x)).filter((r) => r.success).map((r) => r.data);
    const chosen = items.filter((i) => i.include);
    const saveReceipt = f.bool(fd, "saveReceipt");
    if (!chosen.length && !saveReceipt) return fail("Select at least one item to add, or save the receipt.");
    const today = todayIn(viewer.family.timezone);
    const store = f.str(fd, "store")?.slice(0, 80) ?? null;
    const date = f.date(fd, "date") ?? today;
    const totalCents = f.cents(fd, "total");

    // Existing items you may add to (same space only).
    const existing = await db
      .select({ id: inventoryItems.id, quantity: inventoryItems.quantity })
      .from(inventoryItems)
      .where(and(eq(inventoryItems.familyId, viewer.family.id), owner ? eq(inventoryItems.ownerMemberId, owner) : isNull(inventoryItems.ownerMemberId), isNull(inventoryItems.archivedAt)));
    const byId = new Map(existing.map((e) => [e.id, e]));

    const image = saveReceipt && f.bool(fd, "keepImage") ? await saveUpload(viewer, fd.get("image")) : null;
    let receiptId: string | null = null;
    let added = 0;
    let merged = 0;
    await db.transaction(async (tx) => {
      if (saveReceipt) {
        const [r] = await tx
          .insert(groceryReceipts)
          .values({ familyId: viewer.family.id, ownerMemberId: owner, createdByMemberId: viewer.member.id, store, date, totalCents, imageFileId: image, notes: f.str(fd, "notes")?.slice(0, 2000) ?? null })
          .returning({ id: groceryReceipts.id });
        receiptId = r!.id;
      }
      for (const [position, it] of items.entries()) {
        let inventoryItemId: string | null = null;
        if (it.include) {
          const target = it.mergeWith ? byId.get(it.mergeWith) : undefined;
          if (it.mergeWith && !target) throw new AuthorizationError("One of the pantry items to add to wasn't found. Reload and try again.");
          if (target) {
            await tx
              .update(inventoryItems)
              .set({ quantity: String(Number(target.quantity) + it.quantity), purchasedOn: date, ...(it.expiresOn ? { expiresOn: it.expiresOn } : {}) })
              .where(eq(inventoryItems.id, target.id));
            target.quantity = String(Number(target.quantity) + it.quantity);
            inventoryItemId = target.id;
            merged++;
          } else {
            const [row] = await tx
              .insert(inventoryItems)
              .values({ familyId: viewer.family.id, name: it.name, quantity: String(it.quantity), unit: it.unit, location: it.location, purchasedOn: date, expiresOn: it.expiresOn, ownerMemberId: owner, createdByMemberId: viewer.member.id })
              .returning({ id: inventoryItems.id });
            inventoryItemId = row!.id;
            added++;
          }
          await tx.insert(inventoryEvents).values({ familyId: viewer.family.id, itemId: inventoryItemId, kind: "added", quantityDelta: String(it.quantity), source: "shopping", sourceId: receiptId, memberId: viewer.member.id });
        }
        if (receiptId) {
          await tx.insert(groceryReceiptItems).values({ receiptId, name: it.name, quantity: String(it.quantity), unit: it.unit, priceCents: it.priceCents, category: it.category, location: it.location, expiresOn: it.expiresOn, addedToPantry: it.include, inventoryItemId, position });
        }
      }
    });

    let expenseNote = "";
    if (f.bool(fd, "createExpense") && totalCents && totalCents > 0) {
      const t = await recordExpense(viewer, { name: `Groceries${store ? ` · ${store}` : ""}`, amountCents: totalCents, date, categoryName: f.str(fd, "expenseCategory") ?? "Groceries", notes: receiptId ? "From a scanned receipt" : null });
      if (t && receiptId) await db.update(groceryReceipts).set({ transactionId: t }).where(eq(groceryReceipts.id, receiptId));
      expenseNote = t ? " The total was recorded as a household expense." : " (The expense wasn't recorded: that needs budget access.)";
    }
    if (!owner && added + merged > 0) await logActivity(db, viewer.family.id, viewer.member.id, "kitchen.receipt", `added ${added + merged} item${added + merged === 1 ? "" : "s"} from a grocery receipt${store ? ` (${store})` : ""}`, { module: "kitchen" });
    revalidatePath("/kitchen", "layout");
    revalidatePath("/budget", "layout");
    const where = owner ? "My Pantry" : "the Family Pantry";
    const msg = `Added ${added} new item${added === 1 ? "" : "s"}${merged ? ` and topped up ${merged} you already had` : ""} in ${where}.${expenseNote}`;
    if (receiptId) redirect(`/kitchen/receipts/${receiptId}?done=${encodeURIComponent(msg)}`);
    return ok(msg);
  });
}

/** Delete a saved receipt (not the pantry items it added). */
export async function deleteReceipt(fd: FormData) {
  const viewer = await getViewer();
  const [r] = await db.select().from(groceryReceipts).where(and(eq(groceryReceipts.id, String(fd.get("id"))), eq(groceryReceipts.familyId, viewer.family.id)));
  if (!r) return;
  const allowed = r.ownerMemberId ? r.ownerMemberId === viewer.member.id : viewer.isParent || r.createdByMemberId === viewer.member.id;
  if (!allowed) throw new AuthorizationError("Only the person who saved this receipt (or a parent) can delete it.");
  await db.delete(groceryReceipts).where(eq(groceryReceipts.id, r.id));
  await deleteFamilyFile(viewer.family.id, r.imageFileId);
  revalidatePath("/kitchen", "layout");
  redirect(`/kitchen/receipts${r.ownerMemberId ? "?space=mine" : ""}`);
}
