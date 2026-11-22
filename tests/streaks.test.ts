import { test } from "node:test";
import assert from "node:assert/strict";
import { streakLabel, streakOf } from "../src/lib/streaks";

test("daily streak counts back-to-back done days; today pending doesn't break it", () => {
  const s = streakOf(
    [
      { date: "2026-11-21", status: "pending" },
      { date: "2026-11-20", status: "done" },
      { date: "2026-11-19", status: "done" },
      { date: "2026-11-18", status: "done" },
      { date: "2026-11-17", status: "missed" },
      { date: "2026-11-16", status: "done" },
    ],
    "2026-11-21",
  );
  assert.deepEqual(s, { count: 3, unit: "day" });
  assert.equal(streakLabel(s), "3-day streak");
});

test("skipped days are passed over; overdue pending ends it", () => {
  assert.equal(streakOf([{ date: "2026-11-21", status: "done" }, { date: "2026-11-20", status: "skipped" }, { date: "2026-11-19", status: "done" }], "2026-11-21").count, 2);
  assert.equal(streakOf([{ date: "2026-11-21", status: "done" }, { date: "2026-11-20", status: "pending" }, { date: "2026-11-19", status: "done" }], "2026-11-21").count, 1);
});

test("weekly chores read as 'in a row'", () => {
  const s = streakOf([{ date: "2026-11-17", status: "done" }, { date: "2026-11-10", status: "done" }, { date: "2026-11-03", status: "done" }], "2026-11-21");
  assert.deepEqual(s, { count: 3, unit: "time" });
  assert.equal(streakLabel(s), "3 in a row");
});
