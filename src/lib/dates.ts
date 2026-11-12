/** Date helpers that respect the family's timezone. Dates are ISO yyyy-mm-dd strings. */

export function todayIn(timezone: string, now = new Date()): string {
  // en-CA formats as yyyy-mm-dd
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatLongDate(isoDate: string) {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatShortDate(isoDate: string) {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatTime(date: Date, timezone: string) {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone });
}

export function greeting(timezone: string, now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: timezone }).format(now),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function relativeTime(date: Date, now = new Date()) {
  const s = Math.round((now.getTime() - date.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function daysBetween(fromIso: string, toIso: string) {
  return Math.round(
    (new Date(`${toIso}T12:00:00Z`).getTime() - new Date(`${fromIso}T12:00:00Z`).getTime()) / 86_400_000,
  );
}
