"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  calendarEvents,
  celebrationLinks,
  celebrations,
  craftCollection,
  craftItemSupplies,
  craftItems,
  inventoryItems,
  journalEntries,
  listItems,
  lists,
  plants,
  recipes,
  sabbatSettings,
} from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { mainShoppingListId } from "@/lib/automation";
import { getCraftItem } from "@/lib/craft";
import { COLLECTION_FIELDS, CELEBRATION_FIELDS, CRAFT_COLUMNS, CRAFT_FIELDS, CRAFT_KINDS, type CraftKind } from "@/lib/craft-config";
import { AuthorizationError, requireModule } from "@/lib/dal";
import { todayIn, zonedToUtc } from "@/lib/dates";
import { recordExpense } from "@/lib/expenses";
import { logActivity } from "@/lib/family";
import { deleteFamilyFile, saveUpload } from "@/lib/files";
import { parseFields } from "@/lib/record-fields";
import { f, saveRecordAccess, visibilityFromForm } from "@/lib/records";
import { SABBAT_ORDER } from "@/lib/sabbats";

const revalidateCraft = () => revalidatePath("/witchcraft", "layout");

async function ownItem(viewer: Awaited<ReturnType<typeof requireModule>>, id: string | null) {
  const it = id ? await getCraftItem(viewer, id) : null;
  if (!it || it.familyId !== viewer.family.id) throw new AuthorizationError("Only your family's own entries can be changed. Save a copy of a reference entry first.");
  if (!viewer.isParent && it.createdByMemberId !== viewer.member.id && it.visibility !== "family") throw new AuthorizationError("Only the author can change this entry.");
  return it;
}

// ─── Library items ───────────────────────────────────────────────────────────

export async function saveCraftItem(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("witchcraft", "edit");
    const kind = String(fd.get("kind")) as CraftKind;
    if (!CRAFT_KINDS.includes(kind)) return fail("Unknown type.");
    const { values, errors } = parseFields(fd, CRAFT_FIELDS[kind]);
    if (Object.keys(errors).length) return { ok: false, errors };
    const id = f.str(fd, "id");
    const old = id ? await ownItem(viewer, id) : null;
    const columns: Record<string, unknown> = {};
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) {
      if ((CRAFT_COLUMNS as readonly string[]).includes(k)) columns[k] = v;
      else if (v !== null && v !== "") fields[k] = Array.isArray(v) ? v.join(", ") : String(v);
    }
    const image = await saveUpload(viewer, fd.get("image"));
    const { visibility, memberIds } = visibilityFromForm(fd);
    const row = {
      ...columns,
      kind,
      fields,
      visibility,
      familyId: viewer.family.id,
      ...(fd.has("plantId") ? { plantId: await ownedPlant(viewer, f.str(fd, "plantId")) } : {}),
      ...(image ? { imageFileId: image } : fd.get("removeImage") === "1" ? { imageFileId: null } : {}),
    } as typeof craftItems.$inferInsert;
    let itemId = id;
    await db.transaction(async (tx) => {
      if (old) await tx.update(craftItems).set(row).where(eq(craftItems.id, old.id));
      else {
        const [r] = await tx.insert(craftItems).values({ ...row, createdByMemberId: viewer.member.id }).returning({ id: craftItems.id });
        itemId = r!.id;
      }
      await saveRecordAccess(tx, viewer.family.id, "craft_item", itemId!, memberIds);
      if (fd.has("supplyIds") || fd.has("supplyIdsField")) {
        const ids = f.list(fd, "supplyIds");
        await tx.delete(craftItemSupplies).where(eq(craftItemSupplies.itemId, itemId!));
        if (ids.length) {
          const valid = await tx.select({ id: inventoryItems.id }).from(inventoryItems).where(and(eq(inventoryItems.familyId, viewer.family.id), inArray(inventoryItems.id, ids)));
          if (valid.length) await tx.insert(craftItemSupplies).values(valid.map((v) => ({ itemId: itemId!, inventoryItemId: v.id })));
        }
      }
    });
    if (old?.imageFileId && (image || fd.get("removeImage") === "1")) await deleteFamilyFile(viewer.family.id, old.imageFileId);
    revalidateCraft();
    if (!old) redirect(`/witchcraft/item/${itemId}`);
    return ok("Saved.");
  });
}

async function ownedPlant(viewer: Awaited<ReturnType<typeof requireModule>>, id: string | null) {
  if (!id) return null;
  const [p] = await db.select({ id: plants.id, familyId: plants.familyId }).from(plants).where(eq(plants.id, id));
  return p && (p.familyId === null || p.familyId === viewer.family.id) ? p.id : null;
}

