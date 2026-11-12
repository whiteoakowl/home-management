"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** Lightweight dropdown menu: closes on outside click, Escape, or navigation. */
export function Menu({ label, trigger, children }: { label: string; trigger: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex rounded-full"
      >
        {trigger}
      </button>
      {open && (
        <div
          id={id}
          role="menu"
          onClick={() => setOpen(false)}
          className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-pop)]"
        >
          {children}
        </div>
      )}
    </div>
  );
}

const itemCls = "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[15px] text-ink-soft hover:bg-sunken hover:text-ink";

export function MenuItem({
  href,
  icon,
  children,
  as,
}: {
  href?: string;
  icon?: ReactNode;
  children: ReactNode;
  as?: "button";
}) {
  if (as === "button" || !href) {
    return (
      <button type="submit" role="menuitem" className={itemCls}>
        {icon}
        {children}
      </button>
    );
  }
  return (
    <Link href={href} role="menuitem" className={itemCls}>
      {icon}
      {children}
    </Link>
  );
}
