import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, familyMembers, listItems, lists, recurrenceRules } from "@/db/schema";
import { AuthorizationError, visibleTo, type Viewer } from "./dal";
import { describeRule, type Rule } from "./recurrence";

type Kind = (typeof lists.$inferSelect)["kind"];
export const listModule = (kind: Kind) => (kind === "shopping" ? "shopping" : "lists");

/** Load a list the viewer can see; optionally require edit rights on its module. */
export async function loadList(viewer: Viewer, id: string, edit = false) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new AuthorizationError("List not found.");
  const [l] = await db
    .select()
    .from(lists)
    .where(
      and(
        eq(lists.id, id),
        eq(lists.familyId, viewer.family.id),
        visibleTo(viewer, { id: lists.id, visibility: lists.visibility, author: lists.createdByMemberId }, "list"),
      ),
    );
  if (!l) throw new AuthorizationError("List not found.");
  if (!viewer.can(listModule(l.kind), edit ? "edit" : "view") && !(l.createdByMemberId === viewer.member.id)) {
    throw new AuthorizationError("You don't have access to that list.");
  }
  return l;
}

export async function loadListItems(listId: string) {
  const rows = await db
    .select({ item: listItems, rule: recurrenceRules })
    .from(listItems)
    .leftJoin(recurrenceRules, eq(recurrenceRules.id, listItems.recurrenceRuleId))
    .where(eq(listItems.listId, listId))
    .orderBy(asc(listItems.position), asc(listItems.createdAt));
  return rows.map(({ item, rule }) => ({
    id: item.id,
    text: item.text,
    checked: item.checked,
    dueDate: item.dueDate,
    priority: item.priority,
    assigneeId: item.assigneeId,
    quantity: item.quantity,
    unit: item.unit,
    shoppingCategory: item.shoppingCategory,
    store: item.store,
    notes: item.notes,
    source: item.source,
    recurring: rule ? describeRule(rule as unknown as Rule) : null,
    rule: rule
      ? { freq: rule.freq, interval: rule.interval, byWeekday: rule.byWeekday, byMonthDay: rule.byMonthDay, byMonth: rule.byMonth, until: rule.until }
      : null,
  }));
}

/** Lists index with open/total counts. */
export async function listIndex(viewer: Viewer, kinds: Kind[], opts: { archived?: boolean } = {}) {
  return db
    .select({
      id: lists.id,
      title: lists.title,
      kind: lists.kind,
      store: lists.store,
      visibility: lists.visibility,
      categoryName: categories.name,
      categoryId: lists.categoryId,
      updatedAt: lists.updatedAt,
      ownerName: familyMembers.displayName,
      open: sql<number>`(select count(*)::int from ${listItems} i where i.list_id = ${lists.id} and not i.checked)`,
      total: sql<number>`(select count(*)::int from ${listItems} i where i.list_id = ${lists.id})`,
      preview: sql<string[]>`coalesce((select array_agg(t.text) from (select i.text from ${listItems} i where i.list_id = ${lists.id} and not i.checked order by i.position limit 4) t), '{}')`,
    })
    .from(lists)
    .leftJoin(categories, eq(categories.id, lists.categoryId))
    .leftJoin(familyMembers, eq(familyMembers.id, lists.createdByMemberId))
    .where(
      and(
        eq(lists.familyId, viewer.family.id),
        inArray(lists.kind, kinds),
        opts.archived ? isNotNull(lists.archivedAt) : isNull(lists.archivedAt),
        visibleTo(viewer, { id: lists.id, visibility: lists.visibility, author: lists.createdByMemberId }, "list"),
      ),
    )
    .orderBy(desc(lists.updatedAt));
}
