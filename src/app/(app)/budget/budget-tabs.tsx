import { LinkTabs } from "@/components/ui/tabs";

export function BudgetTabs({ active, month }: { active: string; month: string }) {
  const q = `?month=${month}`;
  return (
    <LinkTabs
      active={active}
      tabs={[
        { key: "overview", href: `/budget${q}`, label: "Overview" },
        { key: "transactions", href: `/budget/transactions${q}`, label: "Transactions" },
        { key: "income", href: `/budget/income${q}`, label: "Income" },
        { key: "categories", href: `/budget/categories${q}`, label: "Categories & limits" },
      ]}
    />
  );
}
