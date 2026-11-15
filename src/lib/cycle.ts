/**
 * Period tracker maths. Pure functions (unit-tested in tests/cycle.test.ts).
 *
 * Periods are worked out from the days someone recorded a flow of light, medium or
 * heavy (spotting alone doesn't start a period). Everything predicted here is an
 * ESTIMATE based on the person's own records. It is never a medical fact, and it is
 * not reliable as contraception.
 */
import { addDays, daysBetween } from "./dates";

export const FLOWS = [
  { key: "none", label: "None" },
  { key: "spotting", label: "Spotting" },
  { key: "light", label: "Light" },
  { key: "medium", label: "Medium" },
  { key: "heavy", label: "Heavy" },
] as const;
export type Flow = (typeof FLOWS)[number]["key"];

export const PHYSICAL_SYMPTOMS = ["Cramps", "Headache", "Backache", "Bloating", "Breast tenderness", "Fatigue", "Nausea", "Acne", "Appetite changes", "Sleep changes"];
export const CYCLE_FEELINGS = ["Happy", "Calm", "Energetic", "Irritable", "Sad", "Anxious", "Stressed", "Low energy"];

const isPeriodFlow = (f: string | null | undefined) => f === "light" || f === "medium" || f === "heavy";

export type DayRecord = { date: string; flow: string | null };
export type Period = { start: string; end: string; length: number };
export type Cycle = { start: string; end: string; length: number; periodLength: number };

/** Group period-flow days into periods. A gap of one day without flow still counts as the same period. */
export function periodsFrom(days: DayRecord[]): Period[] {
  const dates = days
    .filter((d) => isPeriodFlow(d.flow))
    .map((d) => d.date)
    .sort();
  const out: Period[] = [];
  for (const d of dates) {
    const last = out[out.length - 1];
    if (last && daysBetween(last.end, d) <= 2) {
      last.end = d;
      last.length = daysBetween(last.start, d) + 1;
    } else out.push({ start: d, end: d, length: 1 });
  }
  return out;
}

/** Completed cycles: from one period's first day to the day before the next period. */
export function cyclesFrom(periods: Period[]): Cycle[] {
  const out: Cycle[] = [];
  for (let i = 0; i + 1 < periods.length; i++) {
    const p = periods[i]!;
    const next = periods[i + 1]!;
    out.push({ start: p.start, end: addDays(next.start, -1), length: daysBetween(p.start, next.start), periodLength: p.length });
  }
  return out;
}

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null);

export type CycleStats = {
  recordedCycles: number;
  averageCycle: number | null;
  shortestCycle: number | null;
  longestCycle: number | null;
  recentCycle: number | null;
  averagePeriod: number | null;
};

/** Statistics from the person's own records (averages use up to the last 6 cycles). */
export function cycleStats(periods: Period[]): CycleStats {
  const cycles = cyclesFrom(periods);
  const lengths = cycles.map((c) => c.length);
  const recent = lengths.slice(-6);
  return {
    recordedCycles: cycles.length,
    averageCycle: avg(recent),
    shortestCycle: lengths.length ? Math.min(...lengths) : null,
    longestCycle: lengths.length ? Math.max(...lengths) : null,
    recentCycle: lengths.length ? lengths[lengths.length - 1]! : null,
    averagePeriod: avg(periods.slice(-6).map((p) => p.length)),
  };
}

export type Phase = "period" | "between" | "follicular" | "fertile" | "ovulation" | "luteal" | "late";
export const PHASE_LABEL: Record<Phase, string> = {
  period: "Period",
  between: "Between periods",
  follicular: "Before the ovulation window",
  fertile: "Estimated ovulation window",
  ovulation: "Estimated ovulation day",
  luteal: "After ovulation",
  late: "Period expected any day",
};

export type CycleEstimate = {
  /** Day 1 = first day of the latest period. Null until a period is recorded. */
  cycleDay: number | null;
  phase: Phase | null;
  lastPeriod: Period | null;
  cycleLength: number;
  periodLength: number;
  /** True when based on the person's typical lengths rather than recorded cycles. */
  usingTypical: boolean;
  nextPeriodStart: string | null;
  ovulation: string | null;
  fertileStart: string | null;
  fertileEnd: string | null;
};

/**
 * Estimates from recorded history: next period = last start + average cycle;
 * ovulation ≈ 14 days before the next period; fertile window ≈ 5 days before
 * ovulation through 1 day after. Falls back to the person's typical lengths.
 */
export function estimate(days: DayRecord[], today: string, typical: { cycle: number; period: number }, opts: { ovulation?: boolean } = {}): CycleEstimate {
  const showOvulation = opts.ovulation ?? true;
  const periods = periodsFrom(days);
  const stats = cycleStats(periods);
  const cycleLength = Math.round(stats.averageCycle ?? typical.cycle);
  const periodLength = Math.round(stats.averagePeriod ?? typical.period);
  const lastPeriod = periods[periods.length - 1] ?? null;
  const base = { lastPeriod, cycleLength, periodLength, usingTypical: stats.averageCycle === null };
  if (!lastPeriod || lastPeriod.start > today) return { ...base, cycleDay: null, phase: null, nextPeriodStart: null, ovulation: null, fertileStart: null, fertileEnd: null };

  const cycleDay = daysBetween(lastPeriod.start, today) + 1;
  // Next expected start; if it has already passed without a record, the period is "late" (expected any day).
  const nextPeriodStart = addDays(lastPeriod.start, cycleLength);
  const ovulation = addDays(nextPeriodStart, -14);
  const fertileStart = addDays(ovulation, -5);
  const fertileEnd = addDays(ovulation, 1);
  let phase: Phase;
  if (today <= lastPeriod.end || cycleDay <= periodLength) phase = "period";
  else if (today >= nextPeriodStart) phase = "late";
  else if (!showOvulation) phase = "between";
  else if (today === ovulation) phase = "ovulation";
  else if (today >= fertileStart && today <= fertileEnd) phase = "fertile";
  else if (today < fertileStart) phase = "follicular";
  else phase = "luteal";
  if (!showOvulation) return { ...base, cycleDay, phase, nextPeriodStart, ovulation: null, fertileStart: null, fertileEnd: null };
  return { ...base, cycleDay, phase, nextPeriodStart, ovulation, fertileStart, fertileEnd };
}

export type DayMark = "period" | "predicted" | "fertile" | "ovulation";

/** Predicted marks for upcoming cycles (for the calendar), never overlapping recorded days. */
export function predictedMarks(e: CycleEstimate, cycles = 3): Map<string, DayMark> {
  const out = new Map<string, DayMark>();
  if (!e.nextPeriodStart) return out;
  for (let c = 0; c < cycles; c++) {
    const start = addDays(e.nextPeriodStart, c * e.cycleLength);
    for (let i = 0; i < e.periodLength; i++) out.set(addDays(start, i), "predicted");
    if (!e.ovulation) continue; // simple tracking: no ovulation marks
    const ov = addDays(start, -14);
    for (let i = -5; i <= 1; i++) if (!out.has(addDays(ov, i))) out.set(addDays(ov, i), "fertile");
    out.set(ov, "ovulation");
  }
  return out;
}
