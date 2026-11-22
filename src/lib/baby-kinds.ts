/**
 * Baby tracker: what can be logged, and the pure maths for the Today screen
 * (age, time since, today's totals, what's next on the schedule). No DB here,
 * so it's safe for client components and unit tests.
 */
import type { BabyLogKind } from "@/db/schema/baby";

export type { BabyLogKind };

export type KindMeta = { label: string; emoji: string; group: "feeding" | "diaper" | "sleep" | "health" | "growth" | "moments" | "care" | "family"; timer?: boolean; add: string };

export const BABY_KINDS: Record<BabyLogKind, KindMeta> = {
  nursing: { label: "Breastfeeding", emoji: "🤱", group: "feeding", timer: true, add: "Log breastfeeding" },
  bottle: { label: "Bottle", emoji: "🍼", group: "feeding", add: "Log a bottle" },
  solids: { label: "Meal / solids", emoji: "🥣", group: "feeding", add: "Log a meal" },
  pump: { label: "Pumping", emoji: "🍶", group: "feeding", timer: true, add: "Log pumping" },
  diaper: { label: "Diaper", emoji: "🧷", group: "diaper", add: "Log a diaper" },
  sleep: { label: "Sleep", emoji: "😴", group: "sleep", timer: true, add: "Log sleep" },
  tummy: { label: "Tummy time", emoji: "🧸", group: "care", timer: true, add: "Log tummy time" },
  bath: { label: "Bath", emoji: "🛁", group: "care", add: "Log a bath" },
  activity: { label: "Activity", emoji: "🎈", group: "care", add: "Log an activity" },
  growth: { label: "Growth", emoji: "📏", group: "growth", add: "Log growth" },
  temperature: { label: "Temperature", emoji: "🌡️", group: "health", add: "Log temperature" },
  medicine: { label: "Medicine", emoji: "💊", group: "health", add: "Log medicine" },
  symptom: { label: "Symptom", emoji: "🤧", group: "health", add: "Log a symptom" },
  vaccine: { label: "Vaccine", emoji: "💉", group: "health", add: "Log a vaccine" },
  doctor: { label: "Doctor visit", emoji: "🩺", group: "health", add: "Log a doctor visit" },
  teeth: { label: "Tooth", emoji: "🦷", group: "moments", add: "Log a tooth" },
  milestone: { label: "Milestone", emoji: "⭐", group: "moments", add: "Log a milestone" },
  note: { label: "Note", emoji: "📝", group: "moments", add: "Add a note" },
  potty: { label: "Potty", emoji: "🚽", group: "diaper", add: "Log a potty try" },
  nails: { label: "Nail trim", emoji: "✂️", group: "care", add: "Log a nail trim" },
  hair: { label: "Hair care", emoji: "💇", group: "care", add: "Log hair care" },
  brush: { label: "Tooth brushing", emoji: "🪥", group: "care", add: "Log tooth brushing" },
  skin: { label: "Skin care", emoji: "🫧", group: "care", add: "Log skin care" },
  vitamin: { label: "Vitamin / supplement", emoji: "🌞", group: "health", add: "Log a vitamin" },
  appointment: { label: "Appointment", emoji: "📅", group: "health", add: "Add an appointment" },
  development: { label: "Development note", emoji: "🧠", group: "moments", add: "Add a development note" },
  journal: { label: "Baby journal", emoji: "📖", group: "moments", add: "Write in the baby journal" },
  photo: { label: "Photo", emoji: "📸", group: "moments", add: "Add a photo" },
  caregiver: { label: "Caregiver note", emoji: "🤝", group: "family", add: "Leave a caregiver note" },
};

export const LOG_KINDS = Object.keys(BABY_KINDS) as BabyLogKind[];
export const TIMER_KINDS = LOG_KINDS.filter((k) => BABY_KINDS[k].timer);
export const HEALTH_KINDS: BabyLogKind[] = ["temperature", "medicine", "vitamin", "symptom", "vaccine", "doctor", "appointment"];
export const CARE_KINDS: BabyLogKind[] = ["bath", "tummy", "activity", "nails", "hair", "brush", "skin"];
/** Things that may be logged ahead of time (an appointment, a vaccine visit). */
export const FUTURE_OK: BabyLogKind[] = ["appointment", "doctor", "vaccine"];
export const FEED_KINDS: BabyLogKind[] = ["nursing", "bottle", "solids"];