export async function deleteCraftItem(fd: FormData) {
  const viewer = await requireModule("witchcraft", "edit");
  const it = await ownItem(viewer, f.str(fd, "id"));
  await db.delete(craftItems).where(eq(craftItems.id, it.id));
  if (it.imageFileId) await deleteFamilyFile(viewer.family.id, it.imageFileId);
  revalidateCraft();
  redirect(`/witchcraft/library/${it.kind}`);
}

export async function toggleCraftFavorite(fd: FormData) {
  const viewer = await requireModule("witchcraft", "edit");
  const it = await ownItem(viewer, f.str(fd, "id"));
  await db.update(craftItems).set({ isFavorite: !it.isFavorite }).where(eq(craftItems.id, it.id));
  revalidateCraft();
}

/** Copy a built-in reference entry into the family's own library to customize it. */
export async function copyCraftItem(fd: FormData) {
  const viewer = await requireModule("witchcraft", "edit");
  const it = await getCraftItem(viewer, String(fd.get("id")));
  if (!it) throw new AuthorizationError("Not found.");
  const [r] = await db
    .insert(craftItems)
    .values({ ...it, id: undefined, familyId: viewer.family.id, createdByMemberId: viewer.member.id, visibility: "family", isFavorite: false, imageFileId: null, createdAt: undefined, updatedAt: undefined, source: it.source ?? "Reference library" })
    .returning({ id: craftItems.id });
  revalidateCraft();
  redirect(`/witchcraft/item/${r!.id}`);
}

/** Herb → garden: create a family plant from a herb entry and link them (no duplicate if already linked). */
export async function addHerbToGarden(fd: FormData) {
  const viewer = await requireModule("witchcraft", "edit");
  if (!viewer.can("garden", "edit")) throw new AuthorizationError("You can't edit the garden.");
  const it = await getCraftItem(viewer, String(fd.get("id")));
  if (!it || it.kind !== "herb") return;
  if (it.plantId) redirect(`/garden/plants/${it.plantId}`);
  const [p] = await db
    .insert(plants)
    .values({ familyId: viewer.family.id, name: it.name, category: "Herb", notes: [it.fields.growing, it.fields.safety ? `Safety: ${it.fields.safety}` : null].filter(Boolean).join("\n\n") || null })
    .returning({ id: plants.id });
  if (it.familyId === viewer.family.id) await db.update(craftItems).set({ plantId: p!.id }).where(eq(craftItems.id, it.id));
  revalidateCraft();
  revalidatePath("/garden", "layout");
  redirect(`/garden/plants/${p!.id}`);
}

// ─── Collection ──────────────────────────────────────────────────────────────

export async function saveCollectionEntry(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("witchcraft", "edit");
    const item = await getCraftItem(viewer, String(fd.get("itemId")));
    if (!item) return fail("Choose a crystal or tool.");
    const { values, errors } = parseFields(fd, COLLECTION_FIELDS);
    if (Object.keys(errors).length) return { ok: false, errors };
    const photo = await saveUpload(viewer, fd.get("photo"));
    const row = {
      familyId: viewer.family.id,
      itemId: item.id,
      status: (values.status as string) ?? "owned",
      quantity: Math.max(1, Math.round((values.quantity as number | null) ?? 1)),
      acquiredOn: values.acquiredOn as string | null,
      location: values.location as string | null,
      notes: values.notes as string | null,
      ...(photo ? { photoFileId: photo } : {}),
    };
    const id = f.str(fd, "id");
    if (id) {
      const [old] = await db.select().from(craftCollection).where(and(eq(craftCollection.id, id), eq(craftCollection.familyId, viewer.family.id)));
      if (!old) throw new AuthorizationError("Not found.");
      await db.update(craftCollection).set(row).where(eq(craftCollection.id, id));
      if (photo && old.photoFileId) await deleteFamilyFile(viewer.family.id, old.photoFileId);
    } else await db.insert(craftCollection).values(row);
    revalidateCraft();
    return ok("Saved to your collection.");
  });
}

export async function deleteCollectionEntry(fd: FormData) {
  const viewer = await requireModule("witchcraft", "edit");
  const [old] = await db.select().from(craftCollection).where(and(eq(craftCollection.id, String(fd.get("id"))), eq(craftCollection.familyId, viewer.family.id)));
  if (!old) return;
  await db.delete(craftCollection).where(eq(craftCollection.id, old.id));
  if (old.photoFileId) await deleteFamilyFile(viewer.family.id, old.photoFileId);
  revalidateCraft();
}

