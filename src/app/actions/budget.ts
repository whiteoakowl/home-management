"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { budgetLimits, categories, goals, incomeFrequency, incomeSources, transactions } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { materializeRecurringTransactions } from "@/lib/budget";
import { requireModule } from "@/lib/dal";
import { todayIn } from "@/lib/dates";
import { logActivity } from "@/lib/family";
import { recordContribution } from "@/lib/goals";
import { loadList } from "@/lib/lists";
import { ownedCategoryId } from "@/lib/queries";
import { f, familyMemberIdOrNull, upsertRule } from "@/lib/records";
import { ruleFromForm } from "@/lib/recurrence";
import { formatCents } from "@/lib/utils";

function revalidateBudget() {
  revalidatePath("/budget", "layout");
  revalidatePath("/goals", "layout");
  revalidatePath("/reports", "layout");
  revalidatePath("/");
}

export async function saveTransaction(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("budget", "edit");
    const kind = f.str(fd, "kind") as "expense" | "income" | "savings_transfer";
    if (!["expense", "income", "savings_transfer"].includes(kind)) return fail("Choose a type.", "kind");
    const name = f.str(fd, "name") ?? (kind === "income" ? "Income" : kind === "savings_transfer" ? "Transfer to savings" : null);
    if (!name) return fail("What was it?", "name");
    const amountCents = f.cents(fd, "amount");
    if (!amountCents || amountCents <= 0) return fail("Enter an amount greater than zero.", "amount");
    const date = f.date(fd, "date") ?? todayIn(viewer.family.timezone);
    let goalId = f.str(fd, "goalId");
    if (goalId) {
      const [g] = await db.select({ id: goals.id }).from(goals).where(and(eq(goals.id, goalId), eq(goals.familyId, viewer.family.id), eq(goals.kind, "savings")));
      goalId = g?.id ?? null;
    }
    let incomeSourceId = f.str(fd, "incomeSourceId");
    if (incomeSourceId) {
      const [s] = await db.select({ id: incomeSources.id }).from(incomeSources).where(and(eq(incomeSources.id, incomeSourceId), eq(incomeSources.familyId, viewer.family.id)));
      incomeSourceId = s?.id ?? null;
    }
    const values = {
      familyId: viewer.family.id,
      kind,
      name,
      amountCents,
      date,
      categoryId: kind === "income" ? null : await ownedCategoryId(viewer, "budget", f.str(fd, "categoryId")),
      incomeSourceId: kind === "income" ? incomeSourceId : null,
      goalId: kind === "savings_transfer" ? goalId : null,
      memberId: await familyMemberIdOrNull(viewer.family.id, f.str(fd, "memberId")),
      notes: f.str(fd, "notes"),
    };
    const id = f.str(fd, "id");
    if (id) {
      const [old] = await db.select().from(transactions).where(and(eq(transactions.id, id), eq(transactions.familyId, viewer.family.id)));
      if (!old) return fail("Not found.");
      await db.update(transactions).set(values).where(eq(transactions.id, id));
    } else {
      const ruleId = await upsertRule(db, viewer.family.id, ruleFromForm(fd, date));
      const [row] = await db.insert(transactions).values({ ...values, recurrenceRuleId: ruleId }).returning({ id: transactions.id });
      // Budget → Savings → Goals
      if (kind === "savings_transfer" && goalId) await recordContribution(viewer, goalId, amountCents / 100, date, name, row!.id);
      if (ruleId) await materializeRecurringTransactions(viewer.family.id, todayIn(viewer.family.timezone));
    }
    revalidateBudget();
    return ok("Saved.");
  });
}

export async function deleteTransaction(fd: FormData) {
  const viewer = await requireModule("budget", "edit");
  await db.delete(transactions).where(and(eq(transactions.id, String(fd.get("id"))), eq(transactions.familyId, viewer.family.id)));
  revalidateBudget();
}

const FREQS = incomeFrequency.enumValues;

export async function saveIncomeSource(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("budget", "edit");
    const name = f.str(fd, "name");
    if (!name) return fail("Name the income source.", "name");
    const amountCents = f.cents(fd, "amount");
    if (!amountCents || amountCents <= 0) return fail("Enter the amount per payment.", "amount");
    const frequency = f.str(fd, "frequency") as (typeof FREQS)[number];
    const values = { familyId: viewer.family.id, name, amountCents, frequency: FREQS.includes(frequency) ? frequency : "monthly", memberId: await familyMemberIdOrNull(viewer.family.id, f.str(fd, "memberId")), notes: f.str(fd, "notes") };
    const id = f.str(fd, "id");
    if (id) await db.update(incomeSources).set(values).where(and(eq(incomeSources.id, id), eq(incomeSources.familyId, viewer.family.id)));
    else await db.insert(incomeSources).values(values);
    revalidateBudget();
    return ok();
  });
}

export async function deleteIncomeSource(fd: FormData) {
  const viewer = await requireModule("budget", "edit");
  await db.delete(incomeSources).where(and(eq(incomeSources.id, String(fd.get("id"))), eq(incomeSources.familyId, viewer.family.id)));
  revalidateBudget();
}

/** Create/rename a budget category and set its monthly limit / bill flag. */
export async function saveBudgetCategory(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("budget", "edit");
    const name = f.str(fd, "name");
    if (!name) return fail("Name the category.", "name");
    let id = f.str(fd, "id");
    if (id) {
      const owned = await ownedCategoryId(viewer, "budget", id);
      if (!owned) return fail("Category not found.");
      await db.update(categories).set({ name }).where(eq(categories.id, id));
    } else {
      const [row] = await db.insert(categories).values({ familyId: viewer.family.id, domain: "budget", name, sortOrder: 999 }).returning({ id: categories.id });
      id = row!.id;
    }
    const limit = f.cents(fd, "limit");
    const isBill = f.bool(fd, "isBill") ? 1 : 0;
    await db.delete(budgetLimits).where(eq(budgetLimits.categoryId, id));
    if (limit !== null || isBill) {
      await db.insert(budgetLimits).values({ familyId: viewer.family.id, categoryId: id, effectiveFrom: `${todayIn(viewer.family.timezone).slice(0, 7)}-01`, monthlyCents: limit ?? 0, isBill });
    }
    revalidateBudget();
    return ok();
  });
}

export async function deleteBudgetCategory(fd: FormData) {
  const viewer = await requireModule("budget", "edit");
  const id = await ownedCategoryId(viewer, "budget", String(fd.get("id")));
  if (id) await db.delete(categories).where(eq(categories.id, id));
  revalidateBudget();
}

/** Shopping → Budget: log a shopping trip's total as an expense. */
export async function logShoppingExpense(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("budget", "edit");
    const list = await loadList(viewer, String(fd.get("listId")));
    const amountCents = f.cents(fd, "amount");
    if (!amountCents || amountCents <= 0) return fail("Enter the receipt total.", "amount");
    await db.insert(transactions).values({
      familyId: viewer.family.id,
      kind: "expense",
      name: f.str(fd, "name") ?? `${list.store ?? list.title} shopping`,
      amountCents,
      date: f.date(fd, "date") ?? todayIn(viewer.family.timezone),
      categoryId: await ownedCategoryId(viewer, "budget", f.str(fd, "categoryId")),
      shoppingListId: list.id,
      memberId: viewer.member.id,
    });
    await logActivity(db, viewer.family.id, viewer.member.id, "budget.expense", `logged a ${formatCents(amountCents)} shopping trip`, { module: "budget" });
    revalidateBudget();
    revalidatePath(`/shopping/${list.id}`);
    return ok("Expense logged.");
  });
}
