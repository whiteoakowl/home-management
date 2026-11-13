import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  activityLog,
  animalHealthRecords,
  animals,
  announcements,
  calendarEvents,
  choreOccurrences,
  chores,
  eventAttendees,
  familyMembers,
  gardenPlantings,
  goals,
  inventoryItems,
  journalEntries,
  listItems,
  lists,
  mealPlanEntries,
  plants,
  productionLogs,
  recipes,
  transactions,
  workoutLogs,
} from "@/db/schema";
import { addDays, todayIn } from "./dates";
import { visibleTo, type Viewer } from "./dal";
import { canViewFitness } from "./fitness";

/**
 * Dashboard queries. Every function filters by the viewer's family and
 * respects visibility. `subjectId` narrows to one member (portal view).
 */
export type Scope = { viewer: Viewer; subjectId?: string; today: string };

export function makeScope(viewer: Viewer, subjectId?: string): Scope {
  return { viewer, subjectId, today: todayIn(viewer.family.timezone) };
}

const fid = (s: Scope) => s.viewer.family.id;

export async function getChoreSummary(s: Scope, kind: "chore" | "task" = "chore") {
  const assignee = alias(familyMembers, "assignee");
  const kindFilter = kind === "task" ? eq(chores.kind, "task") : ne(chores.kind, "task");
  const rows = await db
    .select({
      id: choreOccurrences.id,
      title: chores.title,
      dueDate: choreOccurrences.dueDate,
      status: choreOccurrences.status,
      priority: chores.priority,
      estimatedMinutes: chores.estimatedMinutes,
      assigneeName: assignee.displayName,
      assigneeColor: assignee.color,
    })
    .from(choreOccurrences)
    .innerJoin(chores, eq(chores.id, choreOccurrences.choreId))
    .leftJoin(assignee, eq(assignee.id, choreOccurrences.assigneeId))
    .where(
      and(
        eq(choreOccurrences.familyId, fid(s)),
        kindFilter,
        lte(choreOccurrences.dueDate, addDays(s.today, kind === "task" ? 7 : 0)),
        or(eq(choreOccurrences.status, "pending"), eq(choreOccurrences.dueDate, s.today)),
        s.subjectId ? eq(choreOccurrences.assigneeId, s.subjectId) : undefined,
      ),
    )
    .orderBy(asc(choreOccurrences.dueDate), desc(chores.priority))
    .limit(50);

  const overdue = rows.filter((r) => r.status === "pending" && r.dueDate < s.today);
  const today = rows.filter((r) => r.dueDate >= s.today);
  const done = today.filter((r) => r.status === "done").length;
  return { overdue, today, done, total: today.length };
}

export async function getEvents(s: Scope, days = 7) {
  const tz = s.viewer.family.timezone;
  const localDate = sql<string>`to_char(${calendarEvents.startsAt} at time zone ${tz}, 'YYYY-MM-DD')`;
  const rows = await db
    .select({
      id: calendarEvents.id,
      title: calendarEvents.title,
      startsAt: calendarEvents.startsAt,
      allDay: calendarEvents.allDay,
      location: calendarEvents.location,
      color: calendarEvents.color,
      localDate,
    })
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.familyId, fid(s)),
        sql`${localDate} >= ${s.today}`,
        sql`${localDate} < ${addDays(s.today, days)}`,
        visibleTo(s.viewer, { id: calendarEvents.id, visibility: calendarEvents.visibility, author: calendarEvents.createdByMemberId }, "event"),
        s.subjectId
          ? inArray(
              calendarEvents.id,
              db.select({ id: eventAttendees.eventId }).from(eventAttendees).where(eq(eventAttendees.memberId, s.subjectId)),
            )
          : undefined,
      ),
    )
    .orderBy(asc(calendarEvents.startsAt))
    .limit(8);
  return { today: rows.filter((r) => r.localDate === s.today), upcoming: rows.filter((r) => r.localDate !== s.today) };
}

export async function getAnnouncements(s: Scope) {
  return db
    .select({
      id: announcements.id,
      body: announcements.body,
      pinned: announcements.pinned,
      createdAt: announcements.createdAt,
      authorName: familyMembers.displayName,
      authorColor: familyMembers.color,
    })
    .from(announcements)
    .leftJoin(familyMembers, eq(familyMembers.id, announcements.authorMemberId))
    .where(
      and(
        eq(announcements.familyId, fid(s)),
        or(isNull(announcements.expiresOn), gte(announcements.expiresOn, s.today)),
        visibleTo(s.viewer, { id: announcements.id, visibility: announcements.visibility, author: announcements.authorMemberId }, "announcement"),
      ),
    )
    .orderBy(desc(announcements.pinned), desc(announcements.createdAt))
    .limit(3);
}

