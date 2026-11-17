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
