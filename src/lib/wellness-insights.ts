/**
 * Mental Wellness: check-in scales, simple daily questions, gentle follow-ups,
 * patterns ("your mood tends to be higher on…"), sleep and habit maths,
 * breathing patterns and positive content. Pure module (tests/wellness-insights.test.ts).
 *
 * Supportive, not clinical: it describes patterns in what the person logged and
 * never labels, diagnoses or promises outcomes.
 */
import { addDays, daysBetween } from "./dates";
import { moodInfo, selfCareLabel } from "./wellness";

export const SCALES = {
  energy: { label: "Energy", question: "How's your energy?", options: ["Drained", "Low", "Okay", "Good", "Full of energy"] },
  stress: { label: "Stress", question: "How stressed do you feel?", options: ["Calm", "A little", "Some", "Quite a bit", "Very stressed"] },
  sleepQuality: { label: "Sleep quality", question: "How did you sleep last night?", options: ["Poorly", "Not great", "Okay", "Well", "Great"] },
} as const;
export type ScaleKey = keyof typeof SCALES;
export const scaleLabel = (k: ScaleKey, v: number | null | undefined) => (v ? SCALES[k].options[v - 1] : null);

export const DAILY_QUESTIONS = [
  { key: "water", q: "Did you drink enough water?" },
  { key: "meals", q: "Did you eat regular meals?" },
  { key: "move", q: "Did you move your body?" },
  { key: "outside", q: "Did you spend time outdoors?" },
  { key: "connect", q: "Did you connect with someone?" },
  { key: "screens", q: "Did you take a break from screens?" },
] as const;
export const DAILY_KEYS = DAILY_QUESTIONS.map((q) => q.key) as string[];

export type CheckInLike = {
  date: string;
  mood: string | null;
  feelings: string[];
  selfCare: string[];
  energy: number | null;
  stress: number | null;
  sleepQuality: number | null;
  answers: Record<string, boolean>;
};

export type FollowUp = { key: string; title: string; body: string; href?: string; cta?: string };

