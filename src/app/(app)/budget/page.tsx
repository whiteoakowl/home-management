import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { ArrowDownRight, ArrowUpRight, PiggyBank, Receipt, Wallet } from "lucide-react";
import { db } from "@/db";
import { categories, transactions } from "@/db/schema";
import { BarChart, HBarList } from "@/components/charts";
import { TransactionModal } from "@/components/budget/budget-forms";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { FREQ_PER_MONTH, monthlyHistory, monthRange, monthTotals } from "@/lib/budget";
import { budgetContext } from "@/lib/budget-page";
import { getViewer } from "@/lib/dal";
import { formatShortDate } from "@/lib/dates";
import { listGoals, progressOf } from "@/lib/goals";
import { formatCents } from "@/lib/utils";
import { BudgetTabs } from "./budget-tabs";
import { MonthNav } from "./month-nav";

export const metadata: Metadata = { title: "Budget" };

export default async function BudgetPage({ searchParams }: PageProps<"/budget">) {
  const viewer = await getViewer();
  if (!viewer.can("budget")) notFound();
  const sp = await searchParams;
  const { today, month, cats, savingsGoals, sources, members } = await budgetContext(viewer, sp.month);
  const { from, to } = monthRange(month);
  const [totals, history, recent, goalRows] = await Promise.all([
    monthTotals(viewer, month),
    monthlyHistory(viewer, month, 6),
    db
      .select({ t: transactions, category: categories.name })
      .from(transactions)
      .leftJoin(categories, eq(categories.id, transactions.categoryId))
      .where(and(eq(transactions.familyId, viewer.family.id), gte(transactions.date, from), lte(transactions.date, to)))
      .orderBy(desc(transactions.date), desc(transactions.createdAt))
      .limit(8),
    viewer.can("goals") ? listGoals(viewer, { kind: "savings" }) : Promise.resolve([]),
  ]);
  const expectedIncome = Math.round(sources.reduce((s, x) => s + x.amountCents * (FREQ_PER_MONTH[x.frequency] ?? 0), 0));
  const income = totals.income || expectedIncome;
  const bills = cats.filter((c) => c.isBill).reduce((s, c) => s + (totals.byCategory.get(c.id) ?? 0), 0);
  const remaining = income - totals.expenses - totals.saved;
  const savingsRate = income > 0 ? Math.round((totals.saved / income) * 100) : 0;
  const breakdown = [
    ...cats.map((c) => ({ label: c.name, value: (totals.byCategory.get(c.id) ?? 0) / 100, limit: c.limitCents !== null && c.limitCents > 0 ? c.limitCents / 100 : null })),
    ...(totals.byCategory.get(null) ? [{ label: "Uncategorized", value: totals.byCategory.get(null)! / 100, limit: null }] : []),
  ]
    .filter((b) => b.value > 0 || b.limit)
    .sort((a, b) => b.value - a.value);
  const canEdit = viewer.can("budget", "edit");
  const hasAny = history.some((h) => h.income || h.expenses || h.saved) || sources.length > 0;
  const modalProps = { categories: cats, goals: savingsGoals, sources, members, today };

  const tiles = [
    { label: totals.income ? "Income" : "Expected income", value: income, icon: ArrowUpRight, note: !totals.income && expectedIncome ? "from income sources" : undefined },
    { label: "Bills", value: bills, icon: Receipt },
    { label: "Total expenses", value: totals.expenses, icon: ArrowDownRight },
    { label: "Saved", value: totals.saved, icon: PiggyBank, note: income ? `${savingsRate}% savings rate` : undefined },
    { label: "Remaining", value: remaining, icon: Wallet, tone: remaining < 0 ? "wine" : undefined },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Money"
        title="Budget"
        description="Income, bills, expenses and savings, month by month."
        actions={
          canEdit ? (
            <>
              <TransactionModal {...modalProps} defaultKind="income" triggerVariant="secondary" defaultOpen={sp.new === "income"} />
              <TransactionModal {...modalProps} defaultKind="expense" defaultOpen={sp.new === "expense"} />
            </>
          ) : undefined
        }
      />
      <BudgetTabs active="overview" month={month} />
      <MonthNav month={month} base="/budget" />
      {!hasAny ? (
        <Card>
          <EmptyState
            icon={<Wallet />}
            title="Your budget is empty"
            description="Add your income sources and a few expenses. Recurring bills can repeat automatically."
            example="Mortgage $1,850 · monthly · Bills"
            action={canEdit ? <Link href={`/budget/income?month=${month}`} className="text-sm font-semibold text-primary-600 hover:underline">Start with income →</Link> : undefined}
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            {tiles.map((t) => (
              <Card key={t.label}>
                <p className="flex items-center gap-2 text-sm text-muted">
                  <t.icon className="size-4" /> {t.label}
                </p>
                <p className={`font-display text-2xl font-semibold sm:text-3xl ${t.tone === "wine" ? "text-wine-500" : ""}`}>{formatCents(t.value)}</p>
                {t.note && <p className="text-xs text-muted">{t.note}</p>}
              </Card>
            ))}
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader title="Income vs. expenses" />
              <BarChart data={history.map((h) => ({ label: h.label, values: [h.income / 100, h.expenses / 100] }))} series={[{ name: "Income" }, { name: "Expenses" }]} label="Income and expenses by month" valueFormat={{ currency: true }} />
            </Card>
            <Card>
              <CardHeader title="Spending by category" href={`/budget/categories?month=${month}`} hrefLabel="Limits" />
              {breakdown.length ? <HBarList data={breakdown} valueFormat={{ currency: true }} /> : <p className="text-sm text-muted">No expenses this month.</p>}
            </Card>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Recent transactions" href={`/budget/transactions?month=${month}`} />
              {recent.length === 0 ? (
                <p className="text-sm text-muted">Nothing recorded for this month.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line">
                  {recent.map(({ t, category }) => (
                    <li key={t.id} className="flex items-center gap-3 py-2.5">
                      <span className="w-14 text-sm text-muted">{formatShortDate(t.date)}</span>
                      <span className="min-w-0 flex-1 truncate">
                        {t.name}
                        {category && <span className="text-sm text-muted"> · {category}</span>}
                      </span>
                      <span className={`font-semibold tabular-nums ${t.kind === "income" ? "text-primary-600" : ""}`}>
                        {t.kind === "income" ? "+" : t.kind === "savings_transfer" ? "→ " : "−"}
                        {formatCents(t.amountCents)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <CardHeader title="Savings goals" href="/goals?kind=savings" />
              {goalRows.length === 0 ? (
                <p className="text-sm text-muted">Create savings goals, then use “Move to savings” to fund them from the budget.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {goalRows.map(({ g }) => {
                    const p = progressOf(g);
                    return (
                      <li key={g.id} className="flex flex-col gap-1">
                        <div className="flex justify-between text-[15px]">
                          <Link href={`/goals/${g.id}`} className="hover:underline">
                            {g.name}
                          </Link>
                          <span className="text-sm text-muted">
                            {formatCents(p.current * 100)} / {formatCents(p.target * 100)}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-sunken">
                          <div className="h-full rounded-full bg-primary-500" style={{ width: `${p.pct}%` }} />
                        </div>
                        {g.status === "achieved" && <Badge tone="primary">Achieved</Badge>}
                      </li>
                    );
                  })}
                </ul>
              )}
              {canEdit && savingsGoals.length > 0 && <div className="mt-4"><TransactionModal {...modalProps} defaultKind="savings_transfer" triggerVariant="soft" /></div>}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
