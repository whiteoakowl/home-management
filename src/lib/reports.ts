import "server-only";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  categories,
  choreOccurrences,
  chores,
  familyMembers,
  feedLogs,
  gardenLogs,
  goalContributions,
  goals,
  inventoryEvents,
  inventoryItems,
  plants,
  productionLogs,
  transactions,
  workoutLogs,
} from "@/db/schema";
import type { Viewer } from "./dal";
import { addDays, addMonths } from "./dates";
import { fitnessVisibleIds } from "./fitness";

const monthLabel = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
function lastMonths(today: string, n: number) {
  const first = addMonths(`${today.slice(0, 7)}-01`, -(n - 1));
  return Array.from({ length: n }, (_, i) => addMonths(first, i).slice(0, 7));
}

export async function cleaningReport(viewer: Viewer, today: string, days = 30) {
  const from = addDays(today, -(days - 1));
  const completer = alias(familyMembers, "completer");
  const assignee = alias(familyMembers, "assignee");
  const [byMember, history, byChore] = await Promise.all([
    db
      .select({
        name: assignee.displayName,
        done: sql<number>`count(*) filter (where ${choreOccurrences.status} = 'done')::int`,
        missed: sql<number>`count(*) filter (where ${choreOccurrences.status} = 'missed')::int`,
        total: sql<number>`count(*) filter (where ${choreOccurrences.status} in ('done','missed') or (${choreOccurrences.status} = 'pending' and ${choreOccurrences.dueDate} < ${today}))::int`,
      })
      .from(choreOccurrences)
      .innerJoin(assignee, eq(assignee.id, choreOccurrences.assigneeId))
      .where(and(eq(choreOccurrences.familyId, viewer.family.id), gte(choreOccurrences.dueDate, from), lte(choreOccurrences.dueDate, today)))
      .groupBy(assignee.displayName),
    db
      .select({ id: choreOccurrences.id, title: chores.title, kind: chores.kind, completedAt: choreOccurrences.completedAt, by: completer.displayName, due: choreOccurrences.dueDate })
      .from(choreOccurrences)
      .innerJoin(chores, eq(chores.id, choreOccurrences.choreId))
      .leftJoin(completer, eq(completer.id, choreOccurrences.completedByMemberId))
      .where(and(eq(choreOccurrences.familyId, viewer.family.id), eq(choreOccurrences.status, "done"), gte(choreOccurrences.dueDate, from)))
      .orderBy(desc(choreOccurrences.completedAt))
      .limit(60),
    db
      .select({ title: chores.title, done: sql<number>`count(*) filter (where ${choreOccurrences.status} = 'done')::int`, missed: sql<number>`count(*) filter (where ${choreOccurrences.status} = 'missed')::int` })
      .from(choreOccurrences)
      .innerJoin(chores, eq(chores.id, choreOccurrences.choreId))
      .where(and(eq(choreOccurrences.familyId, viewer.family.id), gte(choreOccurrences.dueDate, from), lte(choreOccurrences.dueDate, today)))
      .groupBy(chores.title)
      .orderBy(desc(sql`3`)),
  ]);
  return { byMember, history, byChore };
}

export async function gardenReport(viewer: Viewer, today: string) {
  const months = lastMonths(today, 12);
  const [harvests, planted, monthly] = await Promise.all([
    db
      .select({ plant: plants.name, unit: gardenLogs.unit, total: sql<number>`sum(${gardenLogs.quantity})::float`, n: sql<number>`count(*)::int`, last: sql<string>`max(${gardenLogs.date})` })
      .from(gardenLogs)
      .innerJoin(plants, eq(plants.id, gardenLogs.plantId))
      .where(and(eq(gardenLogs.familyId, viewer.family.id), eq(gardenLogs.kind, "harvest")))
      .groupBy(plants.name, gardenLogs.unit)
      .orderBy(desc(sql`3`)),
    db
      .select({ plant: plants.name, date: gardenLogs.date, kind: gardenLogs.kind })
      .from(gardenLogs)
      .innerJoin(plants, eq(plants.id, gardenLogs.plantId))
      .where(and(eq(gardenLogs.familyId, viewer.family.id), inArray(gardenLogs.kind, ["sown", "transplanted"])))
      .orderBy(desc(gardenLogs.date))
      .limit(40),
    db
      .select({ m: sql<string>`to_char(${gardenLogs.date}, 'YYYY-MM')`, n: sql<number>`count(*)::int` })
      .from(gardenLogs)
      .where(and(eq(gardenLogs.familyId, viewer.family.id), eq(gardenLogs.kind, "harvest"), gte(gardenLogs.date, `${months[0]}-01`)))
      .groupBy(sql`1`),
  ]);
  return { harvests, planted, monthly: months.map((m) => ({ label: monthLabel(m), values: [monthly.find((x) => x.m === m)?.n ?? 0] })) };
}

export async function farmReport(viewer: Viewer, today: string) {
  const months = lastMonths(today, 12);
  const [production, feed] = await Promise.all([
    db
      .select({ m: sql<string>`to_char(${productionLogs.date}, 'YYYY-MM')`, kind: productionLogs.kind, unit: productionLogs.unit, total: sql<number>`sum(${productionLogs.quantity})::float` })
      .from(productionLogs)
      .where(and(eq(productionLogs.familyId, viewer.family.id), gte(productionLogs.date, `${months[0]}-01`)))
      .groupBy(sql`1`, productionLogs.kind, productionLogs.unit),
    db
      .select({ feed: feedLogs.feed, unit: feedLogs.unit, total: sql<number>`sum(${feedLogs.quantity})::float`, cost: sql<number>`coalesce(sum(${feedLogs.costCents}),0)::int` })
      .from(feedLogs)
      .where(and(eq(feedLogs.familyId, viewer.family.id), gte(feedLogs.date, `${months[0]}-01`)))
      .groupBy(feedLogs.feed, feedLogs.unit),
  ]);
  const kinds = [...new Set(production.map((p) => `${p.kind}|${p.unit}`))];
  return {
    series: kinds.map((k) => {
      const [kind, unit] = k.split("|");
      return { kind: kind!, unit: unit!, data: months.map((m) => ({ label: monthLabel(m), values: [production.find((p) => p.m === m && p.kind === kind && p.unit === unit)?.total ?? 0] })) };
    }),
    feed,
  };
}

