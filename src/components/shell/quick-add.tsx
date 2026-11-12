"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BookOpen,
  CalendarPlus,
  CheckSquare,
  ClipboardList,
  Dumbbell,
  HandCoins,
  ListPlus,
  Megaphone,
  NotebookPen,
  PawPrint,
  Plus,
  Receipt,
  Refrigerator,
  Sprout,
  Target,
  UserPlus,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import type { Module } from "@/db/schema/_shared";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

type Option = {
  label: string;
  icon: LucideIcon;
  href: string;
  module: Module | null;
  parentOnly?: boolean;
  /** Phase in which this quick-add becomes live (1 = now). */
  phase: number;
};

const OPTIONS: Option[] = [
  { label: "Chore", icon: CheckSquare, href: "/house/chores?new=1", module: "chores", phase: 2 },
  { label: "Task", icon: ClipboardList, href: "/house/chores?new=task", module: "chores", phase: 2 },
  { label: "Event", icon: CalendarPlus, href: "/calendar?new=1", module: "calendar", phase: 2 },
  { label: "List", icon: ListPlus, href: "/lists?new=1", module: "lists", phase: 2 },
  { label: "Inventory item", icon: Refrigerator, href: "/kitchen?new=1", module: "kitchen", phase: 3 },
  { label: "Recipe", icon: BookOpen, href: "/recipes?new=1", module: "recipes", phase: 3 },
  { label: "Meal", icon: UtensilsCrossed, href: "/meals", module: "meals", phase: 3 },
  { label: "Garden plant", icon: Sprout, href: "/garden/plants?new=1", module: "garden", phase: 4 },
  { label: "Farm animal", icon: PawPrint, href: "/farm/animals?new=1", module: "farm", phase: 4 },
  { label: "Journal entry", icon: NotebookPen, href: "/journal?new=1", module: "journal", phase: 5 },
  { label: "Goal", icon: Target, href: "/goals?new=1", module: "goals", phase: 5 },
  { label: "Workout", icon: Dumbbell, href: "/fitness?new=1", module: "fitness", phase: 5 },
  { label: "Expense", icon: Receipt, href: "/budget?new=expense", module: "budget", phase: 6 },
  { label: "Income", icon: HandCoins, href: "/budget?new=income", module: "budget", phase: 6 },
  { label: "Family member", icon: UserPlus, href: "/family?new=1", module: null, parentOnly: true, phase: 1 },
  { label: "Announcement", icon: Megaphone, href: "/?announce=1", module: null, parentOnly: true, phase: 1 },
];

/** Highest build phase that is live. Quick-add entries from later phases show "Soon". */
const BUILT_PHASE = 7;

/** Universal "+ Add". `editable` = modules the viewer can edit. */
export function QuickAdd({
  editable,
  isParent,
  variant = "button",
}: {
  editable: Module[];
  isParent: boolean;
  variant?: "button" | "fab";
}) {
  const [open, setOpen] = useState(false);
  const options = OPTIONS.filter((o) => (o.module ? editable.includes(o.module) : true) && (!o.parentOnly || isParent));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) && !el.isContentEditable) {
        setOpen(true);
      }
    };
    if (variant === "button") window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [variant]);

  return (
    <>
      {variant === "fab" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Quick add"
          className="-mt-6 flex size-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-[var(--shadow-pop)] ring-4 ring-canvas active:scale-95"
        >
          <Plus className="size-7" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-primary-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
        >
          <Plus className="size-4" /> Add
          <kbd className="ml-1 hidden rounded bg-white/15 px-1.5 text-[11px] font-medium lg:inline">N</kbd>
        </button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Quick add" description="What would you like to add?">
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {options.map((o) => {
            const live = o.phase <= BUILT_PHASE;
            const inner = (
              <>
                <span className={cn("flex size-11 items-center justify-center rounded-full", live ? "bg-primary-50 text-primary-600" : "bg-sunken text-muted")}>
                  <o.icon className="size-5" aria-hidden />
                </span>
                <span className="text-center text-[13px] leading-tight font-medium">{o.label}</span>
                {!live && <span className="text-[10px] font-medium tracking-wide text-muted uppercase">Soon</span>}
              </>
            );
            const cls = "flex h-full min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border p-2 transition-colors";
            return (
              <li key={o.label}>
                {live ? (
                  <Link href={o.href} onClick={() => setOpen(false)} className={cn(cls, "border-line hover:border-primary-300 hover:bg-primary-50/50")}>
                    {inner}
                  </Link>
                ) : (
                  <div className={cn(cls, "border-dashed border-line opacity-70")} aria-disabled title={`Arrives in build phase ${o.phase}`}>
                    {inner}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {options.length === 0 && <p className="text-muted">There&apos;s nothing you can add yet. Ask a parent for access.</p>}
      </Modal>
    </>
  );
}
