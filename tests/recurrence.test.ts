import { test } from "node:test";
import assert from "node:assert/strict";
import { describeRule, nextOccurrence, occurrencesBetween } from "../src/lib/recurrence";

test("weekly on multiple days, every other week", () => {
  const r = { freq: "weekly" as const, interval: 2, byWeekday: [1, 4], startsOn: "2026-11-02" };
  assert.deepEqual(occurrencesBetween(r, "2026-11-01", "2026-11-30"), ["2026-11-02", "2026-11-05", "2026-11-16", "2026-11-19", "2026-11-30"]);
  assert.equal(describeRule(r), "Every 2 weeks on Mon, Thu");
});

test("monthly on the 31st clamps to month end", () => {
  assert.deepEqual(occurrencesBetween({ freq: "monthly", interval: 1, byMonthDay: [31], startsOn: "2026-01-31" }, "2026-02-01", "2026-04-30"), ["2026-02-28", "2026-03-31", "2026-04-30"]);
});

test("count limits occurrences", () => {
  assert.deepEqual(occurrencesBetween({ freq: "daily", interval: 1, startsOn: "2026-11-10", count: 3 }, "2026-11-11", "2026-11-20"), ["2026-11-11", "2026-11-12"]);
});

test("seasonal (yearly in selected months)", () => {
  assert.deepEqual(occurrencesBetween({ freq: "yearly", interval: 1, byMonth: [3, 6, 9, 12], startsOn: "2026-03-15" }, "2026-01-01", "2026-12-31"), ["2026-03-15", "2026-06-15", "2026-09-15", "2026-12-15"]);
  assert.equal(nextOccurrence({ freq: "yearly", interval: 1, byMonth: [3, 6, 9, 12], startsOn: "2026-03-15" }, "2026-11-12"), "2026-12-15");
});
