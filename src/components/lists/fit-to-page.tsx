"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Fits its contents on one printed page. It tries 1–5 columns and font sizes
 * from 12pt down to 6.5pt, measuring at the printable width of the narrower
 * paper (A4) and the shorter page (Letter), and keeps the largest text that
 * fits. Runs when the page loads and again just before printing.
 */
const PAGE_W = 7.55 * 96; // A4 width minus margins, in CSS px
const PAGE_H = 10.25 * 96 * 0.9; // Letter height minus margins, with room to spare (print fonts differ slightly)
/** Most readable first: big text in few columns; more columns only with smaller text. */
const MAX_FONT = [0, 12, 12, 11, 9.5, 8]; // by column count
const TRIES: [number, number][] = [];
for (const font of [12, 11, 10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5]) for (const cols of [1, 2, 3, 4, 5]) if (font <= MAX_FONT[cols]!) TRIES.push([cols, font]);

export function FitToPage({ children, className }: { children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const cols = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fit = () => {
      const b = box.current;
      const c = cols.current;
      if (!b || !c) return;
      const old = b.style.width;
      b.style.width = `${PAGE_W}px`;
      let chosen = TRIES[TRIES.length - 1]!;
      // Biggest text first; within a size, fewest columns.
      for (const t of TRIES) {
        b.style.fontSize = `${t[1]}pt`;
        c.style.columnCount = String(t[0]);
        if (b.scrollHeight <= PAGE_H) {
          chosen = t;
          break;
        }
      }
      b.style.fontSize = `${chosen[1]}pt`;
      c.style.columnCount = String(chosen[0]);
      b.style.width = old;
      b.dataset.fit = `${chosen[0]}x${chosen[1]}`;
    };
    fit();
    window.addEventListener("beforeprint", fit);
    const mq = window.matchMedia?.("print");
    mq?.addEventListener?.("change", fit);
    return () => {
      window.removeEventListener("beforeprint", fit);
      mq?.removeEventListener?.("change", fit);
    };
  }, []);
  return (
    <div ref={box} className={className} style={{ lineHeight: 1.25 }}>
      {Array.isArray(children) ? children[0] : null}
      <div ref={cols} style={{ columnGap: "1.6em" }}>
        {Array.isArray(children) ? children.slice(1) : children}
      </div>
    </div>
  );
}
