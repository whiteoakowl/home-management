import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planRotation, type RotationSlot } from "../src/lib/rotation";

const days = (n: number) => Array.from({ length: n }, (_, i) => `2026-11-${String(17 + i).padStart(2, "0")}`);
const slotsFor = (choreId: string, dates: string[], fixed: Record<string, string> = {}): RotationSlot[] =>
  dates.map((date) => ({ id: `${choreId}:${date}`, choreId, date, assigneeId: fixed[date] ?? null, fixed: date in fixed }));
const who = (plan: Map<string, string>, choreId: string, dates: string[]) => dates.map((d) => plan.get(`${choreId}:${d}`));

describe("chore rotation", () => {
  it("takes turns evenly through each person", () => {
    const d = days(6);
    const plan = planRotation({ chores: [{ id: "dishes", rotation: ["a", "b", "c"] }], slots: slotsFor("dishes", d), lastBefore: new Map(), otherLoad: new Map() });
    assert.deepEqual(who(plan, "dishes", d), ["a", "b", "c", "a", "b", "c"]);
  });

  it("continues from whoever had it last", () => {
    const d = days(3);
    const plan = planRotation({ chores: [{ id: "dishes", rotation: ["a", "b", "c"] }], slots: slotsFor("dishes", d), lastBefore: new Map([["dishes", "b"]]), otherLoad: new Map() });
    assert.deepEqual(who(plan, "dishes", d), ["c", "a", "b"]);
  });

  it("gives everyone one chore a day before anyone gets a second", () => {
    const d = days(4);
    const chores = [
      { id: "dishes", rotation: ["a", "b", "c"] },
      { id: "trash", rotation: ["a", "b", "c"] },
      { id: "dog", rotation: ["a", "b", "c"] },
    ];
    const plan = planRotation({ chores, slots: chores.flatMap((c) => slotsFor(c.id, d)), lastBefore: new Map(), otherLoad: new Map() });
    for (const date of d) {
      const people = chores.map((c) => plan.get(`${c.id}:${date}`));
      assert.deepEqual([...people].sort(), ["a", "b", "c"], `each person once on ${date}`);
    }
    // And over the days each person still rotates through each chore.
    for (const c of chores) assert.equal(new Set(who(plan, c.id, d.slice(0, 3))).size, 3);
  });

  it("counts other chores already on that day", () => {
    const d = days(1);
    const plan = planRotation({
      chores: [{ id: "dishes", rotation: ["a", "b"] }],
      slots: slotsFor("dishes", d),
      lastBefore: new Map(),
      otherLoad: new Map([[d[0]!, new Map([["a", 1]])]]),
    });
    assert.equal(plan.get(`dishes:${d[0]}`), "b");
  });

  it("a day changed by hand stays, and the rest of the rotation follows from it", () => {
    const d = days(5);
    // Day 2 was changed by hand to "a"; normally it would be "b".
    const plan = planRotation({ chores: [{ id: "dishes", rotation: ["a", "b", "c"] }], slots: slotsFor("dishes", d, { [d[1]!]: "a" }), lastBefore: new Map(), otherLoad: new Map() });
    assert.equal(plan.has(`dishes:${d[1]}`), false);
    assert.deepEqual(who(plan, "dishes", [d[0]!, d[2]!, d[3]!, d[4]!]), ["a", "b", "c", "a"]);
  });

  it("splits rotating chores one each even when everyone has other chores too", () => {
    const d = days(3);
    const chores = [
      { id: "dishes", rotation: ["a", "b", "c"] },
      { id: "trash", rotation: ["a", "b", "c"] },
      { id: "dog", rotation: ["a", "b", "c"] },
    ];
    const otherLoad = new Map(d.map((x) => [x, new Map([["a", 2], ["b", 1], ["c", 3]])]));
    const plan = planRotation({ chores, slots: chores.flatMap((c) => slotsFor(c.id, d)), lastBefore: new Map(), otherLoad });
    for (const date of d) assert.deepEqual(chores.map((c) => plan.get(`${c.id}:${date}`)).sort(), ["a", "b", "c"]);
    for (const c of chores) assert.equal(new Set(who(plan, c.id, d)).size, 3, `${c.id} goes round everyone`);
  });
});
