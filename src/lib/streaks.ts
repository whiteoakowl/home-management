/**
 * Completion streaks ("Make bed 🔥 12-day streak"). Pure and unit-tested
 * (tests/streaks.test.ts).
 */
export type StreakDay = { date: string; status: "pending" | "done" | "skipped" | "missed" };

/**
 * Done-in-a-row count, newest first. Today (or a future date) still pending
 * doesn't break it; skipped days are passed over; a missed or overdue one ends it.
 * unit "day" when the run is on back-to-back days, otherwise "time".
 */
export function streakOf(days: StreakDay[], today: string): { count: number; unit: "day" | "time" } {
  const list = [...days].sort((a, b) => b.date.localeCompare(a.date));
  let count = 0;
  let daily = true;
  let prev: string | null = null;
  for (const d of list) {
    if (d.status === "skipped") continue;
    if (d.status === "pending" && d.date >= today) continue;
    if (d.status !== "done") break;
    if (prev && Math.round((Date.parse(prev) - Date.parse(d.date)) / 86400000) !== 1) daily = false;
    prev = d.date;
    count++;
  }
  return { count, unit: daily ? "day" : "time" };
}

export const streakLabel = (s: { count: number; unit: "day" | "time" }) => (s.unit === "day" ? `${s.count}-day streak` : `${s.count} in a row`);
