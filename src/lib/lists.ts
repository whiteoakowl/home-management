import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, familyMembers, listItems, lists, recurrenceRules } from "@/db/schema";
import { AuthorizationError, visibleTo, type Viewer } from "./dal";
import { canPeekFood } from "./food-space";
import { describeRule, type Rule } from "./recurrence";

type Kind = (typeof lists.$inferSelect)["kind"];
export const listModule = (kind: Kind) => (kind === "shopping" ? "shopping" : "lists");

/**
 * Load a list the viewer can see; optionally require the right to change it.
 * Private-space lists (owner_member_id) belong to their owner; a parent may
 * open them read-only when the family allows it.
 */
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
  if (l.ownerMemberId) {
    if (l.ownerMemberId === viewer.member.id) return l;
    if (!edit && canPeekFood(viewer, l.ownerMemberId)) return l;
    throw new AuthorizationError("List not found.");
  }
  const mine = l.createdByMemberId === viewer.member.id;
  const mod = listModule(l.kind);
  // Changing a list (rename, archive, delete, edit items): parents with access, or whoever created it.
  const allowed = edit ? (viewer.isParent && viewer.can(mod, "edit")) || mine : viewer.can(mod, "view") || mine;
  if (!allowed) throw new AuthorizationError("You don't have access to that list.");
  return l;
}

/** May the viewer add items to this list (and tick them off)? */
export function canAddToList(viewer: Viewer, l: { kind: Kind; ownerMemberId: string | null; createdByMemberId: string | null }) {
  if (l.ownerMemberId) return l.ownerMemberId === viewer.member.id;
  return viewer.can(listModule(l.kind), "add") || l.createdByMemberId === viewer.member.id;
}

/**
 * Personal shopping items (personal_for_member_id set) are seen only by parents,
 * the person they're for and whoever added them. Everyone else never sees them.
 */
export function itemVisible(viewer: Viewer) {
  if (viewer.isParent) return sql`true`;
  return or(isNull(listItems.personalForMemberId), eq(listItems.personalForMemberId, viewer.member.id), eq(listItems.addedByMemberId, viewer.member.id))!;
}

/** Raw-SQL version of {@link itemVisible} for a list_items row aliased `i`. */
export function itemVisibleRaw(viewer: Viewer) {
  if (viewer.isParent) return sql`true`;
  return sql`(i.personal_for_member_id is null or i.personal_for_member_id = ${viewer.member.id} or i.added_by_member_id = ${viewer.member.id})`;
}

/** May the viewer see (and so change) this single item? */
export function canSeeItem(viewer: Viewer, item: { personalForMemberId: string | null; addedByMemberId: string | null }) {
  return !item.personalForMemberId || viewer.isParent || item.personalForMemberId === viewer.member.id || item.addedByMemberId === viewer.member.id;
}

export async function loadListItems(listId: string, viewer: Viewer) {
  const rows = await db
    .select({ item: listItems, rule: recurrenceRules, forName: familyMembers.displayName })
    .from(listItems)
    .leftJoin(recurrenceRules, eq(recurrenceRules.id, listItems.recurrenceRuleId))
    .leftJoin(familyMembers, eq(familyMembers.id, listItems.personalForMemberId))
    .where(and(eq(listItems.listId, listId), itemVisible(viewer)))
    .orderBy(asc(listItems.position), asc(listItems.createdAt));
  return rows.map(({ item, rule, forName }) => ({
    id: item.id,
    personalFor: item.personalForMemberId ? { id: item.personalForMemberId, name: forName ?? "Someone" } : null,
    mine: item.addedByMemberId === viewer.member.id || item.personalForMemberId === viewer.member.id,
    text: item.text,
    checked: item.checked,
    dueDate: item.dueDate,
    priority: item.priority,
    assigneeId: item.assigneeId,
    quantity: item.quantity,
    unit: item.unit,
    shoppingCategory: item.shoppingCategory,
    store: item.store,
    priceCents: item.priceCents,
    notes: item.notes,
    source: item.source,
    recurring: rule ? describeRule(rule as unknown as Rule) : null,
    rule: rule
      ? { freq: rule.freq, interval: rule.interval, byWeekday: rule.byWeekday, byMonthDay: rule.byMonthDay, byMonth: rule.byMonth, until: rule.until }
      : null,
  }));
}

/**
 * Frequently bought items (from every shopping list) that aren't open on this
 * list, for one-tap re-adding. Most recent price is remembered.
 */
export async function frequentItems(familyId: string, listId: string, limit = 14) {
  const rows = await db.execute<{ text: string; n: number }>(sql`
    select min(i.text) as text, count(*)::int as n
    from list_items i join lists l on l.id = i.list_id
    where l.family_id = ${familyId} and l.kind = 'shopping'
      and l.owner_member_id is not distinct from (select owner_member_id from lists where id = ${listId})
      and i.personal_for_member_id is null
      and lower(i.text) not in (select lower(text) from list_items where list_id = ${listId} and not checked)
    group by lower(i.text)
    order by count(*) desc, max(i.created_at) desc
    limit ${limit}`);
  return rows.rows;
}

/** Lists index with open/total counts. */
export async function listIndex(viewer: Viewer, kinds: Kind[], opts: { archived?: boolean; owner?: string | null } = {}) {
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
      open: sql<number>`(select count(*)::int from ${listItems} i where i.list_id = ${lists.id} and not i.checked and ${itemVisibleRaw(viewer)})`,
      total: sql<number>`(select count(*)::int from ${listItems} i where i.list_id = ${lists.id} and ${itemVisibleRaw(viewer)})`,
      preview: sql<string[]>`coalesce((select array_agg(t.text) from (select i.text from ${listItems} i where i.list_id = ${lists.id} and not i.checked and ${itemVisibleRaw(viewer)} order by i.position limit 4) t), '{}')`,
    })
    .from(lists)
    .leftJoin(categories, eq(categories.id, lists.categoryId))
    .leftJoin(familyMembers, eq(familyMembers.id, lists.createdByMemberId))
    .where(
      and(
        eq(lists.familyId, viewer.family.id),
        inArray(lists.kind, kinds),
        opts.archived ? isNotNull(lists.archivedAt) : isNull(lists.archivedAt),
        opts.owner ? eq(lists.ownerMemberId, opts.owner) : isNull(lists.ownerMemberId),
        visibleTo(viewer, { id: lists.id, visibility: lists.visibility, author: lists.createdByMemberId }, "list"),
      ),
    )
    .orderBy(desc(lists.updatedAt));
}
