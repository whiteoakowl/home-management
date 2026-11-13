import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  categories,
  choreChecklistItems,
  choreOccurrenceItems,
  choreOccurrences,
  chores,
  familyMembers,
  recurrenceRules,
  rooms,
} from "@/db/schema";
import type { Viewer } from "./dal";
import { nextOccurrence, type Rule } from "./recurrence";

export type ChoreKind = (typeof chores.$inferSelect)["kind"];

/** Module that governs a chore kind. */
export const kindModule = (kind: ChoreKind) => (kind === "cleaning" ? "house" : kind === "maintenance" ? "maintenance" : "chores");

/**
 * Members without module access still see work assigned to them
 * (permission layer 4). Returns a filter on occurrences.
 */
function accessFilter(viewer: Viewer, kinds: ChoreKind[]): SQL | undefined {
  const modules = new Set(kinds.map(kindModule));
  const canAll = [...modules].every((m) => viewer.can(m));
  if (canAll) return undefined;
  return or(
    eq(choreOccurrences.assigneeId, viewer.member.id),
    inArray(
      choreOccurrences.id,
      db.select({ id: choreOccurrenceItems.occurrenceId }).from(choreOccurrenceItems).where(eq(choreOccurrenceItems.assigneeId, viewer.member.id)),
    ),
  );
}

export async function listOccurrences(
  viewer: Viewer,
  opts: {
    kinds: ChoreKind[];
    from?: string;
    to?: string;
    statuses?: ("pending" | "done" | "skipped" | "missed")[];
    assigneeId?: string;
    choreId?: string;
    petIds?: string[];
    projectId?: string;
    order?: "asc" | "desc";
    limit?: number;
  },
) {
  const assignee = alias(familyMembers, "assignee");
  const completer = alias(familyMembers, "completer");
  const rows = await db
    .select({
      id: choreOccurrences.id,
      choreId: chores.id,
      kind: chores.kind,
      title: chores.title,
      instructions: chores.instructions,
      priority: chores.priority,
      estimatedMinutes: chores.estimatedMinutes,
      roomName: rooms.name,
      categoryName: categories.name,
      dueDate: choreOccurrences.dueDate,
      status: choreOccurrences.status,
      completedAt: choreOccurrences.completedAt,
      actualCostCents: choreOccurrences.actualCostCents,
      estimatedCostCents: chores.estimatedCostCents,
      points: chores.points,
      assigneeId: choreOccurrences.assigneeId,
      assigneeName: assignee.displayName,
      assigneeColor: assignee.color,
      completedByName: completer.displayName,
    })
    .from(choreOccurrences)
    .innerJoin(chores, eq(chores.id, choreOccurrences.choreId))
    .leftJoin(rooms, eq(rooms.id, chores.roomId))
    .leftJoin(categories, eq(categories.id, chores.categoryId))
    .leftJoin(assignee, eq(assignee.id, choreOccurrences.assigneeId))
    .leftJoin(completer, eq(completer.id, choreOccurrences.completedByMemberId))
    .where(
      and(
        eq(choreOccurrences.familyId, viewer.family.id),
        inArray(chores.kind, opts.kinds),
        opts.from ? gte(choreOccurrences.dueDate, opts.from) : undefined,
        opts.to ? lte(choreOccurrences.dueDate, opts.to) : undefined,
        opts.statuses ? inArray(choreOccurrences.status, opts.statuses) : undefined,
        opts.choreId ? eq(choreOccurrences.choreId, opts.choreId) : undefined,
        opts.petIds ? (opts.petIds.length ? inArray(chores.petId, opts.petIds) : sql`false`) : undefined,
        opts.projectId ? eq(chores.projectId, opts.projectId) : undefined,
        opts.assigneeId
          ? or(
              eq(choreOccurrences.assigneeId, opts.assigneeId),
              inArray(
                choreOccurrences.id,
                db.select({ id: choreOccurrenceItems.occurrenceId }).from(choreOccurrenceItems).where(eq(choreOccurrenceItems.assigneeId, opts.assigneeId)),
              ),
            )
          : undefined,
        accessFilter(viewer, opts.kinds),
      ),
    )
    .orderBy(
      opts.order === "desc" ? desc(choreOccurrences.dueDate) : asc(choreOccurrences.dueDate),
      sql`case ${chores.priority} when 'high' then 0 when 'normal' then 1 else 2 end`,
      asc(chores.title),
    )
    .limit(opts.limit ?? 300);

  const itemAssignee = alias(familyMembers, "item_assignee");
  const items = rows.length
    ? await db
        .select({
          id: choreOccurrenceItems.id,
          occurrenceId: choreOccurrenceItems.occurrenceId,
          text: choreOccurrenceItems.text,
          completedAt: choreOccurrenceItems.completedAt,
          assigneeId: choreOccurrenceItems.assigneeId,
          assigneeName: itemAssignee.displayName,
          assigneeColor: itemAssignee.color,
        })
        .from(choreOccurrenceItems)
        .leftJoin(itemAssignee, eq(itemAssignee.id, choreOccurrenceItems.assigneeId))
        .where(inArray(choreOccurrenceItems.occurrenceId, rows.map((r) => r.id)))
        .orderBy(asc(choreOccurrenceItems.position))
    : [];
  const byOcc = Map.groupBy(items, (i) => i.occurrenceId);
  return rows.map((r) => ({ ...r, items: byOcc.get(r.id) ?? [] }));
}

