import { test } from "node:test";
import assert from "node:assert/strict";
import { babyAge, dayTotals, duration, logSummary, milkExpiry, monthsOld, napWindow, nextScheduled, nextSide, periodReport, pottyStats, predictNextFeed, reportSummary, since, sleepType, suggestActivities, wakeWindowFor } from "../src/lib/baby-kinds";

test("babyAge reads naturally", () => {
  assert.equal(babyAge("2026-11-20", "2026-11-22"), "2 days");
  assert.equal(babyAge("2026-10-25", "2026-11-22"), "4 weeks");
  assert.equal(babyAge("2026-07-10", "2026-11-22"), "4 months, 1 week");
  assert.equal(babyAge("2025-08-22", "2026-11-22"), "15 months");
  assert.equal(babyAge("2024-05-01", "2026-11-22"), "2 years, 6 months");
  assert.equal(babyAge("2026-12-01", "2026-11-22"), "Due in 9 days");
  assert.equal(babyAge(null, "2026-11-22"), null);
  assert.equal(monthsOld("2026-05-23", "2026-11-22"), 5);
  assert.equal(monthsOld("2026-05-22", "2026-11-22"), 6);
});

test("since and duration", () => {
  const now = new Date("2026-11-22T12:00:00Z");
  assert.equal(since(new Date("2026-11-22T11:59:40Z"), now), "just now");
  assert.equal(since(new Date("2026-11-22T11:35:00Z"), now), "25 min ago");
  assert.equal(since(new Date("2026-11-22T09:50:00Z"), now), "2 h 10 min ago");
  assert.equal(since(new Date("2026-11-21T08:00:00Z"), now), "yesterday");
  assert.equal(duration(40), "40 min");
  assert.equal(duration(85), "1 h 25 min");
  assert.equal(duration(120), "2 h");
});

test("dayTotals counts feeds, diapers and sleep inside the day", () => {
  const d = (s: string) => new Date(`2026-11-22T${s}:00Z`);
  const start = d("00:00");
  const end = new Date("2026-11-23T00:00:00Z");
  const now = d("15:00");
  const logs = [
    { kind: "nursing", startedAt: d("06:00"), endedAt: d("06:20"), amount: null, data: { side: "left" } },
    { kind: "bottle", startedAt: d("09:00"), endedAt: null, amount: "4", data: {} },
    { kind: "bottle", startedAt: d("12:00"), endedAt: null, amount: "3.5", data: {} },
    { kind: "diaper", startedAt: d("07:00"), endedAt: null, amount: null, data: { type: "wet" } },
    { kind: "diaper", startedAt: d("10:00"), endedAt: null, amount: null, data: { type: "both" } },
    // Overnight sleep from yesterday 22:00 to 05:00: 5 hours fall in today.
    { kind: "sleep", startedAt: new Date("2026-11-21T22:00:00Z"), endedAt: d("05:00"), amount: null, data: {} },
    // A nap still going: 13:00 → now (15:00) = 2 hours.
    { kind: "sleep", startedAt: d("13:00"), endedAt: null, amount: null, data: {} },
    // Yesterday's bottle doesn't count.
    { kind: "bottle", startedAt: new Date("2026-11-21T20:00:00Z"), endedAt: null, amount: "5", data: {} },
  ];
  const t = dayTotals(logs, start, end, now);
  assert.equal(t.feeds, 3);
  assert.equal(t.nursingMinutes, 20);
  assert.equal(t.bottles, 2);
  assert.equal(t.bottleAmount, 7.5);
  assert.equal(t.diapers, 2);
  assert.equal(t.wet, 2);
  assert.equal(t.dirty, 1);
  assert.equal(t.sleepMinutes, 7 * 60);
  assert.equal(t.naps, 2);
});

test("nextScheduled finds the next routine item, wrapping to tomorrow", () => {
  const items = [
    { time: "07:00", days: [], title: "Wake" },
    { time: "12:30", days: [], title: "Nap" },
    { time: "10:00", days: [6], title: "Swim (Saturdays)" },
    { time: "19:30", days: [], title: "Bedtime" },
  ];
  assert.equal(nextScheduled(items, 11 * 60, 0)?.item.title, "Nap");
  assert.equal(nextScheduled(items, 8 * 60, 6)?.item.title, "Swim (Saturdays)");
  const late = nextScheduled(items, 20 * 60, 1);
  assert.equal(late?.item.title, "Wake");
  assert.equal(late?.tomorrow, true);
  assert.equal(nextScheduled([], 0, 0), null);
});

