import { test } from "node:test";
import assert from "node:assert/strict";
import { offOn, shiftsBetween, timeOffLabel, weekdaysText, workDaysCovered, type Pattern, type TimeOff } from "../src/lib/work-schedule";

const p: Pattern = { id: "p1", memberId: "m1", weekdays: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "17:00", job: "Office", notes: null, startsOn: "2026-11-01", endsOn: null };

test("a Mon–Fri schedule repeats every week, for good", () => {
  const wk = shiftsBetween([p], [], [], "2026-11-23", "2026-11-29");
  assert.deepEqual(wk.map((s) => s.date), ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27"]);
  assert.ok(wk.every((s) => s.patternId === "p1" && s.job === "Office"));
  assert.equal(shiftsBetween([p], [], [], "2027-06-07", "2027-06-13").length, 5, "still going next year");
});

test("start and end dates are respected", () => {
  assert.equal(shiftsBetween([p], [], [], "2026-10-26", "2026-11-01").length, 0, "before it starts");
  const ended = { ...p, endsOn: "2026-11-25" };
  assert.deepEqual(shiftsBetween([ended], [], [], "2026-11-23", "2026-11-29").map((s) => s.date), ["2026-11-23", "2026-11-24", "2026-11-25"]);
});

test("time off skips the regular schedule, but not one-off shifts", () => {
  const off: TimeOff[] = [{ id: "o1", memberId: "m1", kind: "vacation", title: null, startDate: "2026-11-25", endDate: "2026-11-27" }];
  const oneOff = [{ id: "s1", memberId: "m1", date: "2026-11-26", startTime: "10:00", endTime: "12:00", job: null, notes: "Called in" }];
  const wk = shiftsBetween([p], oneOff, off, "2026-11-23", "2026-11-29");
  assert.deepEqual(wk.map((s) => `${s.date}${s.patternId ? "" : "*"}`), ["2026-11-23", "2026-11-24", "2026-11-26*"]);
  assert.equal(offOn(off, "m1", "2026-11-26")?.id, "o1");
  assert.equal(offOn(off, "m2", "2026-11-26"), null, "only that person");
  assert.equal(workDaysCovered([p], "m1", "2026-11-23", "2026-11-29"), 5);
  assert.equal(timeOffLabel(off[0]!), "Vacation");
  assert.equal(timeOffLabel({ kind: "other", title: "Jury duty" }), "Jury duty");
});

test("weekday summaries", () => {
  assert.equal(weekdaysText([1, 2, 3, 4, 5]), "Mon–Fri");
  assert.equal(weekdaysText([0, 1, 2, 3, 4, 5, 6]), "Every day");
  assert.equal(weekdaysText([1, 3, 5]), "Mon, Wed, Fri");
  assert.equal(weekdaysText([4, 5, 6, 0]), "Thu–Sun");
});
