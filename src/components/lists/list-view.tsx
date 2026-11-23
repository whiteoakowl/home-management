"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Lock, Pencil, Plus, Repeat, Trash2 } from "lucide-react";
import { addItem, deleteItem, moveItem, toggleItem, updateItem } from "@/app/actions/lists";
import { ActionForm, FormModal } from "@/components/forms/action-form";
import {
  DateField,
  FormRow,
  MemberSelect,
  NumberField,
  RecurrenceField,
  SelectField,
  TextAreaField,
  TextField,
  type MemberOption,
} from "@/components/forms/fields";
import { CheckCircle } from "@/components/forms/inline";
import { VoiceAddButton } from "./voice-add";
import { Avatar, Badge } from "@/components/ui/display";
import { sectionFor, SHOPPING_SECTIONS } from "@/lib/shopping-category";
import { cn } from "@/lib/utils";

export type ListKind = "checklist" | "bullet" | "numbered" | "todo" | "shopping";
export type ItemView = {
  id: string;
  text: string;
  checked: boolean;
  dueDate: string | null;
  priority: "low" | "normal" | "high" | null;
  assigneeId: string | null;
  quantity: string | null;
  unit: string | null;
  shoppingCategory: string | null;
  store: string | null;
  priceCents?: number | null;
  notes: string | null;
  source: string;
  recurring: string | null;
  rule: { freq: string; interval: number; byWeekday: number[] | null; byMonthDay: number[] | null; byMonth: number[] | null; until: string | null } | null;
  /** Personal shopping item: who it's for (only parents and that person see it). */
  personalFor?: { id: string; name: string } | null;
  /** Parents: who submitted the item, when it wasn't them. */
  addedBy?: string | null;
  /** The viewer added it or it's for them. */
  mine?: boolean;
};

/** Personal items on a family shopping list. */
export type PersonalItems = { isParent: boolean; viewerId: string; onlyPersonal: boolean };

export const SHOPPING_CATEGORIES = SHOPPING_SECTIONS.map((c) => ({ value: c.value, label: c.label }));

const SOURCE_LABEL: Record<string, string> = { recipe: "From recipe", meal_plan: "Meal plan", low_stock: "Low stock" };

function ItemFields({ kind, item, members }: { kind: ListKind; item?: ItemView; members: MemberOption[] }) {
  return (
    <>
      {item && <input type="hidden" name="id" value={item.id} />}
      <TextField name="text" label="Item" required defaultValue={item?.text} />
      {kind === "todo" && (
        <>
          <FormRow>
            <DateField name="dueDate" label="Due" defaultValue={item?.dueDate ?? ""} />
            <SelectField
              name="priority"
              label="Priority"
              defaultValue={item?.priority ?? "normal"}
              options={[
                { value: "low", label: "Low" },
                { value: "normal", label: "Normal" },
                { value: "high", label: "High" },
              ]}
            />
            <MemberSelect name="assigneeId" members={members} defaultValue={item?.assigneeId} />
          </FormRow>
          <RecurrenceField defaults={item?.rule} />
        </>
      )}
      {kind === "checklist" && <MemberSelect name="assigneeId" members={members} defaultValue={item?.assigneeId} />}
      {kind === "shopping" && (
        <FormRow>
          <NumberField name="quantity" label="Quantity" min={0} defaultValue={item?.quantity ?? ""} />
          <TextField name="unit" label="Unit" defaultValue={item?.unit ?? ""} placeholder="lb, dozen, box…" />
          <SelectField name="shoppingCategory" label="Section" defaultValue={item?.shoppingCategory ?? ""} placeholder="Auto" options={SHOPPING_CATEGORIES} />
          <TextField name="store" label="Store" defaultValue={item?.store ?? ""} />
          <NumberField name="price" label="Price ($)" min={0} step="0.01" defaultValue={item?.priceCents != null ? item.priceCents / 100 : ""} />
        </FormRow>
      )}
      <TextAreaField name="notes" label="Notes" rows={2} defaultValue={item?.notes ?? ""} />
    </>
  );
}