test("nextSide alternates", () => {
  assert.equal(nextSide("left"), "right");
  assert.equal(nextSide("right"), "left");
  assert.equal(nextSide(undefined), null);
});


test("wake windows and the next nap window by age", () => {
  assert.equal(wakeWindowFor(0)!.max, 60);
  assert.equal(wakeWindowFor(6)!.min, 120);
  assert.equal(wakeWindowFor(null), null);
  const woke = new Date("2026-11-22T13:00:00Z");
  const w = napWindow(woke, 4)!;
  assert.equal(w.from.toISOString(), "2026-11-22T14:15:00.000Z");
  assert.equal(w.to.toISOString(), "2026-11-22T15:00:00.000Z");
  assert.equal(napWindow(null, 4), null);
});

test("next feed estimate from the recent rhythm (long night gaps ignored)", () => {
  const t = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 22, h, m));
  const feeds = [t(0), t(7), t(10), t(13, 10), t(16)]; // 7 h night gap ignored; ~3 h rhythm
  const p = predictNextFeed(feeds)!;
  assert.equal(p.everyMinutes, 180);
  assert.equal(p.at.toISOString(), "2026-11-22T19:00:00.000Z");
  assert.equal(predictNextFeed([t(1), t(4)]), null);
});

test("sleep type: what the person chose, else 3+ hours from evening is overnight", () => {
  const s = new Date("2026-11-22T20:00:00Z");
  assert.equal(sleepType({ startedAt: s, endedAt: new Date("2026-11-23T04:00:00Z"), data: {} }, 20, s), "night");
  assert.equal(sleepType({ startedAt: s, endedAt: new Date("2026-11-22T21:00:00Z"), data: {} }, 20, s), "nap");
  assert.equal(sleepType({ startedAt: s, endedAt: null, data: { type: "nap" } }, 20, s), "nap");
});

test("potty progress", () => {
  const logs = ["pee", "poop", "tried", "accident", "both", "tried"].map((r) => ({ data: { result: r } }));
  assert.deepEqual(pottyStats(logs), { tries: 5, wins: 3, accidents: 1, rate: 60 });
  assert.equal(pottyStats([]).rate, null);
});

test("breast milk keeps: fridge 4 days, freezer ~6 months, room 4 hours", () => {
  const p = new Date("2026-11-22T08:00:00Z");
  assert.equal(milkExpiry("fridge", p).toISOString(), "2026-11-26T08:00:00.000Z");
  assert.equal(milkExpiry("room", p).toISOString(), "2026-11-22T12:00:00.000Z");
  assert.equal(milkExpiry("freezer", p).toISOString().slice(0, 10), "2027-05-21");
});

test("reports total up days and compare with the period before", () => {
  const day = (feeds: number, sleep: number) => ({ feeds, nursingMinutes: 0, bottles: feeds, bottleAmount: feeds * 4, diapers: 6, wet: 4, dirty: 2, sleepMinutes: sleep, naps: 3, tummyMinutes: 10 });
  const cur = periodReport([day(8, 840), day(8, 900)], [4, 3]);
  assert.equal(cur.feedsPerDay, 8);
  assert.equal(cur.bottleAmount, 64);
  assert.equal(cur.pumpTotal, 7);
  const prev = periodReport([day(6, 780), day(6, 780)], []);
  const text = reportSummary(cur, prev, "oz");
  assert.match(text, /About 8 feeds a day/);
  assert.match(text, /Sleep is up 1 h/);
  assert.match(text, /More feeds than before/);
  assert.match(reportSummary(periodReport([], []), null, "oz"), /Not much logged/);
});

test("activity ideas fit the age and favour what hasn't been done", () => {
  const ideas = suggestActivities(5, ["Toy just out of reach", "Rattle reach"], "2026-11-22", 3);
  assert.equal(ideas.length, 3);
  for (const a of ideas) assert.ok(a.from <= 5 && 5 < a.to);
  assert.ok(!ideas.some((a) => a.category === "tummy"));
});

test("log summaries for pumping and potty", () => {
  const now = new Date("2026-11-22T12:00:00Z");
  const u = { volume: "oz", weight: "lb" };
  assert.equal(logSummary({ kind: "pump", startedAt: new Date("2026-11-22T11:00:00Z"), endedAt: new Date("2026-11-22T11:20:00Z"), amount: "5", data: { side: "both", stored: "freezer" } }, u, now), "5 oz · both · 20 min · stored in the freezer");
  assert.equal(logSummary({ kind: "potty", startedAt: now, endedAt: null, amount: null, data: { result: "pee", where: "potty", prompted: true } }, u, now), "Pee in the potty · potty · prompted");
});
