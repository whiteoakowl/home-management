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

/** Offset (ms) of `tz` from UTC at instant `at`. */
function tzOffset(at: Date, tz: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!, +parts.second!);
  return asUtc - at.getTime();
}

/** Wall-clock date+time in `tz` → UTC Date. time is "HH:MM". */
export function zonedToUtc(isoDate: string, time: string, tz: string): Date {
  const [h, m] = time.split(":").map(Number);
  const guess = Date.UTC(+isoDate.slice(0, 4), +isoDate.slice(5, 7) - 1, +isoDate.slice(8, 10), h || 0, m || 0);
  const first = guess - tzOffset(new Date(guess), tz);
  // Re-check across DST boundaries.
  return new Date(guess - tzOffset(new Date(first), tz));
}

/** UTC Date → { date: yyyy-mm-dd, time: HH:MM, minutes } in `tz`. */
export function utcToZoned(d: Date, tz: string) {
  const local = new Date(d.getTime() + tzOffset(d, tz));
  const iso = local.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16), minutes: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

export function weekday(isoDate: string) {
  return new Date(`${isoDate}T12:00:00Z`).getUTCDay();
}

export function startOfWeek(isoDate: string, weekStartsOn: 0 | 1 = 0) {
  const wd = weekday(isoDate);
  return addDays(isoDate, -((wd - weekStartsOn + 7) % 7));
}

export function startOfMonth(isoDate: string) {
  return `${isoDate.slice(0, 7)}-01`;
}

export function addMonths(isoDate: string, n: number) {
  const d = new Date(`${isoDate.slice(0, 7)}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

export function monthLabel(isoDate: string) {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}