export type Occurrence = Awaited<ReturnType<typeof listOccurrences>>[number];

/** Chore templates with their schedule, checklist and last/next dates. */
export async function listChoreTemplates(viewer: Viewer, kinds: ChoreKind[], today: string, opts: { choreId?: string } = {}) {
  const assignee = alias(familyMembers, "assignee");
  const rows = await db
    .select({
      chore: chores,
      rule: recurrenceRules,
      roomName: rooms.name,
      categoryName: categories.name,
      assigneeName: assignee.displayName,
      assigneeColor: assignee.color,
      nextDue: sql<string | null>`(select min(o.due_date) from chore_occurrences o where o.chore_id = ${chores.id} and o.status = 'pending' and o.due_date >= ${today})`,
      lastDone: sql<string | null>`(select max(o.completed_at)::text from chore_occurrences o where o.chore_id = ${chores.id} and o.status = 'done')`,
      doneCount: sql<number>`(select count(*)::int from chore_occurrences o where o.chore_id = ${chores.id} and o.status = 'done')`,
      missedCount: sql<number>`(select count(*)::int from chore_occurrences o where o.chore_id = ${chores.id} and o.status = 'missed')`,
    })
    .from(chores)
    .leftJoin(recurrenceRules, eq(recurrenceRules.id, chores.recurrenceRuleId))
    .leftJoin(rooms, eq(rooms.id, chores.roomId))
    .leftJoin(categories, eq(categories.id, chores.categoryId))
    .leftJoin(assignee, eq(assignee.id, chores.defaultAssigneeId))
    .where(
      and(
        eq(chores.familyId, viewer.family.id),
        inArray(chores.kind, kinds),
        isNull(chores.archivedAt),
        opts.choreId ? eq(chores.id, opts.choreId) : undefined,
      ),
    )
    .orderBy(asc(chores.title));
  const checklist = rows.length
    ? await db
        .select()
        .from(choreChecklistItems)
        .where(inArray(choreChecklistItems.choreId, rows.map((r) => r.chore.id)))
        .orderBy(asc(choreChecklistItems.position))
    : [];
  const byChore = Map.groupBy(checklist, (c) => c.choreId);
  return rows.map((r) => {
    const rule = r.rule as (Rule & { id: string }) | null;
    // Beyond the 14-day materialisation window, compute the next date from the schedule.
    const nextDue = r.nextDue ?? (rule ? nextOccurrence(rule, today) : r.chore.dueDate && r.chore.dueDate >= today ? r.chore.dueDate : null);
    return { ...r, nextDue, rule, checklist: byChore.get(r.chore.id) ?? [] };
  });
}

export type ChoreTemplate = Awaited<ReturnType<typeof listChoreTemplates>>[number];
