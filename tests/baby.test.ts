import { test } from "node:test";
import assert from "node:assert/strict";
import { babyAge, dayTotals, duration, monthsOld, nextScheduled, nextSide, since } from "../src/lib/baby-kinds";

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
