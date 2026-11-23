/**
 * Pregnancy date maths. Pure (tests/pregnancy.test.ts). Dates are estimates:
 * every screen that shows them says so.
 *
 * Pregnancy is counted from the first day of the last menstrual period (LMP):
 * the estimated due date is LMP + 280 days (40 weeks), or conception + 266
 * days, or IVF transfer + (266 − embryo age in days).
 */
import { addDays, daysBetween } from "../dates";

export const FULL_TERM_DAYS = 280;

export type DueInputs = { due?: string | null; lmp?: string | null; conception?: string | null; ivfTransfer?: string | null; embryoDays?: number | null };

/** A real calendar date (2026-02-30 is not). */
const valid = (d: string | null | undefined): d is string => {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t = Date.parse(`${d}T12:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === d;
};

/** Work out the estimated due date from whatever is known (an entered due date wins). */
export function estimateDueDate(i: DueInputs): { due: string; source: "due" | "lmp" | "conception" | "ivf" } | null {
  if (valid(i.due)) return { due: i.due, source: "due" };
  if (valid(i.ivfTransfer)) {
    const age = i.embryoDays && [3, 5, 6].includes(i.embryoDays) ? i.embryoDays : 5;
    return { due: addDays(i.ivfTransfer, 266 - age), source: "ivf" };
  }
  if (valid(i.conception)) return { due: addDays(i.conception, 266), source: "conception" };
  if (valid(i.lmp)) return { due: addDays(i.lmp, FULL_TERM_DAYS), source: "lmp" };
  return null;
}

export type Gestation = {
  /** Days since the (estimated) LMP. */
  days: number;
  /** Completed weeks (the "24" in "24 weeks 3 days"). */
  weeks: number;
  /** Days into the current week (0–6). */
  dayOfWeek: number;
  /** The week you're in (1-based, as apps show "Week 25"). */
  week: number;
  trimester: 1 | 2 | 3;
  daysLeft: number;
  /** 0–100 of 40 weeks (can go past 100 after the due date). */
  progress: number;
  pastDue: boolean;
};

/** Where the pregnancy is on a given day, from the estimated due date. */
export function gestationOn(due: string, today: string): Gestation | null {
  if (!valid(due) || !valid(today)) return null;
  const daysLeft = daysBetween(today, due);
  const days = FULL_TERM_DAYS - daysLeft;
  if (days < 0) return null; // before the LMP: not pregnant yet on that date
  const weeks = Math.floor(days / 7);
  return {
    days,
    weeks,
    dayOfWeek: days % 7,
    week: Math.min(weeks + 1, 45),
    trimester: weeks < 13 ? 1 : weeks < 27 ? 2 : 3,
    daysLeft,
    progress: Math.round((days / FULL_TERM_DAYS) * 1000) / 10,
    pastDue: daysLeft < 0,
  };
}

/** The pregnancy week on a past date (for journal entries and the timeline). */
export const weekOn = (due: string | null, date: string) => (due ? (gestationOn(due, date)?.week ?? null) : null);

export const trimesterOfWeek = (week: number): 1 | 2 | 3 => (week <= 13 ? 1 : week <= 27 ? 2 : 3);

export const TRIMESTERS = {
  1: { label: "First trimester", weeks: "Weeks 1–13", from: 1, to: 13 },
  2: { label: "Second trimester", weeks: "Weeks 14–27", from: 14, to: 27 },
  3: { label: "Third trimester", weeks: "Weeks 28–40+", from: 28, to: 42 },
} as const;

/** "24 weeks, 3 days". */
export const gestationText = (g: Gestation) => `${g.weeks} week${g.weeks === 1 ? "" : "s"}${g.dayOfWeek ? `, ${g.dayOfWeek} day${g.dayOfWeek === 1 ? "" : "s"}` : ""}`;

/** "112 days to go (16 weeks)" or "3 days past the due date". */
export function countdownText(g: Gestation) {
  if (g.daysLeft === 0) return "Due date is today";
  if (g.daysLeft < 0) return `${-g.daysLeft} day${g.daysLeft === -1 ? "" : "s"} past the estimated due date`;
  const w = Math.floor(g.daysLeft / 7);
  return `${g.daysLeft} day${g.daysLeft === 1 ? "" : "s"} to go${w ? ` (about ${w} week${w === 1 ? "" : "s"})` : ""}`;
}

/** Validate setup dates: nothing absurd (due date within ~44 weeks ahead, LMP not in the future). */
export function checkDates(i: DueInputs, today: string): string | null {
  for (const [k, v] of Object.entries(i)) if (k !== "embryoDays" && v && !valid(String(v))) return "One of the dates isn't a real date.";
  if (valid(i.lmp) && i.lmp > today) return "The last period can't be in the future.";
  if (valid(i.conception) && i.conception > today) return "The conception date can't be in the future.";
  if (valid(i.ivfTransfer) && i.ivfTransfer > today) return "The transfer date can't be in the future.";
  const est = estimateDueDate(i);
  if (est && daysBetween(today, est.due) > 300) return "That due date is more than 42 weeks away. Check the dates.";
  if (est && daysBetween(est.due, today) > 365) return "That due date was over a year ago. Add it as a past pregnancy and mark it completed.";
  return null;
}

// ─── Kick counts & contractions ─────────────────────────────────────────────

/** Minutes it took to reach `target` movements (null if not reached). */
export function minutesToCount(times: string[], start: string, target = 10) {
  if (times.length < target) return null;
  return Math.round(((Date.parse(times[target - 1]!) - Date.parse(start)) / 60_000) * 10) / 10;
}

export type Contraction = { s: string; e: string | null };

/** Duration (seconds) of each contraction and the interval (start to start, minutes) from the one before. */
export function contractionStats(list: Contraction[]) {
  const done = list.filter((c) => c.e);
  const rows = done.map((c, i) => ({
    start: c.s,
    seconds: Math.round((Date.parse(c.e!) - Date.parse(c.s)) / 1000),
    interval: i ? Math.round(((Date.parse(c.s) - Date.parse(done[i - 1]!.s)) / 60_000) * 10) / 10 : null,
  }));
  const last = rows.slice(-6);
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null);
  return {
    rows,
    count: rows.length,
    avgSeconds: avg(last.map((r) => r.seconds)),
    avgInterval: avg(last.map((r) => r.interval).filter((x): x is number => x !== null)),
    spanMinutes: rows.length ? Math.round((Date.parse(done[done.length - 1]!.e!) - Date.parse(done[0]!.s)) / 60_000) : 0,
  };
}
