/**
 * Mental Wellness vocabulary and calculations. Pure module (tests/wellness.test.ts).
 * Supportive, not clinical: it records patterns and never labels or diagnoses anyone.
 */
import { addDays, daysBetween } from "./dates";

export const MOODS = [
  { key: "great", label: "Great", emoji: "😄", score: 5 },
  { key: "good", label: "Good", emoji: "🙂", score: 4 },
  { key: "okay", label: "Okay", emoji: "😐", score: 3 },
  { key: "low", label: "Low", emoji: "😕", score: 2 },
  { key: "rough", label: "Rough", emoji: "😢", score: 1 },
] as const;
export type MoodKey = (typeof MOODS)[number]["key"];
export const moodInfo = (k: string | null | undefined) => MOODS.find((m) => m.key === k);

export const FEELINGS = ["Happy", "Calm", "Excited", "Proud", "Grateful", "Loved", "Frustrated", "Angry", "Sad", "Lonely", "Worried", "Anxious", "Overwhelmed", "Tired", "Confused"];
export const INTENSITIES = [
  { key: "low", label: "Low" },
  { key: "medium", label: "Medium" },
  { key: "high", label: "High" },
] as const;

export const SELF_CARE = [
  { key: "slept", label: "Slept well" },
  { key: "outside", label: "Spent time outside" },
  { key: "read", label: "Read" },
  { key: "break", label: "Took a break" },
  { key: "talked", label: "Talked with someone" },
  { key: "hobby", label: "Practiced a hobby" },
  { key: "exercise", label: "Exercised" },
  { key: "relaxed", label: "Relaxed" },
  { key: "journaled", label: "Journaled" },
  { key: "creative", label: "Did something creative" },
  { key: "water", label: "Drank enough water" },
  { key: "rested", label: "Rested" },
] as const;
export const selfCareLabel = (k: string) => SELF_CARE.find((s) => s.key === k)?.label ?? k;

export const PROMPTS = [
  "What was one good thing about today?",
  "What are you grateful for?",
  "What was difficult today?",
  "What are you looking forward to?",
  "What is something you accomplished?",
  "What would help you feel supported today?",
  "What is one thing you want to remember about today?",
  "Who made you smile recently?",
  "What helped you feel calm this week?",
  "What is something kind you did, or someone did for you?",
  "What did you learn today?",
  "What would you tell a friend who had the day you had?",
];

const dayNumber = (iso: string) => Math.floor(Date.parse(`${iso}T12:00:00Z`) / 86_400_000);
/** Today's reflection prompt (the same all day, different each day). */
export const promptFor = (date: string) => PROMPTS[dayNumber(date) % PROMPTS.length]!;

export const GOAL_KINDS = [
  { key: "journal", label: "Journal" },
  { key: "gratitude", label: "Practice gratitude" },
  { key: "check_in", label: "Daily check-in" },
  { key: "self_care", label: "A self-care activity" },
  { key: "custom", label: "Something else" },
] as const;

/** Days in a row, ending today or yesterday, that appear in `dates`. Missing today never "breaks" anything. */
export function currentStreak(dates: string[], today: string) {
  const set = new Set(dates);
  let d = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** How many distinct days in the current week (Mon–Sun) appear in `dates`. */
export function thisWeekCount(dates: string[], today: string) {
  const dow = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const monday = addDays(today, -dow);
  return new Set(dates.filter((d) => daysBetween(monday, d) >= 0 && d <= today)).size;
}

/** Average mood score (1–5) for a set of check-ins, or null. */
export function averageMood(moods: (string | null)[]) {
  const scores = moods.map((m) => moodInfo(m)?.score).filter((x): x is 1 | 2 | 3 | 4 | 5 => !!x);
  return scores.length ? Math.round((scores.reduce((s, x) => s + x, 0) / scores.length) * 10) / 10 : null;
}
export const moodForScore = (score: number | null) => (score === null ? undefined : MOODS.find((m) => m.score === Math.round(score)));

/**
 * Words that may mean someone is in danger or thinking about hurting themselves. When
 * found, the app shows supportive safety information. It never blocks, diagnoses or
 * tells anyone else on its own.
 */
const CRISIS = [
  /\bkill(ing)? my ?self\b/i,
  /\bsuicid(e|al)\b/i,
  /\bend (it all|my life)\b/i,
  /\b(want|wanna|going) to die\b/i,
  /\bhurt(ing)? my ?self\b/i,
  /\bself[- ]?harm/i,
  /\bcut(ting)? my ?self\b/i,
  /\bno reason to live\b/i,
  /\bbetter off (dead|without me)\b/i,
  /\bdon'?t want to (be here|live|wake up)\b/i,
  /\bnot safe at home\b/i,
  /\bsomeone is hurting me\b/i,
];
export const needsSupport = (...texts: (string | null | undefined)[]) => texts.some((t) => !!t && CRISIS.some((r) => r.test(t)));
