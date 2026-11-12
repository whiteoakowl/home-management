"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { listItems, lists, recurrenceRules, shoppingCategory } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { AuthorizationError, getViewer, type Viewer } from "@/lib/dal";
import { listModule, loadList } from "@/lib/lists";
import { todayIn } from "@/lib/dates";
import { logActivity } from "@/lib/family";
import { ownedCategoryId } from "@/lib/queries";
import { f, familyMemberIdOrNull, saveRecordAccess, upsertRule, visibilityFromForm } from "@/lib/records";
import { nextOccurrence, ruleFromForm, type Rule } from "@/lib/recurrence";
import { addDays } from "@/lib/dates";

const KINDS = ["checklist", "bullet", "numbered", "todo", "shopping"] as const;
type Kind = (typeof KINDS)[number];
const SHOP_CATS = shoppingCategory.enumValues;

function revalidateLists(kind?: Kind) {
  revalidatePath(kind === "shopping" ? "/shopping" : "/lists", "layout");
  revalidatePath("/");
}

export async function saveList(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await getViewer();
    const id = f.str(fd, "id");
    const kind = (f.str(fd, "kind") ?? "checklist") as Kind;
    if (!KINDS.includes(kind)) return fail("Choose a list type.", "kind");
    if (!viewer.can(listModule(kind), "edit")) throw new AuthorizationError("You can't create lists.");
    const title = f.str(fd, "title");
    if (!title) return fail("Give the list a name.", "title");
    const { visibility, memberIds } = visibilityFromForm(fd);
    const values = { title, kind, store: f.str(fd, "store"), visibility, categoryId: await ownedCategoryId(viewer, "list", f.str(fd, "categoryId")) };
    let listId = id;
    await db.transaction(async (tx) => {
      if (id) {
        await loadList(viewer, id, true);
        await tx.update(lists).set(values).where(eq(lists.id, id));
      } else {
        const [row] = await tx.insert(lists).values({ ...values, familyId: viewer.family.id, createdByMemberId: viewer.member.id }).returning({ id: lists.id });
        listId = row!.id;
      }
      await saveRecordAccess(tx, viewer.family.id, "list", listId!, memberIds);
    });
    revalidateLists(kind);
    if (!id) redirect(`${kind === "shopping" ? "/shopping" : "/lists"}/${listId}`);
    return ok("Saved.");
  });
}

export async function archiveList(fd: FormData) {
  const viewer = await getViewer();
  const l = await loadList(viewer, String(fd.get("id")), true);
  await db.update(lists).set({ archivedAt: l.archivedAt ? null : new Date() }).where(eq(lists.id, l.id));
  revalidateLists(l.kind);
  if (!l.archivedAt) redirect(l.kind === "shopping" ? "/shopping" : "/lists");
}

export async function deleteList(fd: FormData) {
  const viewer = await getViewer();
  const l = await loadList(viewer, String(fd.get("id")), true);
  await db.delete(lists).where(eq(lists.id, l.id));
  revalidateLists(l.kind);
  redirect(l.kind === "shopping" ? "/shopping" : "/lists");
}

async function itemValues(viewer: Viewer, fd: FormData, kind: Kind) {
  const cat = f.str(fd, "shoppingCategory");
  return {
    text: f.str(fd, "text") ?? "",
    dueDate: kind === "todo" ? f.date(fd, "dueDate") : null,
    priority: kind === "todo" && ["low", "normal", "high"].includes(f.str(fd, "priority") ?? "") ? (f.str(fd, "priority") as "low" | "normal" | "high") : null,
    assigneeId: kind === "todo" || kind === "checklist" ? await familyMemberIdOrNull(viewer.family.id, f.str(fd, "assigneeId")) : null,
    quantity: kind === "shopping" && f.num(fd, "quantity") !== null ? String(f.num(fd, "quantity")) : null,
    unit: kind === "shopping" ? f.str(fd, "unit") : null,
    shoppingCategory: kind === "shopping" ? ((SHOP_CATS as readonly string[]).includes(cat ?? "") ? (cat as (typeof SHOP_CATS)[number]) : guessShoppingCategory(f.str(fd, "text") ?? "")) : null,
    store: kind === "shopping" ? f.str(fd, "store") : null,
    notes: f.str(fd, "notes"),
  };
}

export async function addItem(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await getViewer();
    const l = await loadList(viewer, String(fd.get("listId")));
    if (!viewer.can(listModule(l.kind), "edit") && l.createdByMemberId !== viewer.member.id) throw new AuthorizationError("You can only check items on this list.");
    // Allow pasting several lines at once.
    const lines = String(fd.get("text") ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 100);
    if (!lines.length) return fail("Type something to add.", "text");
    const base = await itemValues(viewer, fd, l.kind);
    const [{ max } = { max: 0 }] = await db.select({ max: sql<number>`coalesce(max(${listItems.position}),0)::int` }).from(listItems).where(eq(listItems.listId, l.id));
    let ruleId: string | null = null;
    if (l.kind === "todo") {
      const rule = ruleFromForm(fd, base.dueDate ?? todayIn(viewer.family.timezone));
      ruleId = await upsertRule(db, viewer.family.id, rule);
    }
    await db.insert(listItems).values(
      lines.map((text, i) => ({
        ...base,
        text: text.slice(0, 300),
        shoppingCategory: l.kind === "shopping" && !f.str(fd, "shoppingCategory") ? guessShoppingCategory(text) : base.shoppingCategory,
        listId: l.id,
        position: max + 1 + i,
        recurrenceRuleId: ruleId,
      })),
    );
    revalidateLists(l.kind);
    return ok();
  });
}

