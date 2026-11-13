/**
 * Cleanliness meters: how "fresh" a cleaning task is, from the time since it
 * was last done relative to how often it should be done. Pure (unit-tested).
 */
export type RuleLike = { freq: string; interval: number; byWeekday?: number[] | null; byMonth?: number[] | null } | null;

const CADENCE_DAYS: Record<string, number> = { daily: 1, weekly: 7, monthly: 30, seasonal: 91, biannual: 182, annual: 365 };

/** Typical days between occurrences. */
export function intervalDays(rule: RuleLike, cadence?: string | null): number {
  if (rule) {
    const base = { daily: 1, weekly: 7, monthly: 30, yearly: 365 }[rule.freq] ?? 7;
    let days = base * Math.max(1, rule.interval);
    if (rule.freq === "weekly" && rule.byWeekday && rule.byWeekday.length > 1) days = (7 * rule.interval) / rule.byWeekday.length;
    if (rule.freq === "yearly" && rule.byMonth && rule.byMonth.length > 1) days = (365 * rule.interval) / rule.byMonth.length;
    return Math.max(1, days);
  }
  return CADENCE_DAYS[cadence ?? ""] ?? 7;
}

/** 1 = just cleaned, 0 = due or overdue. Never done counts as due. */
export function condition(lastDoneIso: string | null, interval: number, today: string): number {
  if (!lastDoneIso) return 0;
  const days = (Date.parse(`${today}T12:00:00Z`) - Date.parse(`${lastDoneIso.slice(0, 10)}T12:00:00Z`)) / 864e5;
  return Math.max(0, Math.min(1, 1 - days / interval));
}

export function conditionLabel(c: number) {
  if (c >= 0.66) return { label: "Fresh", tone: "primary" as const };
  if (c >= 0.33) return { label: "Getting dusty", tone: "olive" as const };
  if (c > 0) return { label: "Needs attention", tone: "wine" as const };
  return { label: "Due now", tone: "wine" as const };
}
