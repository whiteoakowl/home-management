import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { goals } from "@/db/schema";
import type { Viewer } from "./dal";
import { budgetCategories, incomeSourceList } from "./budget";
import { todayIn } from "./dates";
import { memberOptions } from "./queries";

/** Shared lookups for budget pages (forms need categories, goals, sources, members). */
export async function budgetContext(viewer: Viewer, monthParam: unknown) {
  const today = todayIn(viewer.family.timezone);
  const month = typeof monthParam === "string" && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : today.slice(0, 7);
  const [cats, savingsGoals, sources, members] = await Promise.all([
    budgetCategories(viewer),
    db.select({ id: goals.id, name: goals.name }).from(goals).where(and(eq(goals.familyId, viewer.family.id), eq(goals.kind, "savings"), eq(goals.status, "active"))).orderBy(asc(goals.name)),
    incomeSourceList(viewer),
    memberOptions(viewer),
  ]);
  return { today, month, cats, savingsGoals, sources, members };
}
