import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Pencil, Tags } from "lucide-react";
import { deleteBudgetCategory } from "@/app/actions/budget";
import { CategoryModal } from "@/components/budget/budget-forms";
import { HBarList } from "@/components/charts";
import { DeleteButton } from "@/components/forms/inline";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { monthTotals } from "@/lib/budget";
import { budgetContext } from "@/lib/budget-page";
import { getViewer } from "@/lib/dal";
import { formatCents } from "@/lib/utils";
import { BudgetTabs } from "../budget-tabs";
import { MonthNav } from "../month-nav";

export const metadata: Metadata = { title: "Budget categories" };

export default async function CategoriesPage({ searchParams }: PageProps<"/budget/categories">) {
  const viewer = await getViewer();
  if (!viewer.can("budget")) notFound();
  const sp = await searchParams;
  const ctx = await budgetContext(viewer, sp.month);
  const totals = await monthTotals(viewer, ctx.month);
  const canEdit = viewer.can("budget", "edit");
  const planned = ctx.cats.reduce((s, c) => s + (c.limitCents ?? 0), 0);
  return (
    <>
      <PageHeader eyebrow="Budget" title="Categories & limits" description="Set a monthly budget per category and mark which ones are bills." actions={canEdit ? <CategoryModal /> : undefined} />
      <BudgetTabs active="categories" month={ctx.month} />
      <MonthNav month={ctx.month} base="/budget/categories" />
      {ctx.cats.length === 0 ? (
        <Card>
          <EmptyState icon={<Tags />} title="No categories yet" description="Add the categories your family spends on." example="Mortgage/Rent · Utilities · Groceries · Transportation · Insurance" action={canEdit ? <CategoryModal /> : undefined} />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card>
            <p className="mb-4 text-sm text-muted">
              Planned {formatCents(planned)} · Spent {formatCents(totals.expenses)}
            </p>
            <HBarList
              valueFormat={{ currency: true }}
              data={ctx.cats.map((c) => ({ label: c.name, value: (totals.byCategory.get(c.id) ?? 0) / 100, limit: c.limitCents ? c.limitCents / 100 : null }))}
            />
          </Card>
          <Card className="p-0 sm:p-0">
            <ul className="divide-y divide-line">
              {ctx.cats.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex-1 font-medium">{c.name}</span>
                  {c.isBill && <Badge tone="mist">Bill</Badge>}
                  <span className="w-24 text-right text-sm text-muted tabular-nums">{c.limitCents ? `${formatCents(c.limitCents)}/mo` : "No limit"}</span>
                  {canEdit && (
                    <>
                      <CategoryModal category={{ id: c.id, name: c.name, limit: c.limitCents ? c.limitCents / 100 : null, isBill: c.isBill }} triggerAriaLabel="Edit" triggerContent={<Pencil className="mx-auto size-4" />} />
                      <DeleteButton action={deleteBudgetCategory} fields={{ id: c.id }} what={c.name} />
                    </>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
