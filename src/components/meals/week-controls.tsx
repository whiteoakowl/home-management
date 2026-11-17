"use client";

import { useEffect, useTransition } from "react";
import { FileDown, LoaderCircle, Printer } from "lucide-react";
import { setMealWeekStart } from "@/app/actions/meals";
import { runVoid } from "@/components/forms/inline";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "Week starts on" picker for the meal planner. Saves right away. */
export function WeekStartPicker({ value, privateSpace }: { value: number; privateSpace?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <label className="inline-flex shrink-0 items-center gap-1.5 text-sm text-muted">
      {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
      <span className="whitespace-nowrap">Week starts</span>
      <select
        aria-label="Week starts on"
        defaultValue={String(value)}
        disabled={pending}
        onChange={(e) => {
          const fd = new FormData();
          fd.set("day", e.target.value);
          if (privateSpace) fd.set("space", "mine");
          start(() => runVoid(setMealWeekStart, fd));
        }}
        className="h-10 rounded-full border border-line bg-surface pr-7 pl-3 text-sm font-medium text-ink"
      >
        {DAYS.map((d, i) => (
          <option key={d} value={i}>
            {d}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Print and PDF icon buttons: open the printable plan in a new tab. */
export function PrintPdfButtons({ href }: { href: string }) {
  const sep = href.includes("?") ? "&" : "?";
  const cls = "inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface text-ink hover:bg-sunken";
  return (
    <div className="flex gap-2">
      <a href={`${href}${sep}auto=print`} target="_blank" rel="noopener" aria-label="Print meal plan" title="Print meal plan" className={cls}>
        <Printer className="size-5" />
      </a>
      <a href={`${href}${sep}auto=pdf`} target="_blank" rel="noopener" aria-label="Save meal plan as PDF" title="Save as PDF" className={cls}>
        <FileDown className="size-5" />
      </a>
    </div>
  );
}

/** On the printable page: open the print dialog once it has loaded. */
export function AutoPrint({ when }: { when: boolean }) {
  useEffect(() => {
    if (!when) return;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [when]);
  return null;
}
