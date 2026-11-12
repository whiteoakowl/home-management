import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HandCoins, Pencil } from "lucide-react";
import { deleteIncomeSource } from "@/app/actions/budget";
import { IncomeSourceModal } from "@/components/budget/budget-forms";
import { DeleteButton } from "@/components/forms/inline";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { FREQ_PER_MONTH, monthTotals } from "@/lib/budget";
import { budgetContext } from "@/lib/budget-page";
import { getViewer } from "@/lib/dal";
import { formatCents } from "@/lib/utils";
import { BudgetTabs } from "../budget-tabs";

export const metadata: Metadata = { title: "Income" };

const FREQ_LABEL: Record<string, string> = { weekly: "Weekly", biweekly: "Every 2 weeks", semimonthly: "Twice a month", monthly: "Monthly", quarterly: "Quarterly", annually: "Yearly", one_time: "One time" };

export default async function IncomePage({ searchParams }: PageProps<"/budget/income">) {
  const viewer = await getViewer();
  if (!viewer.can("budget")) notFound();
  const sp = await searchParams;
  const ctx = await budgetContext(viewer, sp.month);
  const totals = await monthTotals(viewer, ctx.month);
  const monthly = Math.round(ctx.sources.reduce((s, x) => s + x.amountCents * (FREQ_PER_MONTH[x.frequency] ?? 0), 0));
  const canEdit = viewer.can("budget", "edit");
  const add = <IncomeSourceModal members={ctx.members} />;
  return (
    <>
      <PageHeader eyebrow="Budget" title="Income" description="Every paycheck, side job and other income, normalised to a monthly figure." actions={canEdit ? add : undefined} />
      <BudgetTabs active="income" month={ctx.month} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-muted">Expected monthly income</p>
          <p className="font-display text-3xl font-semibold">{formatCents(monthly)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Yearly</p>
          <p className="font-display text-3xl font-semibold">{formatCents(monthly * 12)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Received this month</p>
          <p className="font-display text-3xl font-semibold">{formatCents(totals.income)}</p>
        </Card>
      </div>
      {ctx.sources.length === 0 ? (
        <Card>
          <EmptyState icon={<HandCoins />} title="No income sources yet" description="Add each source with how often it pays. We'll calculate your monthly total." example="Income Source | Amount | Frequency" action={canEdit ? add : undefined} />
        </Card>
      ) : (
        <Card className="p-0 sm:p-0">
          <table className="w-full text-left text-[15px]">
            <thead>
              <tr className="border-b border-line text-sm text-muted">
                <th className="px-5 py-3 font-medium">Income source</th>
                <th className="py-3 pr-4 font-medium">Amount</th>
                <th className="py-3 pr-4 font-medium">Frequency</th>
                <th className="py-3 pr-4 text-right font-medium">Per month</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {ctx.sources.map((s) => (
                <tr key={s.id} className="border-b border-line/60 last:border-0">
                  <td className="px-5 py-3 font-medium">{s.name}</td>
                  <td className="py-3 pr-4 tabular-nums">{formatCents(s.amountCents)}</td>
                  <td className="py-3 pr-4">{FREQ_LABEL[s.frequency]}</td>
                  <td className="py-3 pr-4 text-right font-semibold tabular-nums">{formatCents(Math.round(s.amountCents * (FREQ_PER_MONTH[s.frequency] ?? 0)))}</td>
                  <td className="py-1 pr-3 text-right whitespace-nowrap">
                    {canEdit && (
                      <>
                        <IncomeSourceModal members={ctx.members} source={{ id: s.id, name: s.name, amount: s.amountCents / 100, frequency: s.frequency, memberId: s.memberId, notes: s.notes }} triggerAriaLabel="Edit" triggerContent={<Pencil className="mx-auto size-4" />} />
                        <DeleteButton action={deleteIncomeSource} fields={{ id: s.id }} what={s.name} />
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
