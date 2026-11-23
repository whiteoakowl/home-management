/**
 * Work schedules: one-off shifts plus regular weekly schedules ("Mon–Fri,
 * 9–5") that repeat until changed. Days off (vacation, sick, holidays) skip
 * the regular schedule; a one-off shift on a day off still shows (they were
 * called in). Pure, so the Work page, the calendar and tests share it.
 */
import { addDays } from "./dates";

export type Pattern = { id: string; memberId: string; weekdays: number[]; startTime: string; endTime: string; job: string | null; notes: string | null; startsOn: string; endsOn: string | null };
export type OneOff = { id: string; memberId: string; date: string; startTime: string; endTime: string; job: string | null; notes: string | null };
export type TimeOff = { id: string; memberId: string; kind: string; title: string | null; startDate: string; endDate: string; notes?: string | null };
export type Shift = OneOff & { patternId: string | null };

export const TIME_OFF_KINDS = [
  { value: "vacation", label: "Vacation", emoji: "🏖️" },
  { value: "sick", label: "Sick day", emoji: "🤒" },
  { value: "holiday", label: "Holiday", emoji: "🎉" },
  { value: "personal", label: "Personal day", emoji: "🙋" },
  { value: "other", label: "Day off", emoji: "📅" },
] as const;

export const timeOffLabel = (t: Pick<TimeOff, "kind" | "title">) => t.title || TIME_OFF_KINDS.find((k) => k.value === t.kind)?.label || "Day off";
export const timeOffEmoji = (kind: string) => TIME_OFF_KINDS.find((k) => k.value === kind)?.emoji ?? "📅";

const weekdayOf = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();

/** The time off covering a member on a date, if any. */
export const offOn = (off: TimeOff[], memberId: string, date: string) => off.find((o) => o.memberId === memberId && o.startDate <= date && o.endDate >= date) ?? null;

/** Every shift between from and to (inclusive): one-offs plus the regular schedule, minus days off. */
export function shiftsBetween(patterns: Pattern[], oneOffs: OneOff[], off: TimeOff[], from: string, to: string): Shift[] {
  const out: Shift[] = oneOffs.filter((s) => s.date >= from && s.date <= to).map((s) => ({ ...s, patternId: null }));
  for (const p of patterns) {
    const start = p.startsOn > from ? p.startsOn : from;
    const end = p.endsOn && p.endsOn < to ? p.endsOn : to;
    for (let d = start; d <= end; d = addDays(d, 1)) {
      if (!p.weekdays.includes(weekdayOf(d))) continue;
      if (offOn(off, p.memberId, d)) continue;
      out.push({ id: `${p.id}:${d}`, memberId: p.memberId, date: d, startTime: p.startTime, endTime: p.endTime, job: p.job, notes: p.notes, patternId: p.id });
    }
  }
  return out.sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date < b.date ? -1 : 1));
}

/** "Mon–Fri", "Mon, Wed, Fri", "Every day" (week starting Monday). */
export function weekdaysText(days: number[]) {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const order = [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d));
  if (order.length === 7) return "Every day";
  if (order.length >= 3) {
    const idx = order.map((d) => [1, 2, 3, 4, 5, 6, 0].indexOf(d));
    if (idx.every((v, i) => i === 0 || v === idx[i - 1]! + 1)) return `${names[order[0]!]}–${names[order[order.length - 1]!]}`;
  }
  return order.map((d) => names[d]).join(", ");
}

/** Number of work days a time-off range covers on the regular schedule (for "uses 5 work days"). */
export function workDaysCovered(patterns: Pattern[], memberId: string, startDate: string, endDate: string) {
  let n = 0;
  for (let d = startDate; d <= endDate; d = addDays(d, 1)) if (patterns.some((p) => p.memberId === memberId && p.weekdays.includes(weekdayOf(d)) && p.startsOn <= d && (!p.endsOn || p.endsOn >= d))) n++;
  return n;
}
