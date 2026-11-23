import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays } from "../src/lib/dates";
import { breathAt, BREATHING, followUps, habitStreak, insights, moodByWeekday, periodSummary, pickForDay, AFFIRMATIONS, series, sleepMinutes, weeklyCounts, weeklyStreak, type CheckInLike } from "../src/lib/wellness-insights";

const ci = (date: string, mood: string, extra: Partial<CheckInLike> = {}): CheckInLike => ({ date, mood, feelings: [], selfCare: [], energy: null, stress: null, sleepQuality: null, answers: {}, ...extra });

test("follow-ups respond to how the day went (max three)", () => {
  assert.deepEqual(followUps(null), []);
  const rough = followUps(ci("2026-11-22", "rough", { stress: 5, sleepQuality: 1, energy: 1, answers: { water: false } }));
  assert.equal(rough.length, 3);
  assert.equal(rough[0]!.key, "low");
  assert.ok(rough.some((f) => f.key === "stress" && f.href === "/wellness/breathe"));
  const good = followUps(ci("2026-11-22", "great"));
  assert.deepEqual(good.map((f) => f.key), ["good"]);
});

test("insights: weekday pattern, sleep, activities and stress trend", () => {
  const today = "2026-11-22"; // a Sunday
  const rows: CheckInLike[] = [];
  for (let i = 0; i < 28; i++) {
    const d = addDays(today, -i);
    const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
    const outside = i % 2 === 0;
    const sleptWell = i % 3 !== 0;
    const mood = wd === 6 ? "great" : wd === 1 ? "low" : outside && sleptWell ? "good" : "okay";
    rows.push(ci(d, mood, { selfCare: outside ? ["outside"] : [], sleepQuality: sleptWell ? 4 : 2, stress: i < 7 ? 2 : 4 }));
  }
  const found = insights(rows, [], today);
  const keys = found.map((f) => f.key);
  assert.ok(keys.includes("weekday"));
  assert.match(found.find((f) => f.key === "weekday")!.text, /higher on Saturdays and lower on Mondays/);
  assert.ok(keys.includes("sleep"));
  assert.ok(keys.includes("activities"));
  assert.match(found.find((f) => f.key === "stress")!.text, /lower this week/);
  assert.deepEqual(insights([], [], today), []);
  assert.equal(moodByWeekday(rows).find((d) => d.name === "Saturday")!.avg, 5);
});

test("period summary and chart series", () => {
  const rows = [ci("2026-11-20", "good", { energy: 4, feelings: ["Calm", "Happy"], selfCare: ["read"] }), ci("2026-11-21", "okay", { energy: 2, feelings: ["Calm"] })];
  const s = periodSummary(rows, "2026-11-16", "2026-11-22");
  assert.equal(s.checkIns, 2);
  assert.equal(s.mood, 3.5);
  assert.equal(s.energy, 3);
  assert.deepEqual(s.topFeelings, ["Calm", "Happy"]);
  assert.deepEqual(s.topSelfCare, ["Read"]);
  const pts = series(rows, "2026-11-19", 4, (c) => c.energy);
  assert.deepEqual(pts.map((p) => p.value), [null, 4, 2, null]);
});

test("sleep minutes cross midnight", () => {
  assert.equal(sleepMinutes("22:30", "06:45"), 495);
  assert.equal(sleepMinutes("01:00", "07:00"), 360);
  assert.equal(sleepMinutes(null, "07:00"), null);
});

test("habit streaks and weekly progress", () => {
  const today = "2026-11-22";
  assert.equal(habitStreak([today, "2026-11-21", "2026-11-20", "2026-11-18"], today), 3);
  assert.equal(habitStreak(["2026-11-21", "2026-11-20"], today), 2); // today not done yet: still counts
  assert.equal(habitStreak(["2026-11-19"], today), 0);
  // Weeks (Mon–Sun) with ≥2 days: this week (16–22) has 2, last week (9–15) has 2, the week before 1.
  const dates = ["2026-11-17", "2026-11-20", "2026-11-10", "2026-11-12", "2026-11-04"];
  assert.equal(weeklyStreak(dates, today, 2), 2);
  const w = weeklyCounts(dates, today, 3);
  assert.deepEqual(w.map((x) => x.n), [1, 2, 2]);
});

test("breathing phases follow the pattern", () => {
  const box = BREATHING.find((b) => b.key === "box")!.phases;
  assert.equal(breathAt(box, 0).phase.label, "Breathe in");
  assert.equal(breathAt(box, 4.5).phase.label, "Hold");
  assert.equal(breathAt(box, 9).phase.label, "Breathe out");
  assert.equal(breathAt(box, 17).cycle, 1);
  assert.equal(breathAt(box, 1).left, 3);
});

test("daily picks are stable within a day", () => {
  assert.equal(pickForDay(AFFIRMATIONS, "2026-11-22"), pickForDay(AFFIRMATIONS, "2026-11-22"));
  assert.notEqual(pickForDay(AFFIRMATIONS, "2026-11-22"), pickForDay(AFFIRMATIONS, "2026-11-23"));
});
