"use client";

import { useState, type ReactNode } from "react";
import { CheckSquare, List, ListOrdered, ListTodo, ShoppingCart } from "lucide-react";
import { saveList } from "@/app/actions/lists";
import { FormModal } from "@/components/forms/action-form";
import { SelectField, TextField, VisibilityField, type MemberOption } from "@/components/forms/fields";
import { cn } from "@/lib/utils";

const KINDS = [
  { value: "checklist", label: "Checklist", icon: CheckSquare, hint: "Tick things off" },
  { value: "todo", label: "To-do", icon: ListTodo, hint: "Due dates, owners, repeats" },
  { value: "bullet", label: "Bullet list", icon: List, hint: "Notes & ideas" },
  { value: "numbered", label: "Numbered", icon: ListOrdered, hint: "Steps in order" },
  { value: "shopping", label: "Shopping", icon: ShoppingCart, hint: "Grouped by aisle" },
] as const;

export function ListFormModal({
  members,
  categories,
  list,
  allowShopping,
  onlyShopping,
  trigger,
  triggerContent,
  defaultOpen,
}: {
  members: MemberOption[];
  categories: { id: string; name: string }[];
  list?: { id: string; title: string; kind: string; categoryId: string | null; store: string | null; visibility: "family" | "private" | "selected"; sharedWith: string[] };
  allowShopping?: boolean;
  onlyShopping?: boolean;
  trigger?: (open: () => void) => ReactNode;
  /** Serializable trigger for Server Component callers. */
  triggerContent?: ReactNode;
  defaultOpen?: boolean;
}) {
  const [kind, setKind] = useState(list?.kind ?? (onlyShopping ? "shopping" : "checklist"));
  const options = KINDS.filter((k) => (onlyShopping ? k.value === "shopping" : k.value !== "shopping" || allowShopping));
  return (
    <FormModal
      title={list ? "Edit list" : onlyShopping ? "New shopping list" : "New list"}
      triggerLabel={onlyShopping ? "New shopping list" : "New list"}
      action={saveList}
      submitLabel={list ? "Save" : "Create list"}
      trigger={trigger}
      triggerContent={triggerContent}
      triggerClassName="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-sunken"
      defaultOpen={defaultOpen}
    >
      {list && <input type="hidden" name="id" value={list.id} />}
      <TextField name="title" label="Name" required defaultValue={list?.title} placeholder={onlyShopping ? "Costco run" : "Packing for the lake"} />
      {options.length > 1 && !list && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink-soft">Type</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {options.map((k) => (
              <label
                key={k.value}
                className={cn(
                  "flex cursor-pointer flex-col gap-1 rounded-xl border p-3",
                  kind === k.value ? "border-primary-500 bg-primary-50" : "border-line-strong hover:bg-sunken",
                )}
              >
                <input type="radio" name="kind" value={k.value} checked={kind === k.value} onChange={() => setKind(k.value)} className="sr-only" />
                <k.icon className={cn("size-5", kind === k.value ? "text-primary-600" : "text-muted")} aria-hidden />
                <span className="text-sm font-semibold">{k.label}</span>
                <span className="text-xs text-muted">{k.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {(list || options.length === 1) && <input type="hidden" name="kind" value={kind} />}
      {kind === "shopping" ? (
        <TextField name="store" label="Store (optional)" defaultValue={list?.store ?? ""} placeholder="Trader Joe's" />
      ) : (
        categories.length > 0 && (
          <SelectField name="categoryId" label="Category" defaultValue={list?.categoryId ?? ""} placeholder="None" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
        )
      )}
      <VisibilityField members={members} defaultValue={list?.visibility} defaultSelected={list?.sharedWith} />
    </FormModal>
  );
}
