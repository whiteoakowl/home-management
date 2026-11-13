import { test } from "node:test";
import assert from "node:assert/strict";
import { condition, conditionLabel, intervalDays } from "../src/lib/cleanliness";

test("interval from rule or cadence", () => {
  assert.equal(intervalDays({ freq: "weekly", interval: 1 }), 7);
  assert.equal(intervalDays({ freq: "weekly", interval: 1, byWeekday: [1, 4] }), 3.5);
  assert.equal(intervalDays({ freq: "yearly", interval: 1, byMonth: [3, 6, 9, 12] }), 91.25);
  assert.equal(intervalDays(null, "monthly"), 30);
});

test("condition decays to zero at the interval", () => {
  assert.equal(condition("2026-11-10", 7, "2026-11-10"), 1);
  assert.ok(Math.abs(condition("2026-11-10", 7, "2026-11-13.5".slice(0, 10)) - (1 - 3 / 7)) < 1e-9);
  assert.equal(condition("2026-11-01", 7, "2026-11-13"), 0);
  assert.equal(condition(null, 7, "2026-11-13"), 0);
  assert.equal(conditionLabel(0.9).label, "Fresh");
  assert.equal(conditionLabel(0).label, "Due now");
});
