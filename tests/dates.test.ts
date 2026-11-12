import { test } from "node:test";
import assert from "node:assert/strict";
import { startOfWeek, utcToZoned, zonedToUtc } from "../src/lib/dates";

test("wall-clock time in a zone converts to UTC, across DST", () => {
  assert.equal(zonedToUtc("2026-11-12", "09:30", "America/New_York").toISOString(), "2026-11-12T14:30:00.000Z");
  assert.equal(zonedToUtc("2026-07-04", "18:00", "America/Los_Angeles").toISOString(), "2026-07-05T01:00:00.000Z");
  assert.equal(zonedToUtc("2026-03-08", "03:30", "America/New_York").toISOString(), "2026-03-08T07:30:00.000Z");
});

test("UTC converts back to local date/time", () => {
  assert.deepEqual(utcToZoned(new Date("2026-07-05T01:00:00Z"), "America/Los_Angeles"), { date: "2026-07-04", time: "18:00", minutes: 1080 });
});

test("start of week", () => {
  assert.equal(startOfWeek("2026-11-12"), "2026-11-08");
  assert.equal(startOfWeek("2026-11-12", 1), "2026-11-09");
});
