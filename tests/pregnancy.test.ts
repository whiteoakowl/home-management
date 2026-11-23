import { test } from "node:test";
import assert from "node:assert/strict";
import { checkDates, contractionStats, countdownText, estimateDueDate, gestationOn, gestationText, minutesToCount, trimesterOfWeek, weekOn } from "../src/lib/pregnancy/dates";
import { PREGNANCY_FEATURES, pregnancyFeature } from "../src/lib/pregnancy/features";
import { builtInWeek, mergeWeek, WEEKS_COUNT } from "../src/lib/pregnancy/weeks";
import { CHECKLISTS } from "../src/lib/pregnancy/catalog";

test("due date from each starting point", () => {
  assert.deepEqual(estimateDueDate({ due: "2027-03-01", lmp: "2026-01-01" }), { due: "2027-03-01", source: "due" });
  assert.equal(estimateDueDate({ lmp: "2026-06-01" })!.due, "2027-03-08");
  assert.equal(estimateDueDate({ conception: "2026-06-15" })!.due, "2027-03-08");
  assert.equal(estimateDueDate({ ivfTransfer: "2026-06-20", embryoDays: 5 })!.due, "2027-03-08");
  assert.equal(estimateDueDate({ ivfTransfer: "2026-06-18", embryoDays: 3 })!.due, "2027-03-08");
  assert.equal(estimateDueDate({}), null);
});

test("week, trimester and countdown", () => {
  const g = gestationOn("2027-03-08", "2026-06-01")!;
  assert.equal(g.weeks, 0);
  assert.equal(g.week, 1);
  const mid = gestationOn("2027-03-08", "2026-11-23")!;
  assert.equal(mid.weeks, 25);
  assert.equal(mid.dayOfWeek, 0);
  assert.equal(mid.week, 26);
  assert.equal(mid.trimester, 2);
  assert.equal(gestationText(mid), "25 weeks");
  assert.equal(gestationText(gestationOn("2027-03-08", "2026-11-24")!), "25 weeks, 1 day");
  assert.match(countdownText(mid), /^105 days to go/);
  assert.equal(gestationOn("2027-03-08", "2026-05-01"), null, "before the LMP");
  const late = gestationOn("2027-03-08", "2027-03-11")!;
  assert.equal(late.pastDue, true);
  assert.match(countdownText(late), /past the estimated due date/);
  assert.equal(gestationOn("2027-03-08", "2027-03-08")!.daysLeft, 0);
  assert.equal(trimesterOfWeek(13), 1);
  assert.equal(trimesterOfWeek(14), 2);
  assert.equal(trimesterOfWeek(28), 3);
  assert.equal(weekOn(null, "2026-11-23"), null);
});

test("date checks reject the impossible", () => {
  assert.match(checkDates({ lmp: "2026-12-30" }, "2026-11-23")!, /future/);
  assert.match(checkDates({ due: "2028-06-01" }, "2026-11-23")!, /42 weeks/);
  assert.match(checkDates({ due: "2025-01-01" }, "2026-11-23")!, /over a year ago/);
  assert.match(checkDates({ due: "2026-02-30" }, "2026-11-23")!, /real date/);
  assert.equal(checkDates({ due: "2027-03-08" }, "2026-11-23"), null);
});

test("kick counts and contraction stats", () => {
  const start = "2026-11-23T10:00:00.000Z";
  const times = Array.from({ length: 10 }, (_, i) => new Date(Date.parse(start) + (i + 1) * 90_000).toISOString());
  assert.equal(minutesToCount(times, start), 15);
  assert.equal(minutesToCount(times.slice(0, 5), start), null);
  const at = (m: number, s = 0) => new Date(Date.parse(start) + m * 60_000 + s * 1000).toISOString();
  const st = contractionStats([
    { s: at(0), e: at(0, 50) },
    { s: at(6), e: at(6, 60) },
    { s: at(11), e: at(11, 70) },
    { s: at(15), e: null },
  ]);
  assert.equal(st.count, 3);
  assert.deepEqual(st.rows.map((r) => r.seconds), [50, 60, 70]);
  assert.deepEqual(st.rows.map((r) => r.interval), [null, 6, 5]);
  assert.equal(st.avgSeconds, 60);
  assert.equal(st.avgInterval, 5.5);
  assert.equal(st.spanMinutes, 12);
  assert.equal(contractionStats([]).count, 0);
});

test("week content: every week exists and admin overrides are validated", () => {
  for (let w = 1; w <= WEEKS_COUNT; w++) {
    const c = builtInWeek(w);
    assert.equal(c.week, w);
    assert.ok(c.size && c.baby && c.bodyChanges, `week ${w}`);
    assert.ok(c.symptoms.length && c.care.length && c.prepare.length && c.questions.length, `week ${w} lists`);
  }
  const base = builtInWeek(20);
  const m = mergeWeek(base, { size: "a banana", milestones: ["Anatomy scan"], lengthCm: "oops", development: { senses: "Hears your voice" }, evil: "<script>" });
  assert.equal(m.size, "a banana");
  assert.deepEqual(m.milestones, ["Anatomy scan"]);
  assert.equal(m.lengthCm, base.lengthCm, "bad numbers ignored");
  assert.equal(m.development.senses, "Hears your voice");
  assert.equal(m.development.body, base.development.body);
  assert.equal((m as Record<string, unknown>).evil, undefined);
  assert.deepEqual(mergeWeek(base, null), base);
});

test("free and premium features are configured in one place", () => {
  assert.equal(pregnancyFeature({ premium: false }, "kicks"), true);
  assert.equal(pregnancyFeature({ premium: false }, "journal"), false);
  assert.equal(pregnancyFeature({ premium: true }, "journal"), true);
  for (const core of ["tracker", "weeks", "appointments", "symptoms", "contractions"] as const) assert.equal(PREGNANCY_FEATURES[core], "free");
});

test("third-trimester checklists appear from their week", () => {
  for (const c of CHECKLISTS.filter((x) => x.area === "third")) assert.ok(c.fromWeek && c.fromWeek >= 28);
  assert.equal(new Set(CHECKLISTS.map((c) => c.key)).size, CHECKLISTS.length);
});
