"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { inventoryEvents, inventoryItems, listItems, products, storageLocation } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { addLowStockToShopping } from "@/lib/automation";
import { AuthorizationError, requireModule } from "@/lib/dal";
import { todayIn } from "@/lib/dates";
import { logActivity } from "@/lib/family";
import { deleteFamilyFile, saveUpload } from "@/lib/files";
import { addToInventory } from "@/lib/kitchen";
import { loadList } from "@/lib/lists";
import { ownedCategoryId } from "@/lib/queries";
import { f } from "@/lib/records";

const LOCATIONS = storageLocation.enumValues;
type Loc = (typeof LOCATIONS)[number];

function revalidateKitchen() {
  revalidatePath("/kitchen", "layout");
  revalidatePath("/meals");
  revalidatePath("/recipes", "layout");
  revalidatePath("/shopping", "layout");
  revalidatePath("/");
}

export async function saveInventoryItem(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("kitchen", "edit");
    const name = f.str(fd, "name");
    if (!name) return fail("What is it?", "name");
    const quantity = f.num(fd, "quantity") ?? 1;
    if (quantity < 0) return fail("Quantity can't be negative.", "quantity");
    const loc = (f.str(fd, "location") ?? "pantry") as Loc;
    const location = LOCATIONS.includes(loc) ? loc : "pantry";
    const barcode = f.str(fd, "barcode")?.replace(/\D/g, "") || null;

    // Cache the product so the next scan is instant.
    let productId: string | null = null;
    if (barcode) {
      const [p] = await db
        .insert(products)
        .values({ familyId: viewer.family.id, barcode, name, brand: f.str(fd, "brand"), defaultUnit: f.str(fd, "unit"), defaultLocation: location, imageUrl: f.str(fd, "productImageUrl") })
        .onConflictDoUpdate({ target: [products.familyId, products.barcode], set: { name, defaultUnit: f.str(fd, "unit"), defaultLocation: location } })
        .returning({ id: products.id });
      productId = p!.id;
    }

    const id = f.str(fd, "id");
    const image = await saveUpload(viewer, fd.get("image"));
    const values = {
      familyId: viewer.family.id,
      name,
      quantity: String(quantity),
      unit: f.str(fd, "unit"),
      location,
      spot: f.str(fd, "spot"),
      categoryId: await ownedCategoryId(viewer, "inventory", f.str(fd, "categoryId")),
      purchasedOn: f.date(fd, "purchasedOn"),
      expiresOn: f.date(fd, "expiresOn"),
      lowStockThreshold: f.num(fd, "lowStockThreshold") !== null ? String(f.num(fd, "lowStockThreshold")) : null,
      notes: f.str(fd, "notes"),
      ...(productId ? { productId } : {}),
      ...(image ? { imageFileId: image } : {}),
    };

    if (id) {
      const [old] = await db.select().from(inventoryItems).where(and(eq(inventoryItems.id, id), eq(inventoryItems.familyId, viewer.family.id)));
      if (!old) return fail("Item not found.");
      await db.update(inventoryItems).set(f.bool(fd, "removeImage") && !image ? { ...values, imageFileId: null } : values).where(eq(inventoryItems.id, id));
      if ((image || f.bool(fd, "removeImage")) && old.imageFileId) await deleteFamilyFile(viewer.family.id, old.imageFileId);
      const delta = quantity - Number(old.quantity);
      if (delta !== 0) {
        await db.insert(inventoryEvents).values({ familyId: viewer.family.id, itemId: id, kind: "adjusted", quantityDelta: String(delta), memberId: viewer.member.id });
      }
    } else {
      const [row] = await db
        .insert(inventoryItems)
        .values({ ...values, purchasedOn: values.purchasedOn ?? todayIn(viewer.family.timezone) })
        .returning({ id: inventoryItems.id });
      await db.insert(inventoryEvents).values({
        familyId: viewer.family.id,
        itemId: row!.id,
        kind: "added",
        quantityDelta: String(quantity),
        source: barcode ? "barcode" : "manual",
        memberId: viewer.member.id,
      });
    }
    revalidateKitchen();
    return ok(id ? "Saved." : `${name} added.`);
  });
}

async function ownItem(familyId: string, id: string) {
  const [item] = await db.select().from(inventoryItems).where(and(eq(inventoryItems.id, id), eq(inventoryItems.familyId, familyId)));
  if (!item) throw new AuthorizationError("Item not found.");
  return item;
}

/** Use some (default 1) of an item. Archives it when it runs out. */
export async function useInventory(fd: FormData) {
  const viewer = await requireModule("kitchen", "edit");
  const item = await ownItem(viewer.family.id, String(fd.get("id")));
  const amount = Math.max(0, Number(fd.get("amount") ?? 1) || 1);
  const left = Math.max(0, Number(item.quantity) - amount);
  await db.update(inventoryItems).set({ quantity: String(left), archivedAt: left === 0 ? new Date() : null }).where(eq(inventoryItems.id, item.id));
  await db.insert(inventoryEvents).values({ familyId: viewer.family.id, itemId: item.id, kind: "used", quantityDelta: String(-Math.min(amount, Number(item.quantity))), memberId: viewer.member.id });
  revalidateKitchen();
}

export async function adjustInventory(fd: FormData) {
  const viewer = await requireModule("kitchen", "edit");
  const item = await ownItem(viewer.family.id, String(fd.get("id")));
  const delta = Number(fd.get("delta") ?? 0);
  if (!delta) return;
  const next = Math.max(0, Number(item.quantity) + delta);
  await db.update(inventoryItems).set({ quantity: String(next) }).where(eq(inventoryItems.id, item.id));
  await db.insert(inventoryEvents).values({ familyId: viewer.family.id, itemId: item.id, kind: delta > 0 ? "added" : "used", quantityDelta: String(next - Number(item.quantity)), memberId: viewer.member.id });
  revalidateKitchen();
}

