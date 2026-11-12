import "server-only";
import { and, asc, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { budgetLimits, categories, incomeSources, recurrenceRules, transactions } from "@/db/schema";
import type { Viewer } from "./dal";
import { addDays, addMonths } from "./dates";
import { occurrencesBetween, type Rule } from "./recurrence";

export const FREQ_PER_MONTH: Record<string, number> = { weekly: 52 / 12, biweekly: 26 / 12, semimonthly: 2, monthly: 1, quarterly: 1 / 3, annually: 1 / 12, one_time: 0 };

export const monthRange = (month: string) => {
  const from = `${month.slice(0, 7)}-01`;
  return { from, to: addDays(addMonths(from, 1), -1) };
};

export async function budgetCategories(viewer: Viewer) {
  const rows = await db
    .select({ c: categories, limit: budgetLimits })
    .from(categories)
    .leftJoin(budgetLimits, eq(budgetLimits.categoryId, categories.id))
    .where(and(eq(categories.familyId, viewer.family.id), eq(categories.domain, "budget")))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
  return rows.map((r) => ({ id: r.c.id, name: r.c.name, color: r.c.color, limitCents: r.limit?.monthlyCents ?? null, isBill: (r.limit?.isBill ?? 0) === 1 }));
}

export async function monthTotals(viewer: Viewer, month: string) {
  const { from, to } = monthRange(month);
  const rows = await db
    .select({ kind: transactions.kind, categoryId: transactions.categoryId, total: sql<number>`sum(${transactions.amountCents})::int` })
    .from(transactions)
    .where(and(eq(transactions.familyId, viewer.family.id), gte(transactions.date, from), lte(transactions.date, to)))
    .groupBy(transactions.kind, transactions.categoryId);
  const sum = (k: string) => rows.filter((r) => r.kind === k).reduce((s, r) => s + r.total, 0);
  const byCategory = new Map<string | null, number>();
  for (const r of rows.filter((r) => r.kind === "expense")) byCategory.set(r.categoryId, (byCategory.get(r.categoryId) ?? 0) + r.total);
  return { income: sum("income"), expenses: sum("expense"), saved: sum("savings_transfer"), byCategory };
}

/** Income vs expenses for the last n months (oldest first). */
export async function monthlyHistory(viewer: Viewer, month: string, n = 6) {
  const first = addMonths(`${month.slice(0, 7)}-01`, -(n - 1));
  const { to } = monthRange(month);
  const rows = await db
    .select({ m: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`, kind: transactions.kind, total: sql<number>`sum(${transactions.amountCents})::int` })
    .from(transactions)
    .where(and(eq(transactions.familyId, viewer.family.id), gte(transactions.date, first), lte(transactions.date, to)))
    .groupBy(sql`1`, transactions.kind);
  return Array.from({ length: n }, (_, i) => {
    const m = addMonths(first, i).slice(0, 7);
    const get = (k: string) => rows.find((r) => r.m === m && r.kind === k)?.total ?? 0;
    return { month: m, label: new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }), income: get("income"), expenses: get("expense"), saved: get("savings_transfer") };
  });
}

export async function incomeSourceList(viewer: Viewer) {
  return db.select().from(incomeSources).where(eq(incomeSources.familyId, viewer.family.id)).orderBy(desc(incomeSources.amountCents));
}

/**
 * Recurring transactions: the earliest row with a rule is the template; every
 * occurrence up to today gets its own row (idempotent per rule+date).
 */
export async function materializeRecurringTransactions(familyId: string, today: string) {
  const templates = await db
    .select({ t: transactions, rule: recurrenceRules })
    .from(transactions)
    .innerJoin(recurrenceRules, eq(recurrenceRules.id, transactions.recurrenceRuleId))
    .where(and(eq(transactions.familyId, familyId), isNotNull(transactions.recurrenceRuleId), eq(recurrenceRules.enabled, true)))
    .orderBy(asc(transactions.date));
  const seen = new Set<string>();
  for (const { t, rule } of templates) {
    if (seen.has(rule.id)) continue;
    seen.add(rule.id);
    const existing = new Set(
      (await db.select({ date: transactions.date }).from(transactions).where(eq(transactions.recurrenceRuleId, rule.id))).map((r) => r.date),
    );
    const due = occurrencesBetween(rule as unknown as Rule, t.date, today).filter((d) => !existing.has(d));
    if (!due.length) continue;
    await db.insert(transactions).values(
      due.map((date) => ({
        familyId,
        kind: t.kind,
        name: t.name,
        amountCents: t.amountCents,
        date,
        categoryId: t.categoryId,
        incomeSourceId: t.incomeSourceId,
        goalId: null,
        recurrenceRuleId: rule.id,
        memberId: t.memberId,
        notes: t.notes,
      })),
    );
  }
}
