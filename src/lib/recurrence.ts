/**
 * Recurrence engine (RFC 5545-lite). Pure functions over ISO dates, shared by
 * chores, cleaning, calendar events, workouts and recurring transactions.
 */
import { addDays } from "./dates";

export type Freq = "daily" | "weekly" | "monthly" | "yearly";

export type Rule = {
  freq: Freq;
  interval: number;
  byWeekday?: number[] | null; // 0=Sun…6=Sat (weekly)
  byMonthDay?: number[] | null; // 1…31 (monthly)
  byMonth?: number[] | null; // 1…12 (yearly, also "seasonal" cadences)
  startsOn: string;
  until?: string | null;
  count?: number | null;
};

const d = (iso: string) => new Date(`${iso}T12:00:00Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);
const monthsBetween = (a: Date, b: Date) =>
  (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

/** Does `date` match the rule (ignoring count)? */
function matches(rule: Rule, date: string): boolean {
  if (date < rule.startsOn || (rule.until && date > rule.until)) return false;
  const start = d(rule.startsOn);
  const cur = d(date);
  const interval = Math.max(1, rule.interval || 1);

  switch (rule.freq) {
    case "daily": {
      const diff = Math.round((cur.getTime() - start.getTime()) / 86_400_000);
      return diff % interval === 0;
    }
    case "weekly": {
      const days = rule.byWeekday?.length ? rule.byWeekday : [start.getUTCDay()];
      if (!days.includes(cur.getUTCDay())) return false;
      // Week index measured from the Sunday on/before the start date.
      const startWeek = addDays(rule.startsOn, -start.getUTCDay());
      const weeks = Math.floor((cur.getTime() - d(startWeek).getTime()) / (7 * 86_400_000));
      return weeks % interval === 0;
    }
    case "monthly": {
      if (monthsBetween(start, cur) % interval !== 0) return false;
      const want = rule.byMonthDay?.length ? rule.byMonthDay : [start.getUTCDate()];
      const last = daysIn(cur.getUTCFullYear(), cur.getUTCMonth());
      // Days past month-end clamp to the last day (e.g. 31st → Feb 28).
      return want.some((w) => Math.min(w, last) === cur.getUTCDate());
    }
    case "yearly": {
      const months = rule.byMonth?.length ? rule.byMonth : [start.getUTCMonth() + 1];
      if (!months.includes(cur.getUTCMonth() + 1)) return false;
      if ((cur.getUTCFullYear() - start.getUTCFullYear()) % interval !== 0) return false;
      const day = Math.min(start.getUTCDate(), daysIn(cur.getUTCFullYear(), cur.getUTCMonth()));
      return cur.getUTCDate() === day;
    }
  }
}

/** All occurrence dates in [from, to] (inclusive). Respects count. */
export function occurrencesBetween(rule: Rule, from: string, to: string, max = 400): string[] {
  const out: string[] = [];
  // Count needs enumeration from the start; otherwise start at `from`.
  let cursor = rule.count ? rule.startsOn : from > rule.startsOn ? from : rule.startsOn;
  let seen = 0;
  for (let i = 0; i < 4000 && cursor <= to && out.length < max; i++) {
    if (matches(rule, cursor)) {
      seen++;
      if (rule.count && seen > rule.count) break;
      if (cursor >= from) out.push(cursor);
    }
    cursor = addDays(cursor, 1);
  }
  return out;
}

export function nextOccurrence(rule: Rule, onOrAfter: string): string | null {
  return occurrencesBetween(rule, onOrAfter, addDays(onOrAfter, 800), 1)[0] ?? null;
}

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ord = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;

/** Human description, e.g. "Every 2 weeks on Mon, Thu". */
export function describeRule(rule: Rule | null | undefined): string {
  if (!rule) return "Does not repeat";
  const n = Math.max(1, rule.interval || 1);
  const every = (unit: string) => (n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`);
  switch (rule.freq) {
    case "daily":
      return n === 1 ? "Daily" : every("day");
    case "weekly": {
      const days = (rule.byWeekday?.length ? rule.byWeekday : [d(rule.startsOn).getUTCDay()]).slice().sort();
      const list = days.length === 7 ? "every day" : days.map((x) => WD[x]).join(", ");
      return `${n === 1 ? "Weekly" : every("week")} on ${list}`;
    }
    case "monthly": {
      const days = rule.byMonthDay?.length ? rule.byMonthDay : [d(rule.startsOn).getUTCDate()];
      return `${n === 1 ? "Monthly" : every("month")} on the ${days.map(ord).join(", ")}`;
    }
    case "yearly": {
      const months = rule.byMonth?.length ? rule.byMonth : [d(rule.startsOn).getUTCMonth() + 1];
      const label = n === 1 ? (months.length > 1 ? "Each year" : "Yearly") : every("year");
      return `${label} in ${months.map((m) => MO[m - 1]).join(", ")}`;
    }
  }
}

/** Preset cadences used by the cleaning system and quick forms. */
export const CADENCE_PRESETS = {
  daily: { freq: "daily", interval: 1 },
  weekly: { freq: "weekly", interval: 1 },
  monthly: { freq: "monthly", interval: 1 },
  seasonal: { freq: "yearly", interval: 1, byMonth: [3, 6, 9, 12] },
  biannual: { freq: "yearly", interval: 1, byMonth: [4, 10] },
  annual: { freq: "yearly", interval: 1 },
} as const satisfies Record<string, Partial<Rule>>;

/**
 * Parse recurrence form fields (see components/forms/recurrence-field.tsx):
 * repeat=none|daily|weekly|monthly|yearly, interval, weekday (multi),
 * monthDay, month (multi), until, count.
 */
export function ruleFromForm(form: FormData, startsOn: string): Omit<Rule, "startsOn"> & { startsOn: string } | null {
  const freq = String(form.get("repeat") ?? "none");
  if (!["daily", "weekly", "monthly", "yearly"].includes(freq)) return null;
  const nums = (key: string) =>
    form
      .getAll(key)
      .map(Number)
      .filter((n) => Number.isFinite(n));
  const interval = Math.min(99, Math.max(1, Number(form.get("interval")) || 1));
  const until = String(form.get("until") ?? "") || null;
  const count = Number(form.get("count")) || null;
  return {
    freq: freq as Freq,
    interval,
    byWeekday: freq === "weekly" ? nums("weekday").filter((n) => n >= 0 && n <= 6) : null,
    byMonthDay: freq === "monthly" ? nums("monthDay").filter((n) => n >= 1 && n <= 31) : null,
    byMonth: freq === "yearly" ? nums("month").filter((n) => n >= 1 && n <= 12) : null,
    startsOn,
    until,
    count,
  };
}

export { iso as toIso };
