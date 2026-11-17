import { describe, it, test } from "node:test";
import assert from "node:assert/strict";
import { classDates, dayOffFor, fmtTime, pairLifeDays, reorderDue, shiftHours } from "../src/lib/dance";

const tue = { memberId: "a", weekday: 2, startsOn: null, endsOn: null };

test("weekly class dates in a range", () => {
  // Nov 2026: Tuesdays are 3, 10, 17, 24
  assert.deepEqual(classDates(tue, "2026-11-01", "2026-11-30", []), ["2026-11-03", "2026-11-10", "2026-11-17", "2026-11-24"]);
});

test("days off skip classes (studio-wide and per dancer)", () => {
  const off = [
    { memberId: null, startDate: "2026-11-23", endDate: "2026-11-29", title: "Thanksgiving break" },
    { memberId: "b", startDate: "2026-11-10", endDate: "2026-11-10", title: "Sick" },
  ];
  assert.deepEqual(classDates(tue, "2026-11-01", "2026-11-30", off), ["2026-11-03", "2026-11-10", "2026-11-17"]);
  assert.deepEqual(classDates({ ...tue, memberId: "b" }, "2026-11-01", "2026-11-30", off), ["2026-11-03", "2026-11-17"]);
  assert.equal(dayOffFor("2026-11-25", "a", off)?.title, "Thanksgiving break");
});

test("season limits", () => {
  assert.deepEqual(classDates({ ...tue, startsOn: "2026-11-10", endsOn: "2026-11-20" }, "2026-11-01", "2026-11-30", []), ["2026-11-10", "2026-11-17"]);
});

test("times and hours", () => {
  assert.equal(fmtTime("16:30:00"), "4:30 PM");
  assert.equal(fmtTime("00:05"), "12:05 AM");
  assert.equal(shiftHours([{ startTime: "09:00", endTime: "17:30" }, { startTime: "22:00", endTime: "06:00" }]), 16.5);
});

describe("pointe shoes reorder", () => {
  const today = "2026-11-17";
  it("averages how long retired pairs lasted", () => {
    assert.equal(
      pairLifeDays([
        { status: "retired", firstWornOn: "2026-09-01", retiredOn: "2026-10-01", reorderBy: null },
        { status: "retired", firstWornOn: "2026-10-01", retiredOn: "2026-11-10", reorderBy: null },
        { status: "in_use", firstWornOn: "2026-11-10", retiredOn: null, reorderBy: null },
      ]),
      35,
    );
  });
  it("orders two weeks before the pair in use (plus spares) wears out", () => {
    const pairs = [
      { status: "retired" as const, firstWornOn: "2026-09-01", retiredOn: "2026-10-01", reorderBy: null },
      { status: "in_use" as const, firstWornOn: "2026-11-01", retiredOn: null, reorderBy: null },
    ];
    assert.deepEqual(reorderDue(pairs, today), { date: "2026-11-17", status: "now", lifeDays: 30, estimated: false });
    const withSpare = reorderDue([...pairs, { status: "on_hand", firstWornOn: null, retiredOn: null, reorderBy: null }], today);
    assert.equal(withSpare.date, "2026-12-17");
    assert.equal(withSpare.status, "ok");
  });
  it("uses 6 weeks when there's no history, and nothing is due once a pair is on order", () => {
    const r = reorderDue([{ status: "in_use", firstWornOn: "2026-11-10", retiredOn: null, reorderBy: null }], today);
    assert.equal(r.date, "2026-12-08");
    assert.equal(r.estimated, true);
    assert.equal(reorderDue([{ status: "ordered", firstWornOn: null, retiredOn: null, reorderBy: null }], today).status, "ordered");
    assert.equal(reorderDue([], today).status, "now");
  });
  it("a date set by hand wins", () => {
    assert.equal(reorderDue([{ status: "in_use", firstWornOn: "2026-11-10", retiredOn: null, reorderBy: "2026-11-20" }], today).status, "soon");
  });
});