export const SCHEDULE_KINDS = [
  { value: "wake", label: "Wake up", emoji: "🌅" },
  { value: "feed", label: "Feed", emoji: "🍼" },
  { value: "meal", label: "Meal", emoji: "🥣" },
  { value: "nap", label: "Nap", emoji: "😴" },
  { value: "play", label: "Play", emoji: "🎈" },
  { value: "tummy", label: "Tummy time", emoji: "🧸" },
  { value: "bath", label: "Bath", emoji: "🛁" },
  { value: "medicine", label: "Medicine / vitamins", emoji: "💊" },
  { value: "bedtime", label: "Bedtime", emoji: "🌙" },
  { value: "other", label: "Other", emoji: "📌" },
] as const;

export type ScheduleKind = (typeof SCHEDULE_KINDS)[number]["value"];

/** Ready-made routines to start from (times as HH:MM). */
export const SCHEDULE_PRESETS: Record<string, { label: string; items: { time: string; kind: ScheduleKind; title: string; minutes?: number }[] }> = {
  newborn: {
    label: "Newborn (0–3 months): feed every 3 hours",
    items: [
      { time: "07:00", kind: "feed", title: "Feed" },
      { time: "08:00", kind: "nap", title: "Nap", minutes: 90 },
      { time: "10:00", kind: "feed", title: "Feed" },
      { time: "11:00", kind: "nap", title: "Nap", minutes: 90 },
      { time: "13:00", kind: "feed", title: "Feed" },
      { time: "14:00", kind: "nap", title: "Nap", minutes: 90 },
      { time: "16:00", kind: "feed", title: "Feed" },
      { time: "17:00", kind: "nap", title: "Catnap", minutes: 45 },
      { time: "19:00", kind: "feed", title: "Feed" },
      { time: "19:30", kind: "bath", title: "Bath", minutes: 20 },
      { time: "20:00", kind: "bedtime", title: "Bedtime" },
      { time: "22:00", kind: "feed", title: "Dream feed" },
      { time: "01:00", kind: "feed", title: "Night feed" },
      { time: "04:00", kind: "feed", title: "Night feed" },
    ],
  },
  infant: {
    label: "4–6 months: 3 naps",
    items: [
      { time: "07:00", kind: "wake", title: "Wake & feed" },
      { time: "08:30", kind: "nap", title: "Morning nap", minutes: 60 },
      { time: "10:00", kind: "feed", title: "Feed" },
      { time: "11:30", kind: "tummy", title: "Tummy time", minutes: 15 },
      { time: "12:00", kind: "nap", title: "Midday nap", minutes: 90 },
      { time: "13:30", kind: "feed", title: "Feed" },
      { time: "16:00", kind: "nap", title: "Catnap", minutes: 30 },
      { time: "16:30", kind: "feed", title: "Feed" },
      { time: "18:30", kind: "bath", title: "Bath", minutes: 20 },
      { time: "19:00", kind: "feed", title: "Bedtime feed" },
      { time: "19:30", kind: "bedtime", title: "Bedtime" },
    ],
  },
  older: {
    label: "7–12 months: 2 naps and meals",
    items: [
      { time: "07:00", kind: "wake", title: "Wake & milk" },
      { time: "08:00", kind: "meal", title: "Breakfast" },
      { time: "09:30", kind: "nap", title: "Morning nap", minutes: 60 },
      { time: "11:00", kind: "feed", title: "Milk" },
      { time: "12:00", kind: "meal", title: "Lunch" },
      { time: "14:00", kind: "nap", title: "Afternoon nap", minutes: 90 },
      { time: "15:30", kind: "feed", title: "Milk & snack" },
      { time: "17:30", kind: "meal", title: "Dinner" },
      { time: "18:30", kind: "bath", title: "Bath", minutes: 20 },
      { time: "19:00", kind: "feed", title: "Bedtime milk" },
      { time: "19:30", kind: "bedtime", title: "Bedtime" },
    ],
  },
  toddler: {
    label: "Toddler (1–3 years): 1 nap",
    items: [
      { time: "07:00", kind: "wake", title: "Wake up" },
      { time: "07:30", kind: "meal", title: "Breakfast" },
      { time: "09:30", kind: "meal", title: "Snack" },
      { time: "11:30", kind: "meal", title: "Lunch" },
      { time: "12:30", kind: "nap", title: "Nap", minutes: 120 },
      { time: "15:00", kind: "meal", title: "Snack" },
      { time: "17:30", kind: "meal", title: "Dinner" },
      { time: "18:45", kind: "bath", title: "Bath", minutes: 20 },
      { time: "19:15", kind: "bedtime", title: "Books & bedtime" },
    ],
  },
};