export async function kitchenReport(viewer: Viewer, today: string) {
  const months = lastMonths(today, 6);
  const [byMonth, wasted] = await Promise.all([
    db
      .select({ m: sql<string>`to_char(${inventoryEvents.createdAt}, 'YYYY-MM')`, kind: inventoryEvents.kind, n: sql<number>`count(*)::int` })
      .from(inventoryEvents)
      .where(and(eq(inventoryEvents.familyId, viewer.family.id), gte(inventoryEvents.createdAt, new Date(`${months[0]}-01T00:00:00Z`))))
      .groupBy(sql`1`, inventoryEvents.kind),
    db
      .select({ name: inventoryItems.name, n: sql<number>`count(*)::int` })
      .from(inventoryEvents)
      .innerJoin(inventoryItems, eq(inventoryItems.id, inventoryEvents.itemId))
      .where(and(eq(inventoryEvents.familyId, viewer.family.id), eq(inventoryEvents.kind, "discarded")))
      .groupBy(inventoryItems.name)
      .orderBy(desc(sql`2`))
      .limit(10),
  ]);
  const count = (m: string, k: string) => byMonth.find((x) => x.m === m && x.kind === k)?.n ?? 0;
  const totals = (k: string) => byMonth.filter((x) => x.kind === k).reduce((s, x) => s + x.n, 0);
  return {
    usage: months.map((m) => ({ label: monthLabel(m), values: [count(m, "used"), count(m, "discarded")] })),
    used: totals("used"),
    discarded: totals("discarded"),
    donated: totals("donated"),
    added: totals("added"),
    wasted,
  };
}

export async function budgetReport(viewer: Viewer, today: string) {
  const months = lastMonths(today, 12);
  const [byMonth, byCategory] = await Promise.all([
    db
      .select({ m: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`, kind: transactions.kind, total: sql<number>`sum(${transactions.amountCents})::int` })
      .from(transactions)
      .where(and(eq(transactions.familyId, viewer.family.id), gte(transactions.date, `${months[0]}-01`), lte(transactions.date, today)))
      .groupBy(sql`1`, transactions.kind),
    db
      .select({ name: sql<string>`coalesce(${categories.name}, 'Uncategorized')`, total: sql<number>`sum(${transactions.amountCents})::int` })
      .from(transactions)
      .leftJoin(categories, eq(categories.id, transactions.categoryId))
      .where(and(eq(transactions.familyId, viewer.family.id), eq(transactions.kind, "expense"), gte(transactions.date, `${months[0]}-01`), lte(transactions.date, today)))
      .groupBy(sql`1`)
      .orderBy(desc(sql`2`)),
  ]);
  const get = (m: string, k: string) => byMonth.find((x) => x.m === m && x.kind === k)?.total ?? 0;
  const sum = (k: string) => byMonth.filter((x) => x.kind === k).reduce((s, x) => s + x.total, 0);
  return {
    monthly: months.map((m) => ({ label: monthLabel(m), values: [get(m, "income") / 100, get(m, "expense") / 100] })),
    savings: months.map((m) => ({ label: monthLabel(m), values: [get(m, "savings_transfer") / 100] })),
    income: sum("income"),
    expenses: sum("expense"),
    saved: sum("savings_transfer"),
    byCategory,
  };
}

export async function fitnessReport(viewer: Viewer, today: string) {
  const weeks = Array.from({ length: 12 }, (_, i) => addDays(today, -7 * (11 - i)));
  const from = addDays(weeks[0]!, -6);
  const rows = await db
    .select({ name: familyMembers.displayName, memberId: workoutLogs.memberId, date: workoutLogs.date, minutes: workoutLogs.durationMinutes })
    .from(workoutLogs)
    .innerJoin(familyMembers, eq(familyMembers.id, workoutLogs.memberId))
    .where(and(eq(workoutLogs.familyId, viewer.family.id), gte(workoutLogs.date, from), inArray(workoutLogs.memberId, await fitnessVisibleIds(viewer))));
  const people = [...new Map(rows.map((r) => [r.memberId, r.name])).entries()];
  return {
    weekly: weeks.map((end) => ({
      label: new Date(`${end}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
      values: [rows.filter((r) => r.date > addDays(end, -7) && r.date <= end).length],
    })),
    perPerson: people
      .map(([id, name]) => {
        const mine = rows.filter((r) => r.memberId === id);
        return { label: name, value: mine.length, minutes: mine.reduce((s, r) => s + (r.minutes ?? 0), 0) };
      })
      .sort((a, b) => b.value - a.value),
  };
}

export async function goalsReport(viewer: Viewer) {
  const [all, contributions] = await Promise.all([
    db.select().from(goals).where(eq(goals.familyId, viewer.family.id)),
    db
      .select({ m: sql<string>`to_char(${goalContributions.date}, 'YYYY-MM')`, cents: sql<number>`coalesce(sum(${goalContributions.amountCents}),0)::int` })
      .from(goalContributions)
      .innerJoin(goals, eq(goals.id, goalContributions.goalId))
      .where(eq(goals.familyId, viewer.family.id))
      .groupBy(sql`1`)
      .orderBy(sql`1`),
  ]);
  return { all, contributions };
}
