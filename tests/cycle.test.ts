import { test } from "node:test";
import assert from "node:assert/strict";
import { cycleStats, cyclesFrom, estimate, periodsFrom, predictedMarks } from "../src/lib/cycle";

const flowDays = (start: string, n: number, flow = "medium") =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(`${start}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return { date: d.toISOString().slice(0, 10), flow };
  });

test("groups flow days into periods; spotting alone doesn't start one; one-day gaps join", () => {
  const days = [...flowDays("2026-01-01", 3), { date: "2026-01-05", flow: "light" }, { date: "2026-01-20", flow: "spotting" }, ...flowDays("2026-01-29", 5)];
  const p = periodsFrom(days);
  assert.deepEqual(p, [
    { start: "2026-01-01", end: "2026-01-05", length: 5 },
    { start: "2026-01-29", end: "2026-02-02", length: 5 },
  ]);
  assert.deepEqual(cyclesFrom(p), [{ start: "2026-01-01", end: "2026-01-28", length: 28, periodLength: 5 }]);
});

test("statistics from recorded cycles", () => {
  const days = [...flowDays("2026-01-01", 5), ...flowDays("2026-01-27", 4), ...flowDays("2026-02-26", 6), ...flowDays("2026-03-25", 5)];
  const s = cycleStats(periodsFrom(days));
  assert.equal(s.recordedCycles, 3);
  assert.equal(s.shortestCycle, 26);
  assert.equal(s.longestCycle, 30);
  assert.equal(s.recentCycle, 27);
  assert.equal(s.averageCycle, 27.7);
  assert.equal(s.averagePeriod, 5);
});

test("estimates next period, ovulation, fertile window and phase", () => {
  const days = [...flowDays("2026-01-01", 5), ...flowDays("2026-01-29", 5)];
  const e = estimate(days, "2026-02-10", { cycle: 30, period: 4 });
  assert.equal(e.usingTypical, false);
  assert.equal(e.cycleLength, 28);
  assert.equal(e.cycleDay, 13);
  assert.equal(e.nextPeriodStart, "2026-02-26");
  assert.equal(e.ovulation, "2026-02-12");
  assert.equal(e.fertileStart, "2026-02-07");
  assert.equal(e.fertileEnd, "2026-02-13");
  assert.equal(e.phase, "fertile");
  assert.equal(estimate(days, "2026-02-12", { cycle: 30, period: 4 }).phase, "ovulation");
  assert.equal(estimate(days, "2026-01-30", { cycle: 30, period: 4 }).phase, "period");
  assert.equal(estimate(days, "2026-02-20", { cycle: 30, period: 4 }).phase, "luteal");
  assert.equal(estimate(days, "2026-02-27", { cycle: 30, period: 4 }).phase, "late");
});

test("with one period, uses the person's typical lengths", () => {
  const e = estimate(flowDays("2026-03-01", 4), "2026-03-05", { cycle: 30, period: 4 });
  assert.equal(e.usingTypical, true);
  assert.equal(e.nextPeriodStart, "2026-03-31");
  assert.equal(estimate([], "2026-03-05", { cycle: 28, period: 5 }).cycleDay, null);
});

test("predicted calendar marks", () => {
  const e = estimate(flowDays("2026-01-01", 5), "2026-01-10", { cycle: 28, period: 5 });
  const m = predictedMarks(e, 1);
  assert.equal(m.get("2026-01-29"), "predicted");
  assert.equal(m.get("2026-02-02"), "predicted");
  assert.equal(m.get("2026-01-15"), "ovulation");
  assert.equal(m.get("2026-01-10"), "fertile");
});

test("simple tracking hides ovulation estimates", () => {
  const days = [...flowDays("2026-01-01", 5), ...flowDays("2026-01-29", 5)];
  const e = estimate(days, "2026-02-10", { cycle: 28, period: 5 }, { ovulation: false });
  assert.equal(e.phase, "between");
  assert.equal(e.ovulation, null);
  assert.equal(e.fertileStart, null);
  assert.equal(e.nextPeriodStart, "2026-02-26");
  const m = predictedMarks(e, 1);
  assert.equal(m.get("2026-02-26"), "predicted");
  assert.ok(![...m.values()].some((v) => v === "fertile" || v === "ovulation"));
});
