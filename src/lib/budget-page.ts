import "server-only";
import { notFound } from "next/navigation";
import { canEditFinance, financeSpace, ownerOf } from "./finance-space";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { goals } from "@/db/schema";
import type { Viewer } from "./dal";
import { budgetCategories, incomeSourceList } from "./budget";
import { todayIn } from "./dates";
import { memberOptions } from "./queries";

/**
 * Which money space a budget page shows: parents see the family budget; a member
 * with My Budget turned on sees only their own. Anyone else gets "not found".
 */
export function budgetSpaceOrNotFound(viewer: Viewer, raw: unknown) {
  const space = financeSpace(viewer, raw);
  if (!space) notFound();
  const owner = ownerOf(space);
  const isPrivate = !!owner;
  return {
    space,
    owner,
    isPrivate,
    canEdit: canEditFinance(viewer, space),
    /** "&space=mine" to append to links (empty for the family budget). */
    amp: isPrivate ? "&space=mine" : "",
    /** Extra fields for delete buttons. */
    fields: isPrivate ? { space: "mine" } : {},
    title: isPrivate ? "My Budget" : "Budget",
  };
}

/** Shared lookups for budget pages (forms need categories, goals, sources, members). */
export async function budgetContext(viewer: Viewer, monthParam: unknown, owner: string | null = null) {
  const today = todayIn(viewer.family.timezone);
  const month = typeof monthParam === "string" && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : today.slice(0, 7);
  const [cats, savingsGoals, sources, members] = await Promise.all([
    budgetCategories(viewer, owner),
    // Private space: only the member's own savings goals; family: family-wide + the viewer's own.
    db.select({ id: goals.id, name: goals.name }).from(goals).where(and(eq(goals.familyId, viewer.family.id), eq(goals.kind, "savings"), eq(goals.status, "active"), owner ? eq(goals.ownerMemberId, owner) : or(isNull(goals.ownerMemberId), eq(goals.ownerMemberId, viewer.member.id)))).orderBy(asc(goals.name)),
    incomeSourceList(viewer, owner),
    owner ? Promise.resolve([]) : memberOptions(viewer),
  ]);
  return { today, month, cats, savingsGoals, sources, members };
}
