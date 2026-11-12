"use client";

import { useState, type ReactNode } from "react";
import { logShoppingExpense, saveBudgetCategory, saveIncomeSource, saveTransaction } from "@/app/actions/budget";
import { FormModal } from "@/components/forms/action-form";
import { CheckboxField, DateField, FormRow, MemberSelect, NumberField, RecurrenceField, SelectField, TextAreaField, TextField, type MemberOption } from "@/components/forms/fields";

type Opt = { id: string; name: string };
export type TxnDefaults = { id: string; kind: string; name: string; amount: number; date: string; categoryId: string | null; incomeSourceId: string | null; goalId: string | null; memberId: string | null; notes: string | null };

export function TransactionModal({
  categories,
  goals,
  sources,
  members,
  today,
  defaults,
  defaultKind = "expense",
  defaultOpen,
  triggerLabel,
  triggerContent,
  triggerVariant = "primary",
  triggerAriaLabel,
}: {
  categories: Opt[];
  goals: Opt[];
  sources: Opt[];
  members: MemberOption[];
  today: string;
  defaults?: TxnDefaults;
  defaultKind?: string;
  defaultOpen?: boolean;
  triggerLabel?: string;
  triggerContent?: ReactNode;
  triggerVariant?: "primary" | "secondary" | "soft" | "ghost";
  triggerAriaLabel?: string;
}) {
  const [kind, setKind] = useState(defaults?.kind ?? defaultKind);
  const label = { expense: "Add expense", income: "Add income", savings_transfer: "Move to savings" }[kind] ?? "Add";
  return (
    <FormModal
      title={defaults ? "Edit transaction" : label}
      triggerLabel={triggerLabel ?? label}
      triggerVariant={triggerVariant}
      triggerContent={triggerContent}
      triggerAriaLabel={triggerAriaLabel}
      triggerClassName="size-9 rounded-full text-muted hover:bg-sunken"
      action={saveTransaction}
      submitLabel={defaults ? "Save" : "Add"}
      defaultOpen={defaultOpen}
    >
      {defaults && <input type="hidden" name="id" value={defaults.id} />}
      <div className="inline-flex w-fit rounded-xl bg-sunken p-1" role="radiogroup" aria-label="Type">
        {[
          ["expense", "Expense"],
          ["income", "Income"],
          ["savings_transfer", "Savings"],
        ].map(([k, l]) => (
          <label key={k} className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium ${kind === k ? "bg-surface shadow-sm" : "text-muted"}`}>
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k!)} className="sr-only" />
            {l}
          </label>
        ))}
      </div>
      <FormRow>
        <TextField name="name" label={kind === "income" ? "Source / description" : "What"} required={kind === "expense"} defaultValue={defaults?.name} placeholder={kind === "income" ? "Paycheck" : kind === "savings_transfer" ? "Monthly savings" : "Electric bill"} />
        <NumberField name="amount" label="Amount ($)" required min={0} step="0.01" defaultValue={defaults?.amount ?? ""} />
        <DateField name="date" label="Date" defaultValue={defaults?.date ?? today} />
        {kind === "expense" && <SelectField name="categoryId" label="Category" defaultValue={defaults?.categoryId ?? ""} placeholder="Uncategorized" options={categories.map((c) => ({ value: c.id, label: c.name }))} />}
        {kind === "income" && sources.length > 0 && <SelectField name="incomeSourceId" label="Income source" defaultValue={defaults?.incomeSourceId ?? ""} placeholder="—" options={sources.map((c) => ({ value: c.id, label: c.name }))} />}
        {kind === "savings_transfer" && <SelectField name="goalId" label="Toward goal" defaultValue={defaults?.goalId ?? ""} placeholder="General savings" options={goals.map((c) => ({ value: c.id, label: c.name }))} />}
        {kind === "savings_transfer" && <SelectField name="categoryId" label="Category" defaultValue={defaults?.categoryId ?? ""} placeholder="—" options={categories.map((c) => ({ value: c.id, label: c.name }))} />}
        <MemberSelect name="memberId" label="Who" members={members} defaultValue={defaults?.memberId} placeholder="Household" />
      </FormRow>
      {!defaults && <RecurrenceField label="Repeats (bills, paychecks…)" />}
      <TextAreaField name="notes" label="Notes" rows={2} defaultValue={defaults?.notes ?? ""} />
    </FormModal>
  );
}

export function IncomeSourceModal({ members, source, triggerContent, triggerAriaLabel }: { members: MemberOption[]; source?: { id: string; name: string; amount: number; frequency: string; memberId: string | null; notes: string | null }; triggerContent?: ReactNode; triggerAriaLabel?: string }) {
  return (
    <FormModal title={source ? "Edit income source" : "Add income source"} triggerLabel="Add income source" triggerContent={triggerContent} triggerAriaLabel={triggerAriaLabel} triggerClassName="size-9 rounded-full text-muted hover:bg-sunken" action={saveIncomeSource} size="sm">
      {source && <input type="hidden" name="id" value={source.id} />}
      <TextField name="name" label="Income source" required defaultValue={source?.name} placeholder="Dad's job" />
      <FormRow>
        <NumberField name="amount" label="Amount per payment ($)" required min={0} step="0.01" defaultValue={source?.amount ?? ""} />
        <SelectField
          name="frequency"
          label="How often"
          defaultValue={source?.frequency ?? "biweekly"}
          options={[
            { value: "weekly", label: "Weekly" },
            { value: "biweekly", label: "Every 2 weeks" },
            { value: "semimonthly", label: "Twice a month" },
            { value: "monthly", label: "Monthly" },
            { value: "quarterly", label: "Quarterly" },
            { value: "annually", label: "Yearly" },
            { value: "one_time", label: "One time" },
          ]}
        />
      </FormRow>
      <MemberSelect name="memberId" label="Earner" members={members} defaultValue={source?.memberId} placeholder="Household" />
      <TextField name="notes" label="Notes" defaultValue={source?.notes ?? ""} />
    </FormModal>
  );
}

export function CategoryModal({ category, triggerContent, triggerAriaLabel }: { category?: { id: string; name: string; limit: number | null; isBill: boolean }; triggerContent?: ReactNode; triggerAriaLabel?: string }) {
  return (
    <FormModal title={category ? "Edit category" : "Add budget category"} triggerLabel="Add category" triggerVariant="secondary" triggerContent={triggerContent} triggerAriaLabel={triggerAriaLabel} triggerClassName="size-9 rounded-full text-muted hover:bg-sunken" action={saveBudgetCategory} size="sm">
      {category && <input type="hidden" name="id" value={category.id} />}
      <TextField name="name" label="Category" required defaultValue={category?.name} placeholder="Childcare" />
      <NumberField name="limit" label="Monthly budget ($)" min={0} step="1" defaultValue={category?.limit ?? ""} hint="Leave blank for no limit." />
      <CheckboxField name="isBill" label="This is a bill (rent, utilities, insurance…)" defaultChecked={category?.isBill} />
    </FormModal>
  );
}

export function ShoppingExpenseModal({ listId, categories, today, defaultCategory }: { listId: string; categories: Opt[]; today: string; defaultCategory?: string }) {
  return (
    <FormModal title="Log this trip as an expense" triggerLabel="Log expense" triggerVariant="ghost" triggerSize="sm" action={logShoppingExpense} size="sm" submitLabel="Log expense">
      <input type="hidden" name="listId" value={listId} />
      <FormRow>
        <NumberField name="amount" label="Receipt total ($)" required min={0} step="0.01" />
        <DateField name="date" label="Date" defaultValue={today} />
      </FormRow>
      <SelectField name="categoryId" label="Category" defaultValue={defaultCategory ?? ""} placeholder="Uncategorized" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
    </FormModal>
  );
}