export async function getMealsToday(s: Scope) {
  return db
    .select({ slot: mealPlanEntries.slot, title: mealPlanEntries.title, recipeName: recipes.name, recipeId: recipes.id })
    .from(mealPlanEntries)
    .leftJoin(recipes, eq(recipes.id, mealPlanEntries.recipeId))
    .where(and(eq(mealPlanEntries.familyId, fid(s)), eq(mealPlanEntries.date, s.today)))
    .orderBy(sql`array_position(array['breakfast','lunch','dinner','snack']::meal_slot[], ${mealPlanEntries.slot})`);
}

export async function getShopping(s: Scope) {
  const items = await db
    .select({ id: listItems.id, text: listItems.text, quantity: listItems.quantity, unit: listItems.unit, listTitle: lists.title })
    .from(listItems)
    .innerJoin(lists, eq(lists.id, listItems.listId))
    .where(
      and(
        eq(lists.familyId, fid(s)),
        eq(lists.kind, "shopping"),
        isNull(lists.archivedAt),
        eq(listItems.checked, false),
        visibleTo(s.viewer, { id: lists.id, visibility: lists.visibility, author: lists.createdByMemberId }, "list"),
      ),
    )
    .orderBy(asc(listItems.position))
    .limit(6);
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(listItems)
    .innerJoin(lists, eq(lists.id, listItems.listId))
    .where(and(eq(lists.familyId, fid(s)), eq(lists.kind, "shopping"), isNull(lists.archivedAt), eq(listItems.checked, false)));
  return { items, count };
}

export async function getPantryAlerts(s: Scope) {
  const expiring = await db
    .select({ id: inventoryItems.id, name: inventoryItems.name, expiresOn: inventoryItems.expiresOn, location: inventoryItems.location })
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.familyId, fid(s)),
        isNull(inventoryItems.archivedAt),
        lte(inventoryItems.expiresOn, addDays(s.today, 7)),
      ),
    )
    .orderBy(asc(inventoryItems.expiresOn))
    .limit(5);
  const [{ low } = { low: 0 }] = await db
    .select({ low: sql<number>`count(*)::int` })
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.familyId, fid(s)),
        isNull(inventoryItems.archivedAt),
        sql`${inventoryItems.lowStockThreshold} is not null and ${inventoryItems.quantity} <= ${inventoryItems.lowStockThreshold}`,
      ),
    );
  return { expiring, low };
}

export async function getGarden(s: Scope) {
  const [{ growing } = { growing: 0 }] = await db
    .select({ growing: sql<number>`count(*)::int` })
    .from(gardenPlantings)
    .where(and(eq(gardenPlantings.familyId, fid(s)), inArray(gardenPlantings.status, ["sown", "growing", "harvesting"])));
  const harvests = await db
    .select({ id: gardenPlantings.id, name: plants.name, variety: plants.variety, date: gardenPlantings.expectedHarvestOn })
    .from(gardenPlantings)
    .innerJoin(plants, eq(plants.id, gardenPlantings.plantId))
    .where(
      and(
        eq(gardenPlantings.familyId, fid(s)),
        gte(gardenPlantings.expectedHarvestOn, s.today),
        lte(gardenPlantings.expectedHarvestOn, addDays(s.today, 21)),
      ),
    )
    .orderBy(asc(gardenPlantings.expectedHarvestOn))
    .limit(4);
  return { growing, harvests };
}

export async function getFarm(s: Scope) {
  const [{ head } = { head: 0 }] = await db
    .select({ head: sql<number>`coalesce(sum(${animals.headCount}),0)::int` })
    .from(animals)
    .where(and(eq(animals.familyId, fid(s)), eq(animals.status, "active")));
  const weekly = await db
    .select({ kind: productionLogs.kind, unit: productionLogs.unit, total: sql<string>`sum(${productionLogs.quantity})` })
    .from(productionLogs)
    .where(and(eq(productionLogs.familyId, fid(s)), gte(productionLogs.date, addDays(s.today, -6))))
    .groupBy(productionLogs.kind, productionLogs.unit);
  const healthDue = await db
    .select({ id: animalHealthRecords.id, kind: animalHealthRecords.kind, nextDueOn: animalHealthRecords.nextDueOn, animal: animals.name })
    .from(animalHealthRecords)
    .innerJoin(animals, eq(animals.id, animalHealthRecords.animalId))
    .where(and(eq(animals.familyId, fid(s)), lte(animalHealthRecords.nextDueOn, addDays(s.today, 14))))
    .orderBy(asc(animalHealthRecords.nextDueOn))
    .limit(3);
  return { head, weekly, healthDue };
}