function Row({
  item,
  index,
  kind,
  members,
  canEdit,
  canCheck = true,
  today,
}: {
  item: ItemView;
  index: number;
  kind: ListKind;
  members: MemberOption[];
  canEdit: boolean;
  canCheck?: boolean;
  today: string;
}) {
  const [pending, start] = useTransition();
  // Items you added (and your personal items) are yours to change, even on someone else's list.
  canEdit = canEdit || !!item.mine;
  const assignee = members.find((m) => m.id === item.assigneeId);
  const checkable = kind !== "bullet" && kind !== "numbered";
  const overdue = kind === "todo" && item.dueDate && item.dueDate < today && !item.checked;
  const run = (fn: (fd: FormData) => Promise<void>, extra: Record<string, string> = {}) =>
    start(() => {
      const fd = new FormData();
      fd.set("id", item.id);
      for (const [k, v] of Object.entries(extra)) fd.set(k, v);
      return fn(fd);
    });

  return (
    <li className={cn("group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-sunken/60", pending && "opacity-60")}>
      {checkable ? (
        <CheckCircle action={toggleItem} id={item.id} done={item.checked} label={`${item.checked ? "Uncheck" : "Check"} ${item.text}`} disabled={!(canCheck || item.mine || item.personalFor)} />
      ) : kind === "numbered" ? (
        <span className="w-7 text-right font-semibold text-muted tabular-nums">{index + 1}.</span>
      ) : (
        <span className="ml-2.5 size-2 shrink-0 rounded-full bg-primary-400" aria-hidden />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={cn("text-[15px]", item.checked && "text-muted line-through")}>
          {kind === "shopping" && item.quantity && (
            <span className="mr-1.5 font-semibold">
              {Number(item.quantity)}
              {item.unit ? ` ${item.unit}` : ""}
            </span>
          )}
          {item.text}
        </span>
        {(item.personalFor || item.addedBy) && (
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {item.personalFor && (
              <span className="inline-flex w-fit items-center gap-1 rounded-full bg-olive-50 px-2 py-0.5 text-xs font-medium text-olive-700">
                <Lock className="size-3" aria-hidden /> For {item.personalFor.name}
              </span>
            )}
            {item.addedBy && <span className="text-xs text-muted">Added by {item.addedBy}</span>}
          </span>
        )}
        {(item.notes || item.dueDate || SOURCE_LABEL[item.source] || item.store || item.recurring) && (
          <span className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
            {item.dueDate && <span className={cn(overdue && "font-medium text-wine-500")}>Due {new Date(`${item.dueDate}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</span>}
            {item.recurring && (
              <span className="inline-flex items-center gap-1">
                <Repeat className="size-3" aria-hidden /> {item.recurring}
              </span>
            )}
            {item.store && <span>@ {item.store}</span>}
            {SOURCE_LABEL[item.source] && <span>{SOURCE_LABEL[item.source]}</span>}
            {item.notes && <span className="truncate">{item.notes}</span>}
          </span>
        )}
      </div>
      {kind === "shopping" && item.priceCents != null && <span className={cn("text-sm tabular-nums", item.checked ? "text-muted" : "text-ink-soft")}>${(item.priceCents / 100).toFixed(2)}</span>}
      {item.priority === "high" && !item.checked && <Badge tone="wine">High</Badge>}
      {assignee && <Avatar name={assignee.displayName} color={assignee.color} size="xs" />}
      {canEdit && (
        <div className="flex items-center opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          <button type="button" aria-label="Move up" onClick={() => run(moveItem, { dir: "up" })} className="size-8 rounded-full text-muted hover:bg-surface">
            <ArrowUp className="mx-auto size-4" />
          </button>
          <button type="button" aria-label="Move down" onClick={() => run(moveItem, { dir: "down" })} className="size-8 rounded-full text-muted hover:bg-surface">
            <ArrowDown className="mx-auto size-4" />
          </button>
          <FormModal
            title="Edit item"
            action={updateItem}
            trigger={(open) => (
              <button type="button" aria-label="Edit item" onClick={open} className="size-8 rounded-full text-muted hover:bg-surface">
                <Pencil className="mx-auto size-4" />
              </button>
            )}
          >
            <ItemFields kind={kind} item={item} members={members} />
          </FormModal>
          <button type="button" aria-label="Delete item" onClick={() => run(deleteItem)} className="size-8 rounded-full text-muted hover:bg-wine-50 hover:text-wine-500">
            <Trash2 className="mx-auto size-4" />
          </button>
        </div>
      )}
    </li>
  );
}

/** Quick-add bar: type & press enter. "More options" reveals typed fields. */
function AddBar({ listId, kind, members, personal }: { listId: string; kind: ListKind; members: MemberOption[]; personal?: PersonalItems }) {
  const [more, setMore] = useState(false);
  const [isPersonal, setPersonal] = useState(!!personal?.onlyPersonal);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  return (
    <ActionForm action={addItem} onSuccess={() => inputRef.current?.focus()} className="gap-3 rounded-2xl border border-line bg-surface p-3">
      <input type="hidden" name="listId" value={listId} />
      <div className="flex flex-wrap gap-2">
        {/* One row that grows: Enter adds, Shift+Enter or pasting adds several lines. */}
        <textarea
          ref={inputRef}
          name="text"
          rows={1}
          autoComplete="off"
          aria-label="New item"
          placeholder={kind === "shopping" ? "Add an item… (e.g. 2 lb apples)" : "Add an item…"}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          className="max-h-48 min-h-11 min-w-0 flex-1 basis-40 resize-none rounded-[var(--radius-control)] border border-line-strong bg-surface px-3.5 py-2.5 text-[15px] [field-sizing:content] focus:border-primary-500 focus:ring-4 focus:ring-primary-100 focus:outline-none"
        />
        <VoiceAddButton
          split={kind === "shopping" || kind === "checklist" || kind === "bullet"}
          onItems={(items) => {
            // Add what was heard to the box, one per line, skipping ones already there.
            const box = inputRef.current;
            if (!box) return 0;
            const have = box.value.split("\n").map((x) => x.trim()).filter(Boolean);
            const lower = new Set(have.map((x) => x.toLowerCase()));
            const fresh = items.filter((i) => !lower.has(i.toLowerCase()));
            if (!fresh.length) return 0;
            box.value = [...have, ...fresh].join("\n");
            box.focus();
            return fresh.length;
          }}
        />
        <button type="submit" className="inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-control)] bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700">
          <Plus className="size-4" /> Add
        </button>
      </div>
      {personal && (
        <div className={cn("flex flex-col gap-2 rounded-xl border px-3 py-2.5", isPersonal ? "border-olive-400 bg-olive-50" : "border-line")}>
          {personal.onlyPersonal ? (
            <input type="hidden" name="personal" value="on" />
          ) : (
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="personal" checked={isPersonal} onChange={(e) => setPersonal(e.target.checked)} className="size-4 accent-[var(--color-primary-600)]" />
              <Lock className="size-3.5 text-muted" aria-hidden /> Personal item
            </label>
          )}
          {isPersonal && (
            <>
              {personal.isParent && (
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-ink-soft">For</span>
                  <select name="personalFor" defaultValue={personal.viewerId} className="h-9 rounded-lg border border-line-strong bg-surface px-2 text-sm">
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.displayName}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p className="text-xs text-muted">
                {personal.onlyPersonal ? "Add things you need for yourself. " : ""}Only parents (and you) will see personal items. Other family members won&apos;t.
              </p>
            </>
          )}
        </div>
      )}
      {kind !== "bullet" && kind !== "numbered" && (
        <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className="inline-flex w-fit items-center gap-1 text-sm font-medium text-muted hover:text-ink">
          More options <ChevronDown className={cn("size-4 transition-transform", more && "rotate-180")} />
        </button>
      )}
      {more && (
        <div className="flex flex-col gap-3">
          {kind === "todo" && (
            <>
              <FormRow cols={3}>
                <DateField name="dueDate" label="Due" />
                <SelectField name="priority" label="Priority" defaultValue="normal" options={[{ value: "low", label: "Low" }, { value: "normal", label: "Normal" }, { value: "high", label: "High" }]} />
                <MemberSelect name="assigneeId" members={members} />
              </FormRow>
              <RecurrenceField />
            </>
          )}
          {kind === "checklist" && <MemberSelect name="assigneeId" members={members} className="sm:max-w-xs" />}
          {kind === "shopping" && (
            <FormRow cols={4}>
              <NumberField name="quantity" label="Qty" min={0} />
              <TextField name="unit" label="Unit" placeholder="lb" />
              <SelectField name="shoppingCategory" label="Section" placeholder="Auto" options={SHOPPING_CATEGORIES} />
              <TextField name="store" label="Store" />
              <NumberField name="price" label="Price ($)" min={0} step="0.01" hint="Remembered for next time" />
            </FormRow>
          )}
        </div>
      )}
      <p className="text-xs text-muted">Enter to add · Shift+Enter or paste several lines to add many at once.</p>
    </ActionForm>
  );
}

export function ListView({
  listId,
  kind,
  items,
  members,
  canEdit,
  canAdd,
  canCheck = true,
  today,
  groupBy,
  personal,
}: {
  listId: string;
  kind: ListKind;
  items: ItemView[];
  members: MemberOption[];
  canEdit: boolean;
  canAdd: boolean;
  /** "View only" members see the list but can't tick items. */
  canCheck?: boolean;
  today: string;
  groupBy?: "aisle" | "none";
  personal?: PersonalItems;
}) {
  const open = items.filter((i) => !i.checked);
  const personalOpen = open.filter((i) => i.personalFor);
  const sharedOpen = open.filter((i) => !i.personalFor);
  const done = items.filter((i) => i.checked);
  const groups =
    kind === "shopping" && groupBy !== "none"
      ? [
          { key: "personal-items", label: personal?.isParent ? "Personal items · only parents see these" : "My personal items · only parents see these", items: personalOpen },
          ...SHOPPING_SECTIONS.map((c) => ({ key: c.value, label: `${c.emoji} ${c.label}`, items: sharedOpen.filter((i) => sectionFor(i) === c.value) })),
        ].filter((g) => g.items.length)
      : [{ key: "all", label: "", items: kind === "todo" ? [...open].sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")) : open }];

  const sum = (xs: ItemView[]) => xs.reduce((s, i) => s + (i.priceCents ?? 0), 0);
  const priced = kind === "shopping" && items.some((i) => i.priceCents != null);
  return (
    <div className="flex flex-col gap-5">
      {(canAdd || personal) && <AddBar listId={listId} kind={kind} members={members} personal={personal ? { ...personal, onlyPersonal: !canAdd } : undefined} />}
      {priced && (
        <p className="flex flex-wrap gap-x-4 px-2 text-sm text-muted" aria-live="polite">
          <span>
            Estimated total <strong className="text-ink">${(sum(items) / 100).toFixed(2)}</strong>
          </span>
          <span>
            In the cart <strong className="text-ink">${(sum(done) / 100).toFixed(2)}</strong>
          </span>
        </p>
      )}
      {groups.map((g) => (
        <section key={g.key}>
          {g.label && <h2 className="mb-1 px-2 font-sans text-xs font-semibold tracking-[0.12em] text-muted uppercase">{g.label}</h2>}
          <ul className="flex flex-col">
            {g.items.map((item, i) => (
              <Row canCheck={canCheck} key={item.id} item={item} index={i} kind={kind} members={members} canEdit={canEdit} today={today} />
            ))}
          </ul>
        </section>
      ))}
      {open.length === 0 && items.length > 0 && <p className="px-2 text-[15px] text-muted">Everything&apos;s checked off. 🎉</p>}
      {done.length > 0 && kind !== "bullet" && kind !== "numbered" && (
        <details className="rounded-2xl">
          <summary className="cursor-pointer px-2 text-sm font-medium text-muted hover:text-ink">
            {done.length} checked off
          </summary>
          <ul className="mt-2 flex flex-col">
            {done.map((item, i) => (
              <Row canCheck={canCheck} key={item.id} item={item} index={i} kind={kind} members={members} canEdit={canEdit} today={today} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export { ItemFields };
