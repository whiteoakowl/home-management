"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, SlidersHorizontal } from "lucide-react";
import type { WidgetPref } from "@/db/schema/core";
import { resetDashboardLayout, saveDashboardLayout } from "@/app/actions/dashboard";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

const SIZES: { value: WidgetPref["size"]; label: string }[] = [
  { value: "sm", label: "S" },
  { value: "md", label: "M" },
  { value: "lg", label: "L" },
];

/** Reorder, show/hide and resize dashboard widgets. Saved per member. */
export function DashboardCustomizer({
  layout,
  titles,
}: {
  layout: WidgetPref[];
  titles: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(layout);
  const [pending, start] = useTransition();

  const move = (i: number, dir: -1 | 1) =>
    setItems((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  const patch = (i: number, p: Partial<WidgetPref>) => setItems((prev) => prev.map((w, k) => (k === i ? { ...w, ...p } : w)));

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        icon={<SlidersHorizontal className="size-4" />}
        onClick={() => {
          setItems(layout);
          setOpen(true);
        }}
      >
        Customize
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Customize your dashboard"
        description="Choose which cards you see, their order and their size. Only your view changes."
        footer={
          <>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await resetDashboardLayout();
                  setOpen(false);
                })
              }
            >
              Reset to default
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await saveDashboardLayout(items);
                  setOpen(false);
                })
              }
            >
              {pending ? "Saving…" : "Save layout"}
            </Button>
          </>
        }
      >
        <ul className="flex flex-col gap-2">
          {items.map((w, i) => (
            <li
              key={w.id}
              className={cn(
                "flex items-center gap-2 rounded-xl border border-line px-3 py-2 transition-opacity",
                !w.visible && "opacity-55",
              )}
            >
              <div className="flex flex-col">
                <button type="button" aria-label={`Move ${titles[w.id]} up`} onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-0.5 text-muted hover:text-ink disabled:opacity-30">
                  <ArrowUp className="size-4" />
                </button>
                <button type="button" aria-label={`Move ${titles[w.id]} down`} onClick={() => move(i, 1)} disabled={i === items.length - 1} className="rounded p-0.5 text-muted hover:text-ink disabled:opacity-30">
                  <ArrowDown className="size-4" />
                </button>
              </div>
              <span className="flex-1 text-[15px] font-medium">{titles[w.id]}</span>
              <div className="flex rounded-lg border border-line p-0.5" role="radiogroup" aria-label={`${titles[w.id]} size`}>
                {SIZES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    role="radio"
                    aria-checked={w.size === s.value}
                    onClick={() => patch(i, { size: s.value })}
                    className={cn("h-7 w-7 rounded-md text-xs font-semibold", w.size === s.value ? "bg-primary-600 text-white" : "text-muted hover:bg-sunken")}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => patch(i, { visible: !w.visible })}
                aria-label={w.visible ? `Hide ${titles[w.id]}` : `Show ${titles[w.id]}`}
                className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-sunken hover:text-ink"
              >
                {w.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