/** Gentle, personalised suggestions after a check-in. At most three, kindest first. */
export function followUps(c: CheckInLike | null | undefined): FollowUp[] {
  if (!c) return [];
  const out: FollowUp[] = [];
  const score = moodInfo(c.mood)?.score ?? null;
  if (score !== null && score <= 2)
    out.push({ key: "low", title: "Be gentle with yourself today", body: "Hard days happen. Talking to someone you trust, writing it down, or a few slow breaths can help a little.", href: "/wellness/journal?new=1", cta: "Write it down" });
  if ((c.stress ?? 0) >= 4) out.push({ key: "stress", title: "Feeling stressed?", body: "Try two minutes of slow breathing. Breathing out longer than you breathe in helps many people settle.", href: "/wellness/breathe", cta: "Start breathing" });
  if ((c.sleepQuality ?? 5) <= 2)
    out.push({ key: "sleep", title: "Rough night?", body: "A short rest, daylight and a calm wind-down tonight can help. Calming sounds may make it easier to drift off.", href: "/sounds", cta: "Open Sleep Sounds" });
  if ((c.energy ?? 5) <= 2) out.push({ key: "energy", title: "Low on energy", body: "A glass of water, a snack and a few minutes outside are small things that often help.", href: "/wellness/habits", cta: "See my habits" });
  if (c.answers.water === false) out.push({ key: "water", title: "Time for some water?", body: "Keep a glass or bottle within reach for the rest of the day." });
  if (c.answers.connect === false && (score ?? 3) <= 3) out.push({ key: "connect", title: "Reach out to someone", body: "A quick message to a friend or family member can lift both of your days." });
  if (c.answers.outside === false && c.answers.move === false) out.push({ key: "outside", title: "A little fresh air", body: "Even five minutes outside or a short stretch counts." });
  if (score !== null && score >= 4)
    out.push({ key: "good", title: "Glad today's a good one", body: "What made it good? Writing it down helps you remember what works for you.", href: "/wellness/journal?view=gratitude&new=1", cta: "Note what went well" });
  return out.slice(0, 3);
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const round1 = (x: number | null) => (x === null ? null : Math.round(x * 10) / 10);
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Average mood (1–5) for each weekday, with how many check-ins it's based on. */
export function moodByWeekday(checkIns: CheckInLike[]) {
  return WEEKDAYS.map((name, wd) => {
    const scores = checkIns.filter((c) => new Date(`${c.date}T12:00:00Z`).getUTCDay() === wd).map((c) => moodInfo(c.mood)?.score).filter((x): x is 1 | 2 | 3 | 4 | 5 => !!x);
    return { weekday: wd, name, avg: round1(avg(scores)), n: scores.length };
  });
}

export type Insight = { key: string; text: string };

/**
 * Plain-language patterns, only when there's enough to go on (at least a few
 * check-ins on each side of a comparison).
 */
export function insights(checkIns: CheckInLike[], sleepNights: { date: string; minutes: number | null; quality: number | null }[], today: string): Insight[] {
  const out: Insight[] = [];
  const scored = checkIns.filter((c) => moodInfo(c.mood));
  const score = (c: CheckInLike) => moodInfo(c.mood)!.score;

  // Weekday pattern.
  const byWd = moodByWeekday(scored).filter((d) => d.n >= 2 && d.avg !== null);
  if (byWd.length >= 3) {
    const best = byWd.reduce((a, b) => (b.avg! > a.avg! ? b : a));
    const worst = byWd.reduce((a, b) => (b.avg! < a.avg! ? b : a));
    if (best.avg! - worst.avg! >= 0.5) out.push({ key: "weekday", text: `Your mood tends to be higher on ${best.name}s and lower on ${worst.name}s.` });
  }

  // Mood vs sleep (from check-in sleep quality, or the sleep journal).
  const nights = new Map(sleepNights.map((n) => [n.date, n]));
  const sleepGood = (c: CheckInLike) => {
    const q = c.sleepQuality ?? nights.get(c.date)?.quality ?? null;
    const m = nights.get(c.date)?.minutes ?? null;
    if (q !== null) return q >= 4 ? true : q <= 2 ? false : null;
    if (m !== null) return m >= 7 * 60 ? true : m < 6 * 60 ? false : null;
    return null;
  };
  const good = scored.filter((c) => sleepGood(c) === true).map(score);
  const poor = scored.filter((c) => sleepGood(c) === false).map(score);
  if (good.length >= 3 && poor.length >= 3) {
    const d = avg(good)! - avg(poor)!;
    if (Math.abs(d) >= 0.4) out.push({ key: "sleep", text: d > 0 ? "On days after you sleep well, your mood is usually better." : "Interestingly, your mood hasn't dipped after poorer nights." });
  }

  // Mood vs activities (self-care and daily questions).
  const acts = new Map<string, string>();
  for (const c of scored) for (const s of c.selfCare) acts.set(s, selfCareLabel(s));
  const lifts: { label: string; d: number }[] = [];
  for (const [key, label] of acts) {
    const withIt = scored.filter((c) => c.selfCare.includes(key)).map(score);
    const without = scored.filter((c) => !c.selfCare.includes(key)).map(score);
    if (withIt.length >= 3 && without.length >= 3) lifts.push({ label, d: avg(withIt)! - avg(without)! });
  }
  lifts.sort((a, b) => b.d - a.d);
  const top = lifts.filter((l) => l.d >= 0.4).slice(0, 2);
  if (top.length) out.push({ key: "activities", text: `Your mood is often better on days you ${top.map((t) => t.label.toLowerCase()).join(" or ")}.` });

  // Stress trend: last 7 days vs the 7 before.
  const inRange = (c: CheckInLike, a: number, b: number) => {
    const d = daysBetween(c.date, today);
    return d >= a && d < b;
  };
  const recent = avg(checkIns.filter((c) => inRange(c, 0, 7) && c.stress).map((c) => c.stress!));
  const before = avg(checkIns.filter((c) => inRange(c, 7, 14) && c.stress).map((c) => c.stress!));
  if (recent !== null && before !== null && Math.abs(recent - before) >= 0.5) out.push({ key: "stress", text: recent < before ? "Your stress has been lower this week than last week." : "Your stress has been higher this week than last week. Be kind to yourself." });

  return out;
}

/** A summary for a period (week or month). */
export function periodSummary(checkIns: CheckInLike[], from: string, to: string) {
  const xs = checkIns.filter((c) => c.date >= from && c.date <= to);
  const tally = (list: string[]) => [...list.reduce((m, f) => m.set(f, (m.get(f) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const moodScores = xs.map((c) => moodInfo(c.mood)?.score).filter((x): x is 1 | 2 | 3 | 4 | 5 => !!x);
  return {
    checkIns: xs.length,
    mood: round1(avg(moodScores)),
    energy: round1(avg(xs.map((c) => c.energy).filter((x): x is number => !!x))),
    stress: round1(avg(xs.map((c) => c.stress).filter((x): x is number => !!x))),
    sleepQuality: round1(avg(xs.map((c) => c.sleepQuality).filter((x): x is number => !!x))),
    topFeelings: tally(xs.flatMap((c) => c.feelings)).slice(0, 3).map(([f]) => f),
    topSelfCare: tally(xs.flatMap((c) => c.selfCare)).slice(0, 3).map(([s]) => selfCareLabel(s)),
  };
}

/** A daily series for charts: one value (or null) per day from `from` for `days` days. */
export function series<T extends { date: string }>(checkIns: T[], from: string, days: number, pick: (c: T) => number | null) {
  const by = new Map(checkIns.map((c) => [c.date, c]));
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(from, i);
    const c = by.get(d);
    return { date: d, value: c ? pick(c) : null };
  });
}

// ─── Sleep journal ──────────────────────────────────────────────────────────

/** Minutes asleep from bedtime to wake time (crossing midnight when needed). */
export function sleepMinutes(bed: string | null, wake: string | null) {
  if (!bed || !wake) return null;
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  let d = toMin(wake) - toMin(bed);
  if (d <= 0) d += 24 * 60;
  return d;
}

export const hoursText = (min: number | null) => (min === null ? "—" : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`);

// ─── Habits ─────────────────────────────────────────────────────────────────

/** Days in a row ending today (or yesterday, so today isn't "broken" yet). */
export function habitStreak(dates: string[], today: string) {
  const set = new Set(dates);
  let d = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** Weeks in a row (Mon–Sun) where a weekly target was met, counting back from last week (and this week if already met). */
export function weeklyStreak(dates: string[], today: string, target: number) {
  const monday = (d: string) => addDays(d, -((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7));
  const counts = new Map<string, number>();
  for (const d of new Set(dates)) counts.set(monday(d), (counts.get(monday(d)) ?? 0) + 1);
  let wk = monday(today);
  let n = (counts.get(wk) ?? 0) >= target ? 1 : 0;
  wk = addDays(wk, -7);
  while ((counts.get(wk) ?? 0) >= target) {
    n++;
    wk = addDays(wk, -7);
  }
  return n;
}

/** Days done in each of the last `weeks` weeks (oldest first), for a progress chart. */
export function weeklyCounts(dates: string[], today: string, weeks = 8) {
  const thisMonday = addDays(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
  const set = new Set(dates);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(thisMonday, -7 * (weeks - 1 - i));
    let n = 0;
    for (let k = 0; k < 7; k++) if (set.has(addDays(start, k))) n++;
    return { start, n };
  });
}

// ─── Breathing ──────────────────────────────────────────────────────────────

export type BreathPhase = { label: "Breathe in" | "Hold" | "Breathe out"; seconds: number };
export const BREATHING: { key: string; name: string; about: string; phases: BreathPhase[] }[] = [
  { key: "calm", name: "Calm breathing (4–6)", about: "Breathe in for 4, out for 6. A longer out-breath helps you slow down.", phases: [{ label: "Breathe in", seconds: 4 }, { label: "Breathe out", seconds: 6 }] },
  { key: "box", name: "Box breathing (4–4–4–4)", about: "In, hold, out, hold, four counts each. Steady and simple.", phases: [{ label: "Breathe in", seconds: 4 }, { label: "Hold", seconds: 4 }, { label: "Breathe out", seconds: 4 }, { label: "Hold", seconds: 4 }] },
  { key: "478", name: "4–7–8 breathing", about: "In for 4, hold for 7, out for 8. Many people use it to wind down at bedtime.", phases: [{ label: "Breathe in", seconds: 4 }, { label: "Hold", seconds: 7 }, { label: "Breathe out", seconds: 8 }] },
  { key: "even", name: "Even breathing (5–5)", about: "In for 5, out for 5. A gentle, even rhythm.", phases: [{ label: "Breathe in", seconds: 5 }, { label: "Breathe out", seconds: 5 }] },
];

/** Which phase is active `elapsed` seconds into a pattern (and seconds left in it). */
export function breathAt(phases: BreathPhase[], elapsed: number) {
  const cycle = phases.reduce((s, p) => s + p.seconds, 0);
  let t = ((elapsed % cycle) + cycle) % cycle;
  for (const [i, p] of phases.entries()) {
    if (t < p.seconds) return { index: i, phase: p, left: Math.ceil(p.seconds - t), cycle: Math.floor(elapsed / cycle) };
    t -= p.seconds;
  }
  return { index: 0, phase: phases[0]!, left: phases[0]!.seconds, cycle: 0 };
}

// ─── Positive content ───────────────────────────────────────────────────────

export const AFFIRMATIONS = [
  "I am doing the best I can, and that is enough.",
  "I can take things one step at a time.",
  "My feelings are valid, and they will pass.",
  "I am allowed to rest.",
  "I am learning and growing every day.",
  "I deserve kindness, including from myself.",
  "I can handle hard things.",
  "Small steps still move me forward.",
  "I am proud of how far I've come.",
  "I choose to focus on what I can control.",
  "I am worthy of love and care.",
  "Today, I will be gentle with myself.",
  "I have people who care about me.",
  "Mistakes help me learn.",
];

export const ENCOURAGEMENT = [
  "Checking in with yourself is a kind thing to do.",
  "You don't have to do everything today.",
  "A glass of water and a deep breath are a great start.",
  "Progress, not perfection.",
  "It's okay to ask for help.",
  "Rest is productive too.",
  "Something small and good is worth noticing today.",
  "You've gotten through every hard day so far.",
  "Be as kind to yourself as you would be to a friend.",
  "One thing at a time is plenty.",
];

export const GRATITUDE_PROMPTS = [
  "Name three small things that went well today.",
  "Who is someone you're grateful for, and why?",
  "What's something you're looking forward to?",
  "What's a comfort you often take for granted?",
  "What made you laugh or smile recently?",
  "What's something your body did for you today?",
  "What's a place that makes you feel calm?",
  "What's a skill you're glad you have?",
];

/** Guided journal prompts by theme. */
export const GUIDED_PROMPTS: { theme: string; prompts: string[] }[] = [
  { theme: "Reflection", prompts: ["What was the best part of today?", "What's been on your mind lately?", "What did you learn about yourself this week?", "If today had a title, what would it be?"] },
  { theme: "Stress & worry", prompts: ["What's worrying you, and what part of it can you control?", "What would you tell a friend in your situation?", "What helped the last time you felt this way?", "What's one small thing that would make tomorrow easier?"] },
  { theme: "Self-kindness", prompts: ["What's something you did well recently?", "How can you be kinder to yourself this week?", "What do you need more of right now?", "Write a short note to yourself from someone who loves you."] },
  { theme: "Gratitude", prompts: GRATITUDE_PROMPTS.slice(0, 4) },
  { theme: "Goals & hopes", prompts: ["What's one thing you'd like to do more of?", "Where do you see yourself in a year?", "What habit would make the biggest difference for you?", "What's a small win you can aim for tomorrow?"] },
  { theme: "Relationships", prompts: ["Who made you feel supported recently?", "Is there a conversation you'd like to have?", "How did you show someone you care this week?", "Who would you like to spend more time with?"] },
];

const dayNumber = (iso: string) => Math.floor(Date.parse(`${iso}T12:00:00Z`) / 86_400_000);
/** Today's pick from a list (the same all day, different each day). */
export const pickForDay = <T,>(list: readonly T[], date: string, salt = 0) => list[(dayNumber(date) + salt) % list.length]!;
