import { date, index, integer, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { categories, families, familyMembers } from "./core";
import { recurrenceRules } from "./household";
import { lists } from "./lists";
import { goals } from "./personal";

export const incomeFrequency = pgEnum("income_frequency", [
  "weekly",
  "biweekly",
  "semimonthly",
  "monthly",
  "quarterly",
  "annually",
  "one_time",
]);
export const transactionKind = pgEnum("transaction_kind", [
  "expense",
  "income",
  "savings_transfer",
]);

export const incomeSources = pgTable(
  "income_sources",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    amountCents: integer("amount_cents").notNull(),
    frequency: incomeFrequency("frequency").notNull(),
    memberId: uuid("member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("income_family_idx").on(t.familyId)],
);

/** Monthly limit for a budget category (categories.domain = 'budget'). */
export const budgetLimits = pgTable("budget_limits", {
  id: id(),
  familyId: uuid("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  /** First of month this limit applies from. */
  effectiveFrom: date("effective_from").notNull(),
  monthlyCents: integer("monthly_cents").notNull(),
  isBill: integer("is_bill").notNull().default(0),
  ...timestamps,
});

export const transactions = pgTable(
  "transactions",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    kind: transactionKind("kind").notNull(),
    name: text("name").notNull(),
    amountCents: integer("amount_cents").notNull(),
    date: date("date").notNull(),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    incomeSourceId: uuid("income_source_id").references(() => incomeSources.id, {
      onDelete: "set null",
    }),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    shoppingListId: uuid("shopping_list_id").references(() => lists.id, {
      onDelete: "set null",
    }),
    recurrenceRuleId: uuid("recurrence_rule_id").references(() => recurrenceRules.id, {
      onDelete: "set null",
    }),
    memberId: uuid("member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("transactions_family_date_idx").on(t.familyId, t.date)],
);
