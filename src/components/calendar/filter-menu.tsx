"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LoaderCircle, SlidersHorizontal } from "lucide-react";
import { CategoryManager } from "@/app/(app)/settings/forms";
import { memberColor } from "@/lib/colors";
import { cn } from "@/lib/utils";

type Option = { key: string; label: string; color?: string | null };

/**
 * "Categories" dropdown on the calendar: a checkbox for every kind of item
 * (events, chores, dance…) and every event category the family has created.
 * Changes apply straight away and are remembered for this member.
 */
export function CalendarFilterMenu({
  baseHref,
  layers,
  shown,
  categories,
  hidden,
  canManage,
  manageItems,
}: {
  /** Fallback /calendar?… link (the current page's own query is kept when possible). */
  baseHref: string;
  layers: Option[];
  shown: string[];
  categories: Option[];
  hidden: string[];
  canManage: boolean;
  manageItems: { id: string; name: string; color: string | null }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [manage, setManage] = useState(false);
  const [pending, start] = useTransition();
  const [on, setOn] = useState(shown);
  const [off, setOff] = useState(hidden);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const go = (nextOn: string[], nextOff: string[]) => {
    setOn(nextOn);
    setOff(nextOff);
    // Keep everything else on the page (view, date, person, list range and filters).
    const params = new URLSearchParams(window.location.pathname === "/calendar" ? window.location.search : baseHref.split("?")[1] ?? "");
    params.set("layers", nextOn.join(","));
    params.set("hide", nextOff.join(","));
    const url = `/calendar?${params}`;
    start(() => router.replace(url, { scroll: false }));
  };
  const toggleLayer = (k: string) => go(on.includes(k) ? on.filter((x) => x !== k) : [...on, k], off);
  const toggleCat = (k: string) => go(on, off.includes(k) ? off.filter((x) => x !== k) : [...off, k]);

  const shownCount = on.length + (on.includes("events") ? categories.length - off.filter((k) => categories.some((c) => c.key === k)).length : 0);
  const total = layers.length + categories.length;
  const eventsOn = on.includes("events");

  const row = (o: Option, checked: boolean, onChange: () => void, disabled = false) => (
    <label key={o.key} className={cn("flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm hover:bg-sunken", disabled && "cursor-default opacity-50")}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} className="size-4 shrink-0 accent-primary-600" />
      {o.color !== undefined && <span className="size-3 shrink-0 rounded-full" style={{ background: o.color ? memberColor(o.color).solid : "var(--color-line-strong)" }} aria-hidden />}
      <span className="min-w-0 flex-1 truncate">{o.label}</span>
    </label>
  );

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-sm font-medium whitespace-nowrap hover:bg-sunken"
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <SlidersHorizontal className="size-4" aria-hidden />}
        Categories
        <span className="rounded-full bg-sunken px-1.5 text-xs text-muted tabular-nums">
          {shownCount}/{total}
        </span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div role="dialog" aria-label="Calendar categories" className="absolute top-full left-0 z-40 mt-2 flex max-h-[70vh] w-[min(20rem,calc(100vw-2rem))] flex-col overflow-y-auto rounded-2xl border border-line bg-surface p-2 shadow-lg">
          <div className="flex items-center justify-between px-2 pt-1 pb-1">
            <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">Show on calendar</p>
            <div className="flex gap-2 text-xs font-medium text-primary-700">
              <button type="button" onClick={() => go(layers.map((l) => l.key), [])}>
                All
              </button>
              <button type="button" onClick={() => go([], off)}>
                None
              </button>
            </div>
          </div>
          {layers.map((l) => row(l, on.includes(l.key), () => toggleLayer(l.key)))}
          <p className="mt-2 border-t border-line px-2 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">Event categories</p>
          {!eventsOn && <p className="px-2 pb-1 text-xs text-muted">Turn on Events to show these.</p>}
          {categories.map((c) => row(c, !off.includes(c.key), () => toggleCat(c.key), !eventsOn))}
          {canManage && (
            <div className="mt-2 border-t border-line px-1 pt-2">
              <button type="button" onClick={() => setManage((v) => !v)} className="h-9 w-full rounded-lg text-sm font-medium text-primary-700 hover:bg-primary-50">
                {manage ? "Done editing categories" : "Add / edit categories"}
              </button>
              {manage && (
                <div className="mt-2" ref={(el) => el?.scrollIntoView({ block: "nearest", behavior: "smooth" })}>
                  <CategoryManager domain="calendar" label="Event categories" items={manageItems} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