/** Milestones most babies reach around this age (months), from common pediatric checklists. */
export const MILESTONE_IDEAS: { months: number; title: string }[] = [
  { months: 0, title: "First bath" },
  { months: 1, title: "Lifts head during tummy time" },
  { months: 2, title: "First social smile" },
  { months: 2, title: "Coos and gurgles" },
  { months: 3, title: "Follows things with eyes" },
  { months: 4, title: "First laugh" },
  { months: 4, title: "Holds head steady" },
  { months: 4, title: "Grabs a toy" },
  { months: 5, title: "Rolls over" },
  { months: 6, title: "Sits with support" },
  { months: 6, title: "First solid food" },
  { months: 6, title: "Babbles (\"ba-ba\", \"ma-ma\")" },
  { months: 7, title: "First tooth" },
  { months: 8, title: "Sits without support" },
  { months: 9, title: "Crawls" },
  { months: 9, title: "Waves bye-bye" },
  { months: 10, title: "Pulls up to stand" },
  { months: 11, title: "Cruises along furniture" },
  { months: 12, title: "First word" },
  { months: 12, title: "First steps" },
  { months: 12, title: "First birthday" },
  { months: 15, title: "Walks well" },
  { months: 18, title: "Says several words" },
  { months: 18, title: "Feeds self with a spoon" },
  { months: 24, title: "Puts two words together" },
  { months: 24, title: "Kicks a ball" },
  { months: 30, title: "Potty trained (day)" },
  { months: 36, title: "Rides a tricycle" },
];

/** "3 weeks", "4 months, 2 weeks", "1 year, 3 months". */
export function babyAge(birthDate: string | null, today: string) {
  if (!birthDate) return null;
  const b = new Date(`${birthDate}T12:00:00Z`);
  const t = new Date(`${today}T12:00:00Z`);
  const days = Math.round((t.getTime() - b.getTime()) / 86_400_000);
  if (days < 0) return `Due in ${-days} day${days === -1 ? "" : "s"}`;
  if (days < 14) return `${days} day${days === 1 ? "" : "s"}`;
  let months = (t.getUTCFullYear() - b.getUTCFullYear()) * 12 + (t.getUTCMonth() - b.getUTCMonth());
  if (t.getUTCDate() < b.getUTCDate()) months -= 1;
  if (months < 2) return `${Math.floor(days / 7)} weeks`;
  if (months < 24) {
    const anchor = new Date(b);
    anchor.setUTCMonth(anchor.getUTCMonth() + months);
    const weeks = Math.floor((t.getTime() - anchor.getTime()) / (7 * 86_400_000));
    return `${months} months${weeks > 0 ? `, ${weeks} week${weeks === 1 ? "" : "s"}` : ""}`;
  }
  const y = Math.floor(months / 12);
  const m = months % 12;
  return `${y} year${y === 1 ? "" : "s"}${m ? `, ${m} month${m === 1 ? "" : "s"}` : ""}`;
}

/** Whole months old (for milestone ideas). */
export function monthsOld(birthDate: string | null, today: string) {
  if (!birthDate) return null;
  const b = new Date(`${birthDate}T12:00:00Z`);
  const t = new Date(`${today}T12:00:00Z`);
  let months = (t.getUTCFullYear() - b.getUTCFullYear()) * 12 + (t.getUTCMonth() - b.getUTCMonth());
  if (t.getUTCDate() < b.getUTCDate()) months -= 1;
  return months;
}