/** Mark an item used / discarded / donated (removes it) or replaced (fresh stock). */
export async function disposeInventory(fd: FormData) {
  const viewer = await requireModule("kitchen", "edit");
  const item = await ownItem(viewer.family.id, String(fd.get("id")));
  const kind = String(fd.get("kind"));
  if (!["used", "discarded", "donated", "replaced"].includes(kind)) return;
  const qty = Number(item.quantity);
  if (kind === "replaced") {
    await db
      .update(inventoryItems)
      .set({ purchasedOn: todayIn(viewer.family.timezone), expiresOn: f.date(fd, "expiresOn") })
      .where(eq(inventoryItems.id, item.id));
    await db.insert(inventoryEvents).values({ familyId: viewer.family.id, itemId: item.id, kind: "replaced", quantityDelta: "0", memberId: viewer.member.id });
  } else {
    await db.update(inventoryItems).set({ archivedAt: new Date(), quantity: "0" }).where(eq(inventoryItems.id, item.id));
    await db.insert(inventoryEvents).values({
      familyId: viewer.family.id,
      itemId: item.id,
      kind: kind as "used" | "discarded" | "donated",
      quantityDelta: String(-qty),
      memberId: viewer.member.id,
    });
  }
  revalidateKitchen();
}

export async function deleteInventoryItem(fd: FormData) {
  const viewer = await requireModule("kitchen", "edit");
  const item = await ownItem(viewer.family.id, String(fd.get("id")));
  await db.delete(inventoryItems).where(eq(inventoryItems.id, item.id));
  await deleteFamilyFile(viewer.family.id, item.imageFileId);
  revalidateKitchen();
}

export async function restockLowItems() {
  const viewer = await requireModule("shopping", "edit");
  const n = await addLowStockToShopping(viewer.family.id);
  revalidateKitchen();
  if (n) await logActivity(db, viewer.family.id, viewer.member.id, "shopping.low_stock", `added ${n} low-stock item${n === 1 ? "" : "s"} to the shopping list`, { module: "shopping" });
}

export type ProductLookup = {
  found: boolean;
  source: "family" | "openfoodfacts" | null;
  name?: string;
  brand?: string | null;
  imageUrl?: string | null;
  unit?: string | null;
  location?: Loc | null;
  message?: string;
};

/**
 * Identify a scanned barcode: family product cache first, then Open Food Facts.
 * Always succeeds (found:false lets the user enter it manually).
 */
export async function lookupBarcode(raw: string): Promise<ProductLookup> {
  const viewer = await requireModule("kitchen", "edit");
  const barcode = String(raw ?? "").replace(/\D/g, "");
  if (barcode.length < 6 || barcode.length > 14) return { found: false, source: null, message: "That doesn't look like a product barcode." };

  const [cached] = await db.select().from(products).where(and(eq(products.familyId, viewer.family.id), eq(products.barcode, barcode)));
  if (cached) {
    return { found: true, source: "family", name: cached.name, brand: cached.brand, imageUrl: cached.imageUrl, unit: cached.defaultUnit, location: cached.defaultLocation };
  }
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,image_small_url,categories_tags`, {
      headers: { "User-Agent": "VanderbiltFamily/1.0 (home inventory app)" },
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (res.ok) {
      const j = (await res.json()) as { status?: number; product?: { product_name?: string; brands?: string; image_small_url?: string; categories_tags?: string[] } };
      if (j.status === 1 && j.product?.product_name) {
        const tags = j.product.categories_tags ?? [];
        const location: Loc = tags.some((t) => /frozen/.test(t)) ? "freezer" : tags.some((t) => /dairy|fresh|meat|yogurt|cheese/.test(t)) ? "fridge" : "pantry";
        return { found: true, source: "openfoodfacts", name: j.product.product_name, brand: j.product.brands?.split(",")[0] ?? null, imageUrl: j.product.image_small_url ?? null, location };
      }
    }
    return { found: false, source: null, message: "We couldn't identify that product. Enter the details below and we'll remember it next time." };
  } catch {
    return { found: false, source: null, message: "Product lookup is unavailable right now. Enter the details below and we'll remember it next time." };
  }
}

/**
 * Shopping → Inventory: every checked item on a shopping list is added to the
 * kitchen (merging with an existing item of the same name & unit), then cleared.
 */
export async function putAwayChecked(fd: FormData) {
  const viewer = await requireModule("kitchen", "edit");
  const list = await loadList(viewer, String(fd.get("id")), true);
  const checked = await db.select().from(listItems).where(and(eq(listItems.listId, list.id), eq(listItems.checked, true)));
  if (!checked.length) return;
  const today = todayIn(viewer.family.timezone);
  const locFor = (cat: string | null): Loc => (cat === "frozen" ? "freezer" : cat === "dairy" || cat === "meat" || cat === "produce" ? "fridge" : cat === "household" || cat === "personal" ? "supplies" : cat === "farm" ? "farm" : cat === "garden" ? "garden" : "pantry");
  for (const item of checked) {
    await addToInventory(
      viewer.family.id,
      { name: item.text, quantity: item.quantity ? Number(item.quantity) : 1, unit: item.unit, location: locFor(item.shoppingCategory), today },
      { source: "shopping", sourceId: list.id, memberId: viewer.member.id },
    );
  }
  const count = checked.length;
  await db.delete(listItems).where(and(eq(listItems.listId, list.id), eq(listItems.checked, true)));
  await logActivity(db, viewer.family.id, viewer.member.id, "shopping.put_away", `put away ${count} item${count === 1 ? "" : "s"} from ${list.title}`, { module: "kitchen" });
  revalidateKitchen();
}
