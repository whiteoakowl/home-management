/**
 * Chore rotation planner (pure; unit-tested in tests/rotation.test.ts).
 *
 * - Each rotating chore takes turns through its own list of people, in order.
 * - On any one day, nobody gets a second chore while someone else in that
 *   chore's rotation has none yet (counting every chore, cleaning job and task
 *   already on that day).
 * - Days that are fixed (done, or changed by hand) stay as they are, and the
 *   chore's turn order carries on from whoever had that day.
 */

export type RotatingChore = { id: string; rotation: string[] };
export type RotationSlot = {
  id: string;
  choreId: string;
  date: string;
  assigneeId: string | null;
  /** Done, skipped or assigned by hand: never moved, but it advances the turn order. */
  fixed: boolean;
};

export function planRotation(input: {
  chores: RotatingChore[];
  /** Occurrences of the rotating chores from the start date on. */
  slots: RotationSlot[];
  /** Who had each chore last before the start date. */
  lastBefore: Map<string, string | null>;
  /** Other work already on each day (non-rotating chores, tasks…): date → member → count. */
  otherLoad: Map<string, Map<string, number>>;
}): Map<string, string> {
  const byId = new Map(input.chores.filter((c) => c.rotation.length > 0).map((c) => [c.id, c]));
  // Next position in each chore's rotation.
  const next = new Map<string, number>();
  for (const c of byId.values()) {
    const last = input.lastBefore.get(c.id);
    const i = last ? c.rotation.indexOf(last) : -1;
    next.set(c.id, i >= 0 ? (i + 1) % c.rotation.length : 0);
  }
  const out = new Map<string, string>();
  const dates = [...new Set(input.slots.map((s) => s.date))].sort();
  for (const date of dates) {
    // Other chores that day count as "already has one" (no more), so turns stay even.
    const load = new Map([...(input.otherLoad.get(date) ?? [])].map(([m, n]) => [m, Math.min(n, 1)] as const));
    const today = input.slots.filter((s) => s.date === date && byId.has(s.choreId));
    // Fixed days count toward the load and move the turn order on.
    for (const s of today.filter((x) => x.fixed)) {
      if (s.assigneeId) load.set(s.assigneeId, (load.get(s.assigneeId) ?? 0) + 1);
      const c = byId.get(s.choreId)!;
      const i = s.assigneeId ? c.rotation.indexOf(s.assigneeId) : -1;
      if (i >= 0) next.set(c.id, (i + 1) % c.rotation.length);
    }
    // Smaller rotations first: they have the fewest choices.
    const open = today
      .filter((x) => !x.fixed)
      .sort((a, b) => byId.get(a.choreId)!.rotation.length - byId.get(b.choreId)!.rotation.length || a.choreId.localeCompare(b.choreId));
    for (const s of open) {
      const c = byId.get(s.choreId)!;
      const start = next.get(c.id) ?? 0;
      // Walk the rotation from whoever's turn it is and take the first person with
      // the fewest chores today, so nobody gets a second before everyone has one.
      let best = start;
      for (let k = 1; k < c.rotation.length; k++) {
        const i = (start + k) % c.rotation.length;
        if ((load.get(c.rotation[i]!) ?? 0) < (load.get(c.rotation[best]!) ?? 0)) best = i;
      }
      const who = c.rotation[best]!;
      out.set(s.id, who);
      load.set(who, (load.get(who) ?? 0) + 1);
      next.set(c.id, (best + 1) % c.rotation.length);
    }
  }
  return out;
}