// ─── Supplies (shared inventory, location 'craft') ──────────────────────────

export async function saveCraftSupply(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("witchcraft", "edit");
    const name = f.str(fd, "name");
    if (!name) return fail("Name the supply.", "name");
    const row = {
      familyId: viewer.family.id,
      name,
      quantity: String(Math.max(0, f.num(fd, "quantity") ?? 1)),
      unit: f.str(fd, "unit"),
      lowStockThreshold: f.num(fd, "lowStockThreshold") === null ? null : String(f.num(fd, "lowStockThreshold")),
      spot: f.str(fd, "spot"),
      notes: f.str(fd, "notes"),
      expiresOn: f.date(fd, "expiresOn"),
      location: "craft" as const,
    };
    const id = f.str(fd, "id");
    if (id) {
      const n = await db.update(inventoryItems).set(row).where(and(eq(inventoryItems.id, id), eq(inventoryItems.familyId, viewer.family.id), eq(inventoryItems.location, "craft"))).returning({ id: inventoryItems.id });
      if (!n.length) throw new AuthorizationError("Not found.");
    } else await db.insert(inventoryItems).values(row);
    revalidateCraft();
    revalidatePath("/kitchen", "layout");
    return ok("Saved.");
  });
}

export async function adjustCraftSupply(fd: FormData) {
  const viewer = await requireModule("witchcraft", "edit");
  const [it] = await db.select().from(inventoryItems).where(and(eq(inventoryItems.id, String(fd.get("id"))), eq(inventoryItems.familyId, viewer.family.id), eq(inventoryItems.location, "craft")));
  if (!it) return;
  await db.update(inventoryItems).set({ quantity: String(Math.max(0, Number(it.quantity) + (Number(fd.get("delta")) || 0))) }).where(eq(inventoryItems.id, it.id));
  revalidateCraft();
}

export async function deleteCraftSupply(fd: FormData) {
  const viewer = await requireModule("witchcraft", "edit");
  await db.delete(inventoryItems).where(and(eq(inventoryItems.id, String(fd.get("id"))), eq(inventoryItems.familyId, viewer.family.id), eq(inventoryItems.location, "craft")));
  revalidateCraft();
}

/** Put supplies onto the main shopping list (skips ones already there). */
export async function shopForSupplies(fd: FormData) {
  const viewer = await requireModule("witchcraft", "edit");
  if (!viewer.can("shopping", "edit")) throw new AuthorizationError("You can't edit the shopping list.");
  const ids = f.list(fd, "ids").flatMap((s) => s.split(","));
  if (!ids.length) return;
  const items = await db.select().from(inventoryItems).where(and(eq(inventoryItems.familyId, viewer.family.id), inArray(inventoryItems.id, ids)));
  const listId = await mainShoppingListId(viewer.family.id);
  const have = await db.select({ sourceId: listItems.sourceId }).from(listItems).where(and(eq(listItems.listId, listId), eq(listItems.checked, false)));
  const skip = new Set(have.map((h) => h.sourceId));
  const rows = items.filter((i) => !skip.has(i.id)).map((i, n) => ({ listId, text: i.name, unit: i.unit, source: "low_stock" as const, sourceId: i.id, shoppingCategory: "household" as const, position: 950 + n }));
  if (rows.length) await db.insert(listItems).values(rows);
  revalidatePath("/shopping", "layout");
  revalidateCraft();
}

// ─── Wheel of the Year settings ─────────────────────────────────────────────

export async function saveSabbatSetting(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("witchcraft", "edit");
    const key = String(fd.get("key"));
    if (!(SABBAT_ORDER as string[]).includes(key)) return fail("Unknown sabbat.");
    const md = f.str(fd, "monthDay");
    if (md && !/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(md)) return fail("Use MM-DD, e.g. 10-31.", "monthDay");
    const values = { familyId: viewer.family.id, key, monthDay: md, notes: f.str(fd, "notes") };
    await db.insert(sabbatSettings).values(values).onConflictDoUpdate({ target: [sabbatSettings.familyId, sabbatSettings.key], set: values });
    revalidateCraft();
    revalidatePath("/calendar", "layout");
    return ok("Saved.");
  });
}

// ─── Celebrations ────────────────────────────────────────────────────────────

