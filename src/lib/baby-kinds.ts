/**
 * Baby tracker: what can be logged, and the pure maths for the Today screen
 * (age, time since, today's totals, what's next on the schedule). No DB here,
 * so it's safe for client components and unit tests.
 */
import type { BabyLogKind } from "@/db/schema/baby";

export type { BabyLogKind };

export type KindMeta = { label: string; emoji: string; group: "feeding" | "diaper" | "sleep" | "health" | "growth" | "moments" | "care"; timer?: boolean; add: string };

export const BABY_KINDS: Record<BabyLogKind, KindMeta> = {
  nursing: { label: "Breastfeeding", emoji: "🤱", group: "feeding", timer: true, add: "Log breastfeeding" },
  bottle: { label: "Bottle", emoji: "🍼", group: "feeding", add: "Log a bottle" },
  solids: { label: "Meal / solids", emoji: "🥣", group: "feeding", add: "Log a meal" },
  pump: { label: "Pumping", emoji: "🧴", group: "feeding", add: "Log pumping" },
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
};

export const LOG_KINDS = Object.keys(BABY_KINDS) as BabyLogKind[];
export const TIMER_KINDS = LOG_KINDS.filter((k) => BABY_KINDS[k].timer);
export const HEALTH_KINDS: BabyLogKind[] = ["temperature", "medicine", "symptom", "vaccine", "doctor"];
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
  const running = l.endedAt === null && (l.kind === "nursing" || l.kind === "sleep" || l.kind === "tummy");
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
      parts.push(amt !== null ? `${amt} ${units.volume}` : null, d.side ? `${String(d.side)}` : null);
      break;
    case "solids":
      parts.push(d.title ? String(d.title) : null, d.reaction === "loved" ? "😋 loved it" : d.reaction === "refused" ? "🙅 refused" : null, !!d.firstTry && "first try", !!d.allergy && "⚠️ possible reaction");
      break;
    case "diaper":
      parts.push(d.type === "both" ? "Wet + dirty" : d.type ? cap(String(d.type)) : null, d.color ? String(d.color) : null, !!d.rash && "rash");
      break;
    case "sleep":
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