export async function getBudget(s: Scope) {
  const monthStart = `${s.today.slice(0, 7)}-01`;
  const rows = await db
    .select({ kind: transactions.kind, total: sql<number>`coalesce(sum(${transactions.amountCents}),0)::int` })
    .from(transactions)
    .where(and(eq(transactions.familyId, fid(s)), gte(transactions.date, monthStart), lte(transactions.date, s.today)))
    .groupBy(transactions.kind);
  const by = Object.fromEntries(rows.map((r) => [r.kind, r.total]));
  return { income: by.income ?? 0, expenses: by.expense ?? 0, saved: by.savings_transfer ?? 0, hasData: rows.length > 0 };
}

export async function getGoals(s: Scope, kind: "savings" | "other") {
  return db
    .select({
      id: goals.id,
      name: goals.name,
      horizon: goals.horizon,
      targetCents: goals.targetCents,
      currentCents: goals.currentCents,
      targetValue: goals.targetValue,
      currentValue: goals.currentValue,
      unit: goals.unit,
    })
    .from(goals)
    .where(
      and(
        eq(goals.familyId, fid(s)),
        eq(goals.status, "active"),
        kind === "savings" ? eq(goals.kind, "savings") : ne(goals.kind, "savings"),
        visibleTo(s.viewer, { id: goals.id, visibility: goals.visibility, author: goals.ownerMemberId }, "goal"),
        s.subjectId ? or(eq(goals.ownerMemberId, s.subjectId), isNull(goals.ownerMemberId)) : undefined,
      ),
    )
    .orderBy(asc(goals.targetDate), asc(goals.createdAt))
    .limit(4);
}

export async function getFitness(s: Scope) {
  const memberId = s.subjectId ?? s.viewer.member.id;
  if (memberId !== s.viewer.member.id) {
    const [m] = await db.select({ id: familyMembers.id, role: familyMembers.role, shareFitness: familyMembers.shareFitness }).from(familyMembers).where(eq(familyMembers.id, memberId));
    if (!m || !canViewFitness(s.viewer, m)) return null;
  }
  const [row] = await db
    .select({
      sessions: sql<number>`count(*)::int`,
      minutes: sql<number>`coalesce(sum(${workoutLogs.durationMinutes}),0)::int`,
    })
    .from(workoutLogs)
    .where(and(eq(workoutLogs.memberId, memberId), gte(workoutLogs.date, addDays(s.today, -6)), lte(workoutLogs.date, s.today)));
  return row ?? { sessions: 0, minutes: 0 };
}

export async function getJournal(s: Scope) {
  const [latest] = await db
    .select({ id: journalEntries.id, date: journalEntries.date, title: journalEntries.title })
    .from(journalEntries)
    .where(and(eq(journalEntries.familyId, fid(s)), eq(journalEntries.authorMemberId, s.subjectId ?? s.viewer.member.id), ne(journalEntries.book, "grimoire")))
    .orderBy(desc(journalEntries.date))
    .limit(1);
  return latest ?? null;
}

export async function getActivity(s: Scope, limit = 8) {
  return db
    .select({
      id: activityLog.id,
      summary: activityLog.summary,
      createdAt: activityLog.createdAt,
      actorName: familyMembers.displayName,
      actorColor: familyMembers.color,
    })
    .from(activityLog)
    .leftJoin(familyMembers, eq(familyMembers.id, activityLog.actorMemberId))
    .where(
      and(
        eq(activityLog.familyId, fid(s)),
        or(isNull(activityLog.visibleToMemberIds), sql`${s.viewer.member.id} = any(${activityLog.visibleToMemberIds})`),
        s.subjectId ? eq(activityLog.actorMemberId, s.subjectId) : undefined,
      ),
    )
    .orderBy(desc(activityLog.createdAt))
    .limit(limit);
}
