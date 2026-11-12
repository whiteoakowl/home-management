import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { Pencil, Receipt, Repeat } from "lucide-react";
import { db } from "@/db";
import { categories, familyMembers, goals, transactions } from "@/db/schema";
import { deleteTransaction } from "@/app/actions/budget";
import { TransactionModal } from "@/components/budget/budget-forms";
import { DeleteButton } from "@/components/forms/inline";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { SegmentLinks } from "@/components/ui/tabs";
import { monthRange } from "@/lib/budget";
import { budgetContext } from "@/lib/budget-page";
import { getViewer } from "@/lib/dal";
import { formatShortDate } from "@/lib/dates";
import { formatCents } from "@/lib/utils";
import { BudgetTabs } from "../budget-tabs";
import { MonthNav } from "../month-nav";

export const metadata: Metadata = { title: "Transactions" };

export default async function TransactionsPage({ searchParams }: PageProps<"/budget/transactions">) {
  const viewer = await getViewer();
  if (!viewer.can("budget")) notFound();
  const sp = await searchParams;
  const ctx = await budgetContext(viewer, sp.month);
  const kind = ["expense", "income", "savings_transfer"].includes(String(sp.kind)) ? String(sp.kind) : "all";
  const { from, to } = monthRange(ctx.month);
  const rows = await db
    .select({ t: transactions, category: categories.name, member: familyMembers.displayName, goal: goals.name })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(familyMembers, eq(familyMembers.id, transactions.memberId))
    .leftJoin(goals, eq(goals.id, transactions.goalId))
    .where(and(eq(transactions.familyId, viewer.family.id), gte(transactions.date, from), lte(transactions.date, to), kind !== "all" ? eq(transactions.kind, kind as "expense") : undefined))
    .orderBy(desc(transactions.date), desc(transactions.createdAt));
  const canEdit = viewer.can("budget", "edit");
  const modalProps = { categories: ctx.cats, goals: ctx.savingsGoals, sources: ctx.sources, members: ctx.members, today: ctx.today };
  const total = (k: string) => rows.filter((r) => r.t.kind === k).reduce((s, r) => s + r.t.amountCents, 0);
  const q = (k: string) => `/budget/transactions?month=${ctx.month}&kind=${k}`;
  return (
    <>
      <PageHeader eyebrow="Budget" title="Transactions" actions={canEdit ? <TransactionModal {...modalProps} /> : undefined} />
      <BudgetTabs active="transactions" month={ctx.month} />
      <MonthNav month={ctx.month} base="/budget/transactions" />
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <SegmentLinks active={kind} items={[{ key: "all", href: q("all"), label: "All" }, { key: "expense", href: q("expense"), label: "Expenses" }, { key: "income", href: q("income"), label: "Income" }, { key: "savings_transfer", href: q("savings_transfer"), label: "Savings" }]} />
        <p className="text-sm text-muted">
          In {formatCents(total("income"))} · Out {formatCents(total("expense"))} · Saved {formatCents(total("savings_transfer"))}
        </p>
      </div>
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Receipt />} title="No transactions" description="Add expenses and income as they happen, or set them to repeat." action={canEdit ? <TransactionModal {...modalProps} /> : undefined} />
        </Card>
      ) : (
        <Card className="p-0 sm:p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[15px]">
              <thead>
                <tr className="border-b border-line text-sm text-muted">
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="py-3 pr-4 font-medium">Item</th>
                  <th className="py-3 pr-4 font-medium">Category</th>
                  <th className="py-3 pr-4 font-medium">Who</th>
                  <th className="py-3 pr-4 text-right font-medium">Amount</th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ t, category, member, goal }) => (
                  <tr key={t.id} className="border-b border-line/60 last:border-0">
                    <td className="px-5 py-2.5 whitespace-nowrap text-muted">{formatShortDate(t.date)}</td>
                    <td className="py-2.5 pr-4">
                      {t.name} {t.recurrenceRuleId && <Repeat className="inline size-3.5 text-muted" aria-label="Recurring" />}
                      {t.notes && <span className="block text-sm text-muted">{t.notes}</span>}
                    </td>
                    <td className="py-2.5 pr-4">{t.kind === "income" ? <Badge tone="primary">Income</Badge> : t.kind === "savings_transfer" ? <Badge tone="olive">Savings{goal ? ` · ${goal}` : ""}</Badge> : (category ?? <span className="text-muted">—</span>)}</td>
                    <td className="py-2.5 pr-4 text-sm">{member ?? "—"}</td>
                    <td className={`py-2.5 pr-4 text-right font-semibold tabular-nums ${t.kind === "income" ? "text-primary-600" : ""}`}>
                      {t.kind === "income" ? "+" : t.kind === "expense" ? "−" : ""}
                      {formatCents(t.amountCents)}
                    </td>
                    <td className="py-1 pr-3 text-right whitespace-nowrap">
                      {canEdit && (
                        <>
                          <TransactionModal {...modalProps} triggerAriaLabel="Edit" triggerContent={<Pencil className="mx-auto size-4" />} defaults={{ id: t.id, kind: t.kind, name: t.name, amount: t.amountCents / 100, date: t.date, categoryId: t.categoryId, incomeSourceId: t.incomeSourceId, goalId: t.goalId, memberId: t.memberId, notes: t.notes }} />
                          <DeleteButton action={deleteTransaction} fields={{ id: t.id }} what={`"${t.name}"`} />
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
