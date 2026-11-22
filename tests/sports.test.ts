import { test } from "node:test";
import assert from "node:assert/strict";
import { battingAverage, formatTime, outcomeOf, parseTime, record, seasonLine, sportDef, teamStats } from "../src/lib/sports";

test("records from scores and explicit outcomes", () => {
  assert.equal(outcomeOf({ ourScore: 3, theirScore: 1 }), "win");
  assert.equal(outcomeOf({ ourScore: 1, theirScore: 1 }), "tie");
  assert.equal(outcomeOf({ ourScore: null, theirScore: null, outcome: "loss" }), "loss");
  assert.equal(outcomeOf({ ourScore: null, theirScore: 2 }), null);
  assert.deepEqual(record([{ ourScore: 3, theirScore: 1 }, { ourScore: 0, theirScore: 2 }, { ourScore: 2, theirScore: 2 }, { ourScore: null, theirScore: null }]).text, "1-1-1");
  assert.equal(record([{ ourScore: 5, theirScore: 1 }]).text, "1-0");
});

test("season totals, averages and bests", () => {
  const defs = teamStats("basketball");
  const line = seasonLine(defs, [{ pts: 10, reb: 4 }, { pts: 20 }, {}]);
  assert.equal(line.pts!.total, 30);
  assert.equal(line.pts!.avg, 15);
  assert.equal(line.pts!.games, 2);
  assert.equal(line.reb!.total, 4);
  const swim = seasonLine(teamStats("swimming"), [{ time: 65.3, place: 2 }, { time: 63.9, place: 1 }]);
  assert.equal(swim.time!.best, 63.9);
  assert.equal(swim.place!.best, 1);
  assert.equal(swim.time!.total, null);
});

test("custom stats, batting average and times", () => {
  const defs = teamStats("other", ["Laps", " "]);
  assert.equal(defs.length, 1);
  assert.equal(defs[0]!.label, "Laps");
  assert.equal(teamStats("soccer", ["Goals"]).length, sportDef("soccer").stats.length);
  assert.equal(battingAverage([{ ab: 3, h: 1 }, { ab: 0, h: 0 }]), ".333");
  assert.equal(battingAverage([]), null);
  assert.equal(parseTime("1:05.32"), 65.32);
  assert.equal(parseTime("58.1"), 58.1);
  assert.equal(parseTime("abc"), null);
  assert.equal(formatTime(65.32), "1:05.32");
  assert.equal(formatTime(58.1), "58.10");
});