export async function updateItem(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await getViewer();
    const [item] = await db.select().from(listItems).where(eq(listItems.id, String(fd.get("id"))));
    if (!item) return fail("Item not found.");
    const l = await loadList(viewer, item.listId, true);
    const values = await itemValues(viewer, fd, l.kind);
    if (!values.text) return fail("Item can't be empty.", "text");
    let ruleId = item.recurrenceRuleId;
    if (l.kind === "todo") ruleId = await upsertRule(db, viewer.family.id, ruleFromForm(fd, values.dueDate ?? todayIn(viewer.family.timezone)), item.recurrenceRuleId);
    await db.update(listItems).set({ ...values, recurrenceRuleId: ruleId }).where(eq(listItems.id, item.id));
    revalidateLists(l.kind);
    return ok();
  });
}

/** Check/uncheck. Recurring to-dos roll forward to their next date instead. */
export async function toggleItem(fd: FormData) {
  const viewer = await getViewer();
  const [item] = await db.select().from(listItems).where(eq(listItems.id, String(fd.get("id"))));
  if (!item) return;
  const l = await loadList(viewer, item.listId);
  const done = fd.get("done") === "true";

  if (done && item.recurrenceRuleId) {
    const [rule] = await db.select().from(recurrenceRules).where(eq(recurrenceRules.id, item.recurrenceRuleId));
    const from = addDays(item.dueDate ?? todayIn(viewer.family.timezone), 1);
    const next = rule ? nextOccurrence(rule as unknown as Rule, from) : null;
    if (next) {
      await db.update(listItems).set({ dueDate: next, checked: false, checkedAt: new Date(), checkedByMemberId: viewer.member.id }).where(eq(listItems.id, item.id));
      revalidateLists(l.kind);
      return;
    }
  }
  await db
    .update(listItems)
    .set(done ? { checked: true, checkedAt: new Date(), checkedByMemberId: viewer.member.id } : { checked: false, checkedAt: null, checkedByMemberId: null })
    .where(eq(listItems.id, item.id));
  if (done && l.kind === "shopping") {
    await logActivity(db, viewer.family.id, viewer.member.id, "shopping.purchased", `picked up ${item.text}`, { module: "shopping" });
  }
  revalidateLists(l.kind);
}

export async function deleteItem(fd: FormData) {
  const viewer = await getViewer();
  const [item] = await db.select().from(listItems).where(eq(listItems.id, String(fd.get("id"))));
  if (!item) return;
  const l = await loadList(viewer, item.listId, true);
  await db.delete(listItems).where(eq(listItems.id, item.id));
  revalidateLists(l.kind);
}

export async function moveItem(fd: FormData) {
  const viewer = await getViewer();
  const [item] = await db.select().from(listItems).where(eq(listItems.id, String(fd.get("id"))));
  if (!item) return;
  const l = await loadList(viewer, item.listId, true);
  const up = fd.get("dir") === "up";
  const [neighbor] = await db
    .select()
    .from(listItems)
    .where(and(eq(listItems.listId, l.id), up ? lt(listItems.position, item.position) : gt(listItems.position, item.position)))
    .orderBy(up ? desc(listItems.position) : asc(listItems.position))
    .limit(1);
  if (!neighbor) return;
  await db.transaction(async (tx) => {
    await tx.update(listItems).set({ position: neighbor.position }).where(eq(listItems.id, item.id));
    await tx.update(listItems).set({ position: item.position }).where(eq(listItems.id, neighbor.id));
  });
  revalidateLists(l.kind);
}

export async function clearChecked(fd: FormData) {
  const viewer = await getViewer();
  const l = await loadList(viewer, String(fd.get("id")), true);
  await db.delete(listItems).where(and(eq(listItems.listId, l.id), eq(listItems.checked, true)));
  revalidateLists(l.kind);
}

/** Very small keyword classifier for shopping aisles. */
function guessShoppingCategory(text: string): (typeof SHOP_CATS)[number] {
  const t = text.toLowerCase();
  const has = (words: string[]) => words.some((w) => t.includes(w));
  if (has(["apple", "banana", "lettuce", "tomato", "onion", "potato", "carrot", "berr", "fruit", "pepper", "garlic", "lemon", "lime", "spinach", "avocado", "herb", "cucumber", "celery"])) return "produce";
  if (has(["chicken", "beef", "pork", "turkey", "bacon", "sausage", "fish", "salmon", "steak", "ham", "ground"])) return "meat";
  if (has(["milk", "cheese", "yogurt", "butter", "cream", "egg"])) return "dairy";
  if (has(["frozen", "ice cream", "peas"])) return "frozen";
  if (has(["soap", "detergent", "paper towel", "toilet", "trash bag", "sponge", "bleach", "foil", "wrap"])) return "household";
  if (has(["shampoo", "toothpaste", "deodorant", "razor", "lotion", "vitamin"])) return "personal";
  if (has(["seed", "soil", "mulch", "fertilizer", "compost"])) return "garden";
  if (has(["feed", "hay", "straw", "bedding", "layer pellet", "scratch"])) return "farm";
  if (has(["flour", "sugar", "rice", "pasta", "bean", "oil", "salt", "cereal", "bread", "sauce", "spice", "oat", "can", "coffee", "tea"])) return "pantry";
  return "other";
}
