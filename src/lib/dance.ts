/**
 * Dance schedule helpers (pure, unit-tested in tests/dance.test.ts).
 * Weekly classes repeat on their weekday within the season, except on days off.
 */
import { addDays } from "./dates";

export type ClassRule = { memberId: string; weekday: number; startsOn: string | null; endsOn: string | null };
export type DayOff = { memberId: string | null; startDate: string; endDate: string; title: string };

const weekdayOf = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

/** The day off (if any) covering this date for this dancer. Studio-wide days off (memberId null) cover everyone. */
export function dayOffFor(date: string, memberId: string, daysOff: DayOff[]) {
  return daysOff.find((d) => (d.memberId === null || d.memberId === memberId) && date >= d.startDate && date <= d.endDate) ?? null;
}

/** Dates a weekly class meets between from and to (inclusive), skipping days off and outside the season. */
export function classDates(c: ClassRule, from: string, to: string, daysOff: DayOff[]): string[] {
  const start = c.startsOn && c.startsOn > from ? c.startsOn : from;
  const end = c.endsOn && c.endsOn < to ? c.endsOn : to;
  const out: string[] = [];
  if (start > end) return out;
  let d = addDays(start, (c.weekday - weekdayOf(start) + 7) % 7);
  while (d <= end) {
    if (!dayOffFor(d, c.memberId, daysOff)) out.push(d);
    d = addDays(d, 7);
  }
  return out;
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "16:30:00" → "4:30 PM" */
export function fmtTime(t: string | null | undefined) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number) as [number, number];
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Minutes since midnight from "HH:MM[:SS]". */
export const minutesOf = (t: string | null | undefined) => {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number) as [number, number];
  return h * 60 + m;
};

/** Total shift hours for a list of shifts (overnight shifts wrap past midnight). */
export function shiftHours(shifts: { startTime: string; endTime: string }[]) {
  let mins = 0;
  for (const s of shifts) {
    const a = minutesOf(s.startTime)!;
    const b = minutesOf(s.endTime)!;
    mins += b > a ? b - a : b + 24 * 60 - a;
  }
  return Math.round((mins / 60) * 10) / 10;
}

// ─── Pointe shoes ────────────────────────────────────────────────────────────

export type PointePair = { status: "ordered" | "on_hand" | "in_use" | "retired"; firstWornOn: string | null; retiredOn: string | null; reorderBy: string | null };
export type ReorderDue = { date: string | null; status: "ordered" | "now" | "soon" | "ok"; lifeDays: number; estimated: boolean };

const daysBetweenIso = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

/** How long this dancer's pairs last on average (retired pairs with both dates), or null if unknown. */
export function pairLifeDays(pairs: PointePair[]): number | null {
  const lives = pairs.filter((p) => p.status === "retired" && p.firstWornOn && p.retiredOn).map((p) => daysBetweenIso(p.firstWornOn!, p.retiredOn!)).filter((d) => d > 0);
  return lives.length ? Math.round(lives.reduce((s, d) => s + d, 0) / lives.length) : null;
}

/**
 * When to order the next pair. The pair in use is expected to last as long as
 * past pairs did (6 weeks if we don't know yet), each spare on hand adds one
 * more lifetime, and we order `leadDays` ahead for shipping and fitting.
 * A date set by hand on a pair wins. A pair already on order means nothing is due.
 */
export function reorderDue(pairs: PointePair[], today: string, opts: { leadDays?: number; defaultLifeDays?: number } = {}): ReorderDue {
  const lead = opts.leadDays ?? 14;
  const known = pairLifeDays(pairs);
  const life = known ?? opts.defaultLifeDays ?? 42;
  const status = (date: string) => (date <= today ? "now" : date <= addDays(today, 7) ? "soon" : "ok") as ReorderDue["status"];
  if (pairs.some((p) => p.status === "ordered")) return { date: null, status: "ordered", lifeDays: life, estimated: !known };
  const manual = pairs
    .filter((p) => p.status !== "retired" && p.reorderBy)
    .map((p) => p.reorderBy!)
    .sort()[0];
  if (manual) return { date: manual, status: status(manual), lifeDays: life, estimated: false };
  const inUse = pairs.filter((p) => p.status === "in_use").map((p) => p.firstWornOn ?? today).sort().reverse()[0];
  const spares = pairs.filter((p) => p.status === "on_hand").length;
  if (!inUse && !spares) return { date: today, status: "now", lifeDays: life, estimated: !known };
  const start = inUse ?? today;
  const date = addDays(start, life * ((inUse ? 1 : 0) + spares) - lead);
  return { date, status: status(date), lifeDays: life, estimated: !known };
}
