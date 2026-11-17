import { Lock, Pencil, ShoppingBasket, Store, Users } from "lucide-react";
import { completeFeedOrder, deleteFeedOrder, feedOrderToShopping, toggleFeedItem } from "@/app/actions/feed";
import { ActionButton, CheckCircle, DeleteButton } from "@/components/forms/inline";
import type { MemberOption } from "@/components/forms/fields";
import { Badge } from "@/components/ui/display";
import { daysBetween, formatShortDate } from "@/lib/dates";
import type { FeedOrder } from "@/lib/feed";
import { cn } from "@/lib/utils";
import { FeedOrderModal } from "./feed-order-form";

const VIS: Record<string, string> = { private: "Only me", parents: "Parents & me", selected: "Selected people" };

export function dueLabel(due: string, today: string) {
  const d = daysBetween(today, due);
  if (d < 0) return { text: `${-d} day${d === -1 ? "" : "s"} late`, tone: "wine" as const };
  if (d === 0) return { text: "Due today", tone: "wine" as const };
  if (d === 1) return { text: "Due tomorrow", tone: "olive" as const };
  return { text: `Due ${formatShortDate(due)}`, tone: d <= 7 ? ("olive" as const) : ("neutral" as const) };
}

/** One feed order: due date, items to tick off as bought, and its actions. */
export function FeedOrderCard({
  o,
  today,
  members,
  canUse,
  canChange,
  canShop,
  shared = [],
  compact = false,
}: {
  o: FeedOrder;
  today: string;
  members: MemberOption[];
  canUse: boolean;
  canChange: boolean;
  canShop: boolean;
  shared?: string[];
  compact?: boolean;
}) {
  const due = dueLabel(o.dueDate, today);
  const left = o.items.filter((i) => !i.got).length;
  return (
    <article className={cn("rounded-2xl border bg-surface p-4", o.completedAt ? "border-line opacity-70" : due.tone === "wine" ? "border-wine-200" : "border-line")}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-sans text-base font-semibold">{o.title}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            {o.store && (
              <span className="inline-flex items-center gap-1">
                <Store className="size-3.5" aria-hidden /> {o.store}
              </span>
            )}
            {o.visibility !== "family" && (
              <span className="inline-flex items-center gap-1">
                {o.visibility === "selected" ? <Users className="size-3.5" aria-hidden /> : <Lock className="size-3.5" aria-hidden />} {VIS[o.visibility]}
              </span>
            )}
          </p>
        </div>
        {o.completedAt ? <Badge tone="neutral">Bought</Badge> : <Badge tone={due.tone}>{due.text}</Badge>}
      </header>
      <ul className="mt-3 flex flex-col gap-1.5">
        {o.items.map((i) => (
          <li key={i.id} className="flex items-center gap-2.5">
            <CheckCircle action={toggleFeedItem} id={i.id} done={i.got} label={`${i.got ? "Not bought" : "Bought"}: ${i.name}`} size="sm" disabled={!canUse} />
            <span className={cn("min-w-0 flex-1 text-[15px]", i.got && "text-muted line-through")}>
              {i.quantity && <span className="font-medium tabular-nums">{i.quantity} </span>}
              {i.name}
            </span>
          </li>
        ))}
      </ul>
      {!compact && o.notes && <p className="mt-3 text-sm text-ink-soft">{o.notes}</p>}
      {(canUse || canChange || canShop) && (
        <footer className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line/70 pt-3">
          {canShop && !o.completedAt && left > 0 && (
            <ActionButton action={feedOrderToShopping} fields={{ id: o.id }} className="h-8 rounded-full border border-line px-3 text-xs font-medium whitespace-nowrap hover:bg-sunken">
              <ShoppingBasket className="size-3.5" /> Add to shopping list
            </ActionButton>
          )}
          {canUse && (
            <ActionButton action={completeFeedOrder} fields={{ id: o.id }} className="h-8 rounded-full border border-line px-3 text-xs font-medium whitespace-nowrap hover:bg-sunken">
              {o.completedAt ? "Reopen" : "All bought"}
            </ActionButton>
          )}
          {canChange && !compact && (
            <span className="ml-auto flex items-center gap-1">
              <FeedOrderModal
                members={members}
                today={today}
                defaults={{ id: o.id, title: o.title, dueDate: o.dueDate, store: o.store, notes: o.notes, visibility: o.visibility, shared, items: o.items.map((i) => (i.quantity ? `${i.quantity} ${i.name}` : i.name)) }}
                triggerContent={<Pencil className="size-4" aria-label="Edit" />}
                triggerClassName="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-sunken hover:text-ink"
              />
              <DeleteButton action={deleteFeedOrder} fields={{ id: o.id }} what="this feed order" />
            </span>
          )}
        </footer>
      )}
    </article>
  );
}