export async function saveCelebration(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("witchcraft", "edit");
    const { values, errors } = parseFields(fd, CELEBRATION_FIELDS);
    if (Object.keys(errors).length) return { ok: false, errors };
    const id = f.str(fd, "id");
    const [old] = id ? await db.select().from(celebrations).where(and(eq(celebrations.id, id), eq(celebrations.familyId, viewer.family.id))) : [];
    if (id && !old) throw new AuthorizationError("Not found.");
    const image = await saveUpload(viewer, fd.get("image"));
    const row = {
      ...(values as Record<string, unknown>),
      familyId: viewer.family.id,
      ...(image ? { imageFileId: image } : {}),
    } as typeof celebrations.$inferInsert;
    let cid = id;
    await db.transaction(async (tx) => {
      // One calendar event per celebration, kept in sync.
      const ev = { familyId: viewer.family.id, title: `🕯️ ${row.name}`, startsAt: zonedToUtc(row.date, "00:00", viewer.family.timezone), allDay: true, source: "celebration" as const, notes: row.notes ?? null, visibility: "family" as const };
      if (old) {
        if (old.calendarEventId) await tx.update(calendarEvents).set(ev).where(eq(calendarEvents.id, old.calendarEventId));
        await tx.update(celebrations).set(row).where(eq(celebrations.id, old.id));
      } else {
        const [c] = await tx.insert(celebrations).values({ ...row, createdByMemberId: viewer.member.id }).returning({ id: celebrations.id });
        cid = c!.id;
        if (viewer.can("calendar", "edit")) {
          const [e] = await tx.insert(calendarEvents).values({ ...ev, sourceId: cid, createdByMemberId: viewer.member.id }).returning({ id: calendarEvents.id });
          await tx.update(celebrations).set({ calendarEventId: e!.id }).where(eq(celebrations.id, cid!));
        }
      }
      if (fd.has("linksField")) {
        await tx.delete(celebrationLinks).where(and(eq(celebrationLinks.celebrationId, cid!)));
        const rids = f.list(fd, "recipeIds");
        const valid = rids.length ? await tx.select({ id: recipes.id }).from(recipes).where(and(eq(recipes.familyId, viewer.family.id), inArray(recipes.id, rids))) : [];
        const items = f.list(fd, "craftItemIds");
        const validItems = items.length ? (await Promise.all(items.map((i) => getCraftItem(viewer, i)))).filter(Boolean) : [];
        const links = [...valid.map((r) => ({ celebrationId: cid!, recipeId: r.id })), ...validItems.map((i) => ({ celebrationId: cid!, craftItemId: i!.id }))];
        if (links.length) await tx.insert(celebrationLinks).values(links);
      }
    });
    if (image && old?.imageFileId) await deleteFamilyFile(viewer.family.id, old.imageFileId);
    if (!old) await logActivity(db, viewer.family.id, viewer.member.id, "celebration.planned", `is planning ${row.name}`, { module: "witchcraft", entityId: cid! });
    revalidateCraft();
    revalidatePath("/calendar", "layout");
    if (!old) redirect(`/witchcraft/celebrations/${cid}`);
    return ok("Saved.");
  });
}

export async function deleteCelebration(fd: FormData) {
  const viewer = await requireModule("witchcraft", "edit");
  const [c] = await db.select().from(celebrations).where(and(eq(celebrations.id, String(fd.get("id"))), eq(celebrations.familyId, viewer.family.id)));
  if (!c) return;
  if (c.calendarEventId) await db.delete(calendarEvents).where(eq(calendarEvents.id, c.calendarEventId));
  await db.delete(celebrations).where(eq(celebrations.id, c.id));
  if (c.imageFileId) await deleteFamilyFile(viewer.family.id, c.imageFileId);
  revalidateCraft();
  revalidatePath("/calendar", "layout");
  redirect("/witchcraft/celebrations");
}

