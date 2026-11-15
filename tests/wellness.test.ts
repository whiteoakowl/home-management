import { test } from "node:test";
import assert from "node:assert/strict";
import { averageMood, currentStreak, needsSupport, promptFor, thisWeekCount } from "../src/lib/wellness";
import { QUOTES, quoteFor } from "../src/lib/quotes";

test("streaks and weekly counts are gentle", () => {
  assert.equal(currentStreak(["2026-11-13", "2026-11-14"], "2026-11-15"), 2); // today not done yet: still 2
  assert.equal(currentStreak(["2026-11-13", "2026-11-14", "2026-11-15"], "2026-11-15"), 3);
  assert.equal(currentStreak(["2026-11-10"], "2026-11-15"), 0);
  assert.equal(thisWeekCount(["2026-11-09", "2026-11-11", "2026-11-11", "2026-11-08"], "2026-11-12"), 2); // Mon 9th – Thu 12th
});

test("mood averages", () => {
  assert.equal(averageMood(["great", "okay", null]), 4);
  assert.equal(averageMood([]), null);
});

test("safety check finds crisis language without false alarms on ordinary words", () => {
  assert.ok(needsSupport("I just want to die"));
  assert.ok(needsSupport(null, "thinking about hurting myself"));
  assert.ok(needsSupport("I don't want to be here anymore"));
  assert.ok(!needsSupport("This homework is killing me lol"));
  assert.ok(!needsSupport("I cut my hair today"));
});

test("daily quote and prompt are stable for a day and respect categories", () => {
  assert.equal(quoteFor("2026-11-15").id, quoteFor("2026-11-15").id);
  assert.equal(quoteFor("2026-11-15", ["Calm"]).category, "Calm");
  assert.ok(new Set(QUOTES.map((x) => x.id)).size === QUOTES.length);
  assert.equal(promptFor("2026-11-15"), promptFor("2026-11-15"));
});