/** "just now", "25 min ago", "2 h 10 min ago", "yesterday". */
export function since(at: Date, now: Date) {
  const min = Math.max(0, Math.round((now.getTime() - at.getTime()) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h${min % 60 ? ` ${min % 60} min` : ""} ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

/** "1 h 25 min", "40 min". */
export function duration(minutes: number) {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`;
}

export type LogLike = { kind: string; startedAt: Date; endedAt: Date | null; amount: string | number | null; data: Record<string, unknown> };

/**
 * Totals for one day (logs that started in [dayStart, dayEnd)). Sleep that runs
 * past midnight counts the part inside the day.
 */
export function dayTotals(logs: LogLike[], dayStart: Date, dayEnd: Date, now: Date) {
  const inDay = logs.filter((l) => l.startedAt >= dayStart && l.startedAt < dayEnd);
  const mins = (l: LogLike) => {
    const s = Math.max(l.startedAt.getTime(), dayStart.getTime());
    const e = Math.min((l.endedAt ?? now).getTime(), dayEnd.getTime());
    return Math.max(0, (e - s) / 60_000);
  };
  const nursing = inDay.filter((l) => l.kind === "nursing");
  const bottles = inDay.filter((l) => l.kind === "bottle");
  const diapers = inDay.filter((l) => l.kind === "diaper");
  const sleepLogs = logs.filter((l) => l.kind === "sleep" && l.startedAt < dayEnd && (l.endedAt ?? now) > dayStart);
  return {
    feeds: nursing.length + bottles.length + inDay.filter((l) => l.kind === "solids").length,
    nursingMinutes: Math.round(nursing.reduce((n, l) => n + mins(l), 0)),
    bottles: bottles.length,
    bottleAmount: Math.round(bottles.reduce((n, l) => n + Number(l.amount ?? 0), 0) * 10) / 10,
    diapers: diapers.length,
    wet: diapers.filter((l) => l.data.type === "wet" || l.data.type === "both").length,
    dirty: diapers.filter((l) => l.data.type === "dirty" || l.data.type === "both").length,
    sleepMinutes: Math.round(sleepLogs.reduce((n, l) => n + mins(l), 0)),
    naps: sleepLogs.length,
    tummyMinutes: Math.round(inDay.filter((l) => l.kind === "tummy").reduce((n, l) => n + mins(l), 0)),
  };
}

/** The next routine item after `nowMin` (minutes since midnight) on weekday `wd`, wrapping to tomorrow. */
export function nextScheduled<T extends { time: string; days: number[] }>(items: T[], nowMin: number, wd: number): { item: T; tomorrow: boolean } | null {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const on = (i: T, d: number) => !i.days.length || i.days.includes(d);
  const sorted = [...items].sort((a, b) => toMin(a.time) - toMin(b.time));
  const today = sorted.find((i) => on(i, wd) && toMin(i.time) > nowMin);
  if (today) return { item: today, tomorrow: false };
  const tmr = sorted.find((i) => on(i, (wd + 1) % 7));
  return tmr ? { item: tmr, tomorrow: true } : null;
}

/** Which side to start on next time: the other side from the last nursing session. */
export function nextSide(lastSide: unknown) {
  return lastSide === "left" ? "right" : lastSide === "right" ? "left" : null;
}

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const num = (v: unknown) => (v == null || v === "" ? null : Number(v));

/** One line describing a log: "4 oz formula", "Left side · 18 min", "Wet + dirty · green". */
export function logSummary(l: LogLike & { notes?: string | null }, units: { volume: string; weight: string }, now: Date) {
  const d = l.data;
  const mins = l.endedAt ? Math.round((l.endedAt.getTime() - l.startedAt.getTime()) / 60_000) : null;
  const running = l.endedAt === null && (l.kind === "nursing" || l.kind === "sleep" || l.kind === "tummy" || l.kind === "pump");
  const len = running ? `going for ${duration((now.getTime() - l.startedAt.getTime()) / 60_000)}` : mins ? duration(mins) : null;
  const amt = num(l.amount);
  const parts: (string | null | false)[] = [];
  switch (l.kind) {
    case "nursing":
      parts.push(d.side ? `${cap(String(d.side))} side` : null, len);
      break;
    case "bottle":
      parts.push(amt !== null ? `${amt} ${units.volume}` : null, d.milk === "breast" ? "breast milk" : d.milk ? String(d.milk) : null);
      break;
    case "pump":
      parts.push(amt !== null ? `${amt} ${units.volume}` : null, d.side ? `${String(d.side)}` : null, len, d.stored ? `stored in the ${String(d.stored)}` : null);
      break;
    case "potty":
      parts.push(POTTY_RESULTS.find((p) => p.value === d.result)?.label ?? null, d.where ? String(d.where) : null, d.prompted ? "prompted" : null);
      break;
    case "solids":
      parts.push(d.title ? String(d.title) : null, d.reaction === "loved" ? "😋 loved it" : d.reaction === "refused" ? "🙅 refused" : null, !!d.firstTry && "first try", !!d.allergy && "⚠️ possible reaction");
      break;
    case "diaper":
      parts.push(d.type === "both" ? "Wet + dirty" : d.type ? cap(String(d.type)) : null, d.color ? String(d.color) : null, d.consistency ? String(d.consistency) : null, !!d.rash && "rash");
      break;
    case "sleep":
      parts.push(d.type === "night" ? "Overnight" : d.type === "nap" ? "Nap" : null, len, d.where ? String(d.where) : null, d.quality ? `slept ${String(d.quality)}` : null);
      break;
    case "tummy":
      parts.push(len, d.where ? String(d.where) : null);
      break;
    case "growth":
      parts.push(amt !== null ? `${amt} ${units.weight}` : null, d.height ? `${d.height} ${d.lengthUnit ?? ""} long`.trim() : null, d.head ? `head ${d.head} ${d.lengthUnit ?? ""}`.trim() : null);
      break;
    case "temperature":
      parts.push(amt !== null ? `${amt}°${d.unit ?? "F"}` : null, d.method ? String(d.method) : null);
      break;
    case "medicine":
      parts.push(d.title ? String(d.title) : null, d.dose ? String(d.dose) : null);
      break;
    case "symptom":
      parts.push(d.title ? String(d.title) : null, d.severity ? String(d.severity) : null);
      break;
    default:
      parts.push(d.title ? String(d.title) : null);
  }
  return parts.filter(Boolean).join(" · ");
}

/** A fever worth a call: 100.4°F / 38°C or more. */
export function isFever(l: LogLike) {
  if (l.kind !== "temperature" || l.amount == null) return false;
  const t = Number(l.amount);
  return l.data.unit === "C" ? t >= 38 : t >= 100.4;
}


// ─── Sleep guidance & predictions ───────────────────────────────────────────

/**
 * Typical awake time between sleeps by age (minutes), from common pediatric
 * sleep guidance. Every baby differs: these are starting points, not rules.
 */
export const WAKE_WINDOWS: { upTo: number; min: number; max: number; naps: string }[] = [
  { upTo: 1, min: 35, max: 60, naps: "4–6+" },
  { upTo: 3, min: 60, max: 90, naps: "4–5" },
  { upTo: 5, min: 75, max: 120, naps: "3–4" },
  { upTo: 7, min: 120, max: 180, naps: "3" },
  { upTo: 9, min: 150, max: 210, naps: "2–3" },
  { upTo: 13, min: 180, max: 240, naps: "2" },
  { upTo: 18, min: 240, max: 330, naps: "1–2" },
  { upTo: 36, min: 300, max: 360, naps: "1" },
  { upTo: 999, min: 330, max: 420, naps: "0–1" },
];
export const wakeWindowFor = (months: number | null) => (months === null ? null : (WAKE_WINDOWS.find((w) => months < w.upTo) ?? WAKE_WINDOWS[WAKE_WINDOWS.length - 1]!));

/** When the next nap is likely due, from when the baby last woke up. */
export function napWindow(lastWokeAt: Date | null, months: number | null) {
  const w = wakeWindowFor(months);
  if (!lastWokeAt || !w) return null;
  return { from: new Date(lastWokeAt.getTime() + w.min * 60_000), to: new Date(lastWokeAt.getTime() + w.max * 60_000), window: w };
}

/**
 * Estimate the next feed from the recent rhythm: the median gap between the
 * last several feeds in the past two days (gaps over 6 hours, like a long
 * night stretch, are left out).
 */
export function predictNextFeed(feedTimes: Date[]) {
  const t = [...feedTimes].sort((a, b) => a.getTime() - b.getTime());
  if (t.length < 3) return null;
  const last = t[t.length - 1]!;
  const recent = t.filter((d) => last.getTime() - d.getTime() <= 48 * 3600_000);
  const gaps: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    const g = (recent[i]!.getTime() - recent[i - 1]!.getTime()) / 60_000;
    if (g >= 20 && g <= 360) gaps.push(g);
  }
  if (gaps.length < 2) return null;
  const sorted = gaps.slice(-8).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  return { at: new Date(last.getTime() + median * 60_000), everyMinutes: Math.round(median) };
}

/** Overnight sleep or a nap: set by the person, or (3+ hours starting 6 pm–5 am) treated as night. */
export function sleepType(l: { startedAt: Date; endedAt: Date | null; data: Record<string, unknown> }, startLocalHour: number, now: Date) {
  if (l.data.type === "night" || l.data.type === "nap") return l.data.type as "night" | "nap";
  const mins = ((l.endedAt ?? now).getTime() - l.startedAt.getTime()) / 60_000;
  return (startLocalHour >= 18 || startLocalHour < 5) && mins >= 180 ? "night" : "nap";
}

// ─── Potty training ─────────────────────────────────────────────────────────

export const POTTY_RESULTS = [
  { value: "pee", label: "Pee in the potty", success: true },
  { value: "poop", label: "Poop in the potty", success: true },
  { value: "both", label: "Both in the potty", success: true },
  { value: "tried", label: "Tried, nothing", success: false },
  { value: "accident", label: "Accident", success: false },
] as const;
export const pottySuccess = (r: unknown) => POTTY_RESULTS.some((p) => p.value === r && p.success);

/** Potty tries, successes and accidents for a set of potty logs. */
export function pottyStats(logs: { data: Record<string, unknown> }[]) {
  const tries = logs.filter((l) => l.data.result !== "accident").length;
  const wins = logs.filter((l) => pottySuccess(l.data.result)).length;
  const accidents = logs.filter((l) => l.data.result === "accident").length;
  return { tries, wins, accidents, rate: tries ? Math.round((wins / tries) * 100) : null };
}

// ─── Breast milk storage ────────────────────────────────────────────────────

/** How long expressed milk keeps (CDC guidance for healthy full-term babies). */
export const MILK_STORAGE = {
  room: { label: "Room temperature", hours: 4, note: "Up to 4 hours at 77°F (25°C) or cooler." },
  fridge: { label: "Refrigerator", hours: 4 * 24, note: "Up to 4 days." },
  freezer: { label: "Freezer", hours: 6 * 30 * 24, note: "Best within 6 months; up to 12 months is acceptable." },
  thawed: { label: "Thawed (in the fridge)", hours: 24, note: "Use within 24 hours once thawed. Don't refreeze." },
} as const;
export type MilkPlace = keyof typeof MILK_STORAGE;
export const milkExpiry = (place: MilkPlace, pumpedAt: Date) => new Date(pumpedAt.getTime() + MILK_STORAGE[place].hours * 3600_000);

// ─── Vaccines (CDC routine schedule, birth to 18 months) ─────────────────────

export const VACCINE_SCHEDULE: { months: number; label: string; vaccines: string[] }[] = [
  { months: 0, label: "Birth", vaccines: ["Hepatitis B (HepB) dose 1", "RSV antibody (if needed)"] },
  { months: 1, label: "1–2 months", vaccines: ["Hepatitis B (HepB) dose 2"] },
  { months: 2, label: "2 months", vaccines: ["Rotavirus (RV)", "DTaP", "Hib", "Pneumococcal (PCV)", "Polio (IPV)"] },
  { months: 4, label: "4 months", vaccines: ["Rotavirus (RV)", "DTaP", "Hib", "Pneumococcal (PCV)", "Polio (IPV)"] },
  { months: 6, label: "6 months", vaccines: ["DTaP", "Hib (some brands)", "Pneumococcal (PCV)", "Hepatitis B (HepB) dose 3 (6–18 mo)", "Polio (IPV) dose 3 (6–18 mo)", "Flu (yearly, from 6 months)", "COVID-19 (per current guidance)"] },
  { months: 12, label: "12–15 months", vaccines: ["MMR", "Chickenpox (Varicella)", "Hib", "Pneumococcal (PCV)", "Hepatitis A (HepA) dose 1"] },
  { months: 15, label: "15–18 months", vaccines: ["DTaP"] },
  { months: 18, label: "18 months+", vaccines: ["Hepatitis A (HepA) dose 2 (6 months after dose 1)"] },
];

// ─── Development ────────────────────────────────────────────────────────────

export type DevArea = "social" | "language" | "movement" | "thinking";
export const DEV_AREAS: Record<DevArea, string> = { social: "Social & emotional", language: "Language & communication", movement: "Movement & physical", thinking: "Thinking & learning" };

/** Milestone checklist (adapted from common "learn the signs" checklists). */
export const MILESTONE_CHECKLIST: { months: number; area: DevArea; title: string }[] = [
  { months: 2, area: "social", title: "First smile" },
  { months: 2, area: "language", title: "Coos and makes sounds" },
  { months: 2, area: "movement", title: "Holds head up during tummy time" },
  { months: 2, area: "thinking", title: "Watches you as you move" },
  { months: 4, area: "social", title: "First laugh" },
  { months: 4, area: "language", title: "Makes sounds back when you talk" },
  { months: 4, area: "movement", title: "Holds head steady without support" },
  { months: 4, area: "movement", title: "Holds a toy" },
  { months: 4, area: "thinking", title: "Brings hands to mouth" },
  { months: 6, area: "social", title: "Knows familiar people" },
  { months: 6, area: "language", title: "Squeals and blows raspberries" },
  { months: 6, area: "movement", title: "Rolls over (tummy to back)" },
  { months: 6, area: "movement", title: "Leans on hands to sit" },
  { months: 6, area: "thinking", title: "Reaches for a toy they want" },
  { months: 9, area: "social", title: "Shy or clingy with strangers" },
  { months: 9, area: "language", title: "Babbles “mamama”, “babababa”" },
  { months: 9, area: "movement", title: "Sits without support" },
  { months: 9, area: "movement", title: "Crawls" },
  { months: 9, area: "thinking", title: "Looks for things you hide" },
  { months: 12, area: "social", title: "Plays games like pat-a-cake" },
  { months: 12, area: "language", title: "Waves bye-bye" },
  { months: 12, area: "language", title: "First words (“mama”, “dada”)" },
  { months: 12, area: "movement", title: "Pulls up to stand" },
  { months: 12, area: "movement", title: "Walks holding on to furniture" },
  { months: 12, area: "thinking", title: "Picks up small things with thumb and finger" },
  { months: 15, area: "movement", title: "First steps" },
  { months: 15, area: "language", title: "Says one or two words besides mama/dada" },
  { months: 15, area: "social", title: "Shows you things they like" },
  { months: 18, area: "movement", title: "Walks without holding on" },
  { months: 18, area: "language", title: "Says three or more words" },
  { months: 18, area: "thinking", title: "Copies you doing chores" },
  { months: 24, area: "language", title: "Says two words together" },
  { months: 24, area: "movement", title: "Kicks a ball" },
  { months: 24, area: "social", title: "Notices when others are hurt or upset" },
  { months: 30, area: "movement", title: "Jumps with both feet" },
  { months: 30, area: "language", title: "Says about 50 words" },
  { months: 36, area: "social", title: "Calms down within 10 minutes after you leave" },
  { months: 36, area: "language", title: "Talks in short conversations" },
];

export type ActivityCategory = "tummy" | "sensory" | "thinking" | "motor" | "language" | "play";
export const ACTIVITY_CATEGORIES: Record<ActivityCategory, string> = { tummy: "Tummy time", sensory: "Sensory", thinking: "Thinking", motor: "Motor skills", language: "Language", play: "Play" };

/** Age-based play and development ideas. */
export const ACTIVITIES: { title: string; category: ActivityCategory; from: number; to: number; how: string }[] = [
  { title: "Chest-to-chest tummy time", category: "tummy", from: 0, to: 3, how: "Lie back and let baby rest on your chest. Talk and smile so they lift their head to see you." },
  { title: "Mirror tummy time", category: "tummy", from: 1, to: 6, how: "Put a baby-safe mirror in front of them during tummy time." },
  { title: "Toy just out of reach", category: "tummy", from: 4, to: 9, how: "During tummy time, place a toy just out of reach to encourage reaching and pivoting." },
  { title: "High-contrast cards", category: "sensory", from: 0, to: 3, how: "Hold black-and-white pictures 8–12 inches from their face and move them slowly." },
  { title: "Texture touch", category: "sensory", from: 2, to: 12, how: "Let them feel different safe textures: a soft blanket, a wooden spoon, a crinkly toy." },
  { title: "Water play", category: "sensory", from: 6, to: 36, how: "With you right there, let them splash and pour with cups at bath time." },
  { title: "Peekaboo", category: "thinking", from: 4, to: 18, how: "Hide your face behind your hands or a cloth and pop out. It teaches that things still exist when hidden." },
  { title: "Hide the toy", category: "thinking", from: 8, to: 24, how: "Hide a toy under a cloth while they watch and let them find it." },
  { title: "Stacking & nesting cups", category: "thinking", from: 9, to: 30, how: "Stack, knock down, nest and fill cups together." },
  { title: "Rattle reach", category: "motor", from: 2, to: 6, how: "Hold a rattle above them and let them reach and grab." },
  { title: "Supported sitting", category: "motor", from: 4, to: 8, how: "Sit them in a nest of pillows or your lap and play with toys in front of them." },
  { title: "Cruising walk", category: "motor", from: 9, to: 15, how: "Place toys along the sofa so they cruise along the furniture." },
  { title: "Push-toy walks", category: "motor", from: 10, to: 20, how: "Let them push a sturdy push toy or a box across the floor." },
  { title: "Running commentary", category: "language", from: 0, to: 24, how: "Describe what you're doing: “Now I'm washing your toes!”" },
  { title: "Read together", category: "language", from: 0, to: 36, how: "Read a board book together; point at pictures and name them." },
  { title: "Copy their sounds", category: "language", from: 2, to: 12, how: "When they coo or babble, copy them back and wait for a reply." },
  { title: "Songs with actions", category: "language", from: 6, to: 36, how: "Sing songs like “Itsy Bitsy Spider” with hand motions." },
  { title: "Name body parts", category: "language", from: 10, to: 30, how: "Touch and name noses, toes and ears; ask them to point." },
  { title: "Dance party", category: "play", from: 3, to: 36, how: "Put on music and sway, bounce or dance together." },
  { title: "Ball rolling", category: "play", from: 8, to: 30, how: "Sit facing each other and roll a soft ball back and forth." },
  { title: "Pretend play", category: "play", from: 15, to: 36, how: "Feed a teddy, “cook” with pots and spoons, talk on a toy phone." },
  { title: "Bubbles", category: "play", from: 6, to: 36, how: "Blow bubbles for them to watch, reach and pop." },
];

/** A few activity ideas for today, favouring categories they've done least lately. */
export function suggestActivities(months: number | null, doneTitles: string[], today: string, n = 3) {
  const m = months ?? 0;
  const fit = ACTIVITIES.filter((a) => m >= a.from && m < a.to);
  const counts = new Map<string, number>();
  for (const t of doneTitles) {
    const a = ACTIVITIES.find((x) => x.title === t);
    if (a) counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
  }
  const day = Math.floor(Date.parse(`${today}T12:00:00Z`) / 86_400_000);
  return [...fit].sort((a, b) => (counts.get(a.category) ?? 0) - (counts.get(b.category) ?? 0) || ((day + a.title.length) % 7) - ((day + b.title.length) % 7)).slice(0, n);
}

// ─── Reports ────────────────────────────────────────────────────────────────

/** Totals across several days (from dayTotals of each), with daily averages. */
export function periodReport(days: ReturnType<typeof dayTotals>[], pumpAmounts: number[]) {
  const sum = (k: keyof ReturnType<typeof dayTotals>) => days.reduce((s, d) => s + d[k], 0);
  const n = Math.max(1, days.length);
  const r1 = (x: number) => Math.round(x * 10) / 10;
  return {
    days: days.length,
    feeds: sum("feeds"),
    feedsPerDay: r1(sum("feeds") / n),
    bottleAmount: r1(sum("bottleAmount")),
    bottlePerDay: r1(sum("bottleAmount") / n),
    nursingMinutes: sum("nursingMinutes"),
    diapers: sum("diapers"),
    diapersPerDay: r1(sum("diapers") / n),
    wet: sum("wet"),
    dirty: sum("dirty"),
    sleepMinutes: sum("sleepMinutes"),
    sleepPerDay: Math.round(sum("sleepMinutes") / n),
    tummyMinutes: sum("tummyMinutes"),
    pumpTotal: r1(pumpAmounts.reduce((s, x) => s + x, 0)),
    pumpSessions: pumpAmounts.length,
  };
}

/** A plain-language summary of a period, compared with the one before. */
export function reportSummary(cur: ReturnType<typeof periodReport>, prev: ReturnType<typeof periodReport> | null, volumeUnit: string) {
  const parts: string[] = [];
  if (cur.feeds) parts.push(`About ${cur.feedsPerDay} feeds a day${cur.bottlePerDay ? ` (${cur.bottlePerDay} ${volumeUnit} from bottles)` : ""}`);
  if (cur.sleepMinutes) parts.push(`${duration(cur.sleepPerDay)} of logged sleep a day`);
  if (cur.diapers) parts.push(`${cur.diapersPerDay} diapers a day (${cur.wet} wet, ${cur.dirty} dirty in total)`);
  if (cur.pumpSessions) parts.push(`${cur.pumpSessions} pumping sessions, ${cur.pumpTotal} ${volumeUnit} in total`);
  let text = parts.length ? `${parts.join("; ")}.` : "Not much logged in this period yet.";
  if (prev && prev.days && cur.sleepMinutes && prev.sleepMinutes) {
    const d = cur.sleepPerDay - prev.sleepPerDay;
    if (Math.abs(d) >= 20) text += ` Sleep is ${d > 0 ? "up" : "down"} ${duration(Math.abs(d))} a day on the period before.`;
  }
  if (prev && prev.days && cur.feeds && prev.feeds) {
    const d = cur.feedsPerDay - prev.feedsPerDay;
    if (Math.abs(d) >= 1) text += ` ${d > 0 ? "More" : "Fewer"} feeds than before (${prev.feedsPerDay} a day).`;
  }
  return text;
}