/** Send the celebration's supplies to its own shopping list (created once, reused after). */
export async function celebrationShoppingList(fd: FormData) {
  const viewer = await requireModule("witchcraft", "edit");
  if (!viewer.can("shopping", "edit")) throw new AuthorizationError("You can't edit shopping lists.");
  const [c] = await db.select().from(celebrations).where(and(eq(celebrations.id, String(fd.get("id"))), eq(celebrations.familyId, viewer.family.id)));
  if (!c) return;
  let listId = c.shoppingListId;
  if (!listId) {
    const [l] = await db.insert(lists).values({ familyId: viewer.family.id, title: `${c.name} shopping`, kind: "shopping", createdByMemberId: viewer.member.id }).returning({ id: lists.id });
    listId = l!.id;
    await db.update(celebrations).set({ shoppingListId: listId }).where(eq(celebrations.id, c.id));
  }
  const existing = new Set((await db.select({ text: listItems.text }).from(listItems).where(eq(listItems.listId, listId))).map((r) => r.text.toLowerCase()));
  const lines = (c.supplies ?? "")
    .split(/\n|,/)
    .map((s) => s.replace(/^[-*•]\s*/, "").trim())
    .filter((s) => s && !existing.has(s.toLowerCase()));
  if (lines.length) await db.insert(listItems).values(lines.map((text, i) => ({ listId: listId!, text, position: i, shoppingCategory: "household" as const })));
  revalidateCraft();
  revalidatePath("/shopping", "layout");
  revalidatePath("/lists", "layout");
  redirect(`/shopping/${listId}`);
}

export async function recordCelebrationExpense(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("witchcraft", "edit");
    if (!viewer.can("budget", "edit")) return fail("You can't edit the budget.");
    const [c] = await db.select().from(celebrations).where(and(eq(celebrations.id, String(fd.get("id"))), eq(celebrations.familyId, viewer.family.id)));
    if (!c) return fail("Not found.");
    const cents = f.cents(fd, "amount");
    if (!cents || cents <= 0) return fail("Enter an amount.", "amount");
    await recordExpense(viewer, { name: `${c.name}: ${f.str(fd, "what") ?? "supplies"}`, amountCents: cents, date: f.date(fd, "date") ?? todayIn(viewer.family.timezone), categoryName: "Celebrations", celebrationId: c.id });
    revalidateCraft();
    revalidatePath("/budget", "layout");
    return ok("Expense recorded.");
  });
}

// ─── Grimoire (journal entries in the 'grimoire' book) ──────────────────────

export async function saveGrimoireEntry(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("witchcraft", "edit");
    const body = f.str(fd, "body");
    if (!body) return fail("Write something first.", "body");
    const { visibility, memberIds } = visibilityFromForm(fd);
    const linked = f.str(fd, "linkedId");
    const values = {
      familyId: viewer.family.id,
      date: f.date(fd, "date") ?? todayIn(viewer.family.timezone),
      title: f.str(fd, "title"),
      body,
      book: "grimoire",
      category: f.str(fd, "category"),
      moonPhase: f.str(fd, "moonPhase"),
      tags: f.split(fd, "tags").slice(0, 20),
      linkedId: linked && (await getCraftItem(viewer, linked)) ? linked : null,
      visibility,
    };
    const id = f.str(fd, "id");
    await db.transaction(async (tx) => {
      let eid = id;
      if (id) {
        const [old] = await tx.select().from(journalEntries).where(and(eq(journalEntries.id, id), eq(journalEntries.familyId, viewer.family.id), eq(journalEntries.book, "grimoire")));
        if (!old || old.authorMemberId !== viewer.member.id) throw new AuthorizationError("Only the author can edit this entry.");
        await tx.update(journalEntries).set(values).where(eq(journalEntries.id, id));
      } else {
        const [r] = await tx.insert(journalEntries).values({ ...values, authorMemberId: viewer.member.id }).returning({ id: journalEntries.id });
        eid = r!.id;
      }
      await saveRecordAccess(tx, viewer.family.id, "journal_entry", eid!, memberIds);
    });
    revalidateCraft();
    return ok("Saved to your grimoire.");
  });
}

export async function toggleGrimoireFavorite(fd: FormData) {
  const viewer = await requireModule("witchcraft", "edit");
  const [e] = await db.select().from(journalEntries).where(and(eq(journalEntries.id, String(fd.get("id"))), eq(journalEntries.familyId, viewer.family.id), eq(journalEntries.book, "grimoire")));
  if (!e || e.authorMemberId !== viewer.member.id) return;
  await db.update(journalEntries).set({ isFavorite: !e.isFavorite }).where(eq(journalEntries.id, e.id));
  revalidateCraft();
}

export async function deleteGrimoireEntry(fd: FormData) {
  const viewer = await requireModule("witchcraft", "edit");
  const [e] = await db.select().from(journalEntries).where(and(eq(journalEntries.id, String(fd.get("id"))), eq(journalEntries.familyId, viewer.family.id), eq(journalEntries.book, "grimoire")));
  if (!e || e.authorMemberId !== viewer.member.id) throw new AuthorizationError("Only the author can delete this entry.");
  await db.delete(journalEntries).where(eq(journalEntries.id, e.id));
  revalidateCraft();
}

