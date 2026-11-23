import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canEditMix,
  canSeeMix,
  clampVolume,
  cleanMixName,
  fadeSecondsFor,
  formatRemaining,
  isFreeSound,
  pushRecent,
  PRESET_MIXES,
  RECENT_LIMIT,
  sanitizeMixItems,
  searchSounds,
  sliderToGain,
  soundById,
  SOUNDS,
} from "../src/lib/sounds/catalog";
import { RECIPES, SoundEngine } from "../src/lib/sounds/engine";

test("every sound in the library has a recipe, and presets only use real sounds", () => {
  for (const s of SOUNDS) assert.ok(RECIPES[s.id], `missing recipe for ${s.id}`);
  for (const p of PRESET_MIXES) for (const i of p.items) assert.ok(soundById(i.soundId), `${p.id} uses unknown ${i.soundId}`);
  assert.deepEqual(SOUNDS.filter((s) => s.free).map((s) => s.id).sort(), ["brown", "fan", "ocean", "rain", "white"]);
});

test("search finds by name, category and tag", () => {
  assert.ok(searchSounds("rain").some((s) => s.id === "thunderstorm"));
  assert.ok(searchSounds("focus").some((s) => s.id === "brown"));
  assert.ok(searchSounds("fire").some((s) => s.id === "campfire"));
  assert.equal(searchSounds("xyzzy").length, 0);
  assert.equal(searchSounds("  ").length, SOUNDS.length);
});

test("mix items are cleaned: known sounds, once each, volumes 0–100, max 8, free sounds only on Free", () => {
  const raw = [{ soundId: "rain", volume: 150 }, { soundId: "rain", volume: 10 }, { soundId: "nope", volume: 50 }, { soundId: "forest", volume: "40" }, { soundId: "brown", volume: -5, muted: true }, null, "x"];
  assert.deepEqual(sanitizeMixItems(raw, { premium: true }), [
    { soundId: "rain", volume: 100 },
    { soundId: "forest", volume: 40 },
    { soundId: "brown", volume: 0, muted: true },
  ]);
  assert.deepEqual(sanitizeMixItems(raw, { premium: false }).map((i) => i.soundId), ["rain", "brown"]);
  assert.equal(sanitizeMixItems(SOUNDS.map((s) => ({ soundId: s.id, volume: 50 })), { premium: true }).length, 8);
  assert.deepEqual(sanitizeMixItems("not an array", { premium: true }), []);
  assert.equal(clampVolume("abc", 60), 60);
  assert.ok(isFreeSound("rain") && !isFreeSound("forest"));
});

test("mix names are trimmed, capped and stripped of control characters", () => {
  assert.equal(cleanMixName("  Rainy\u0000 Night \n"), "Rainy Night");
  assert.equal(cleanMixName("x".repeat(100)).length, 60);
  assert.equal(cleanMixName(42), "");
  assert.equal(cleanMixName("<script>alert(1)</script>"), "<script>alert(1)</script>"); // stored as text; React escapes it
});

test("who may see and change a mix (household and member isolation)", () => {
  const sara = { familyId: "f1", memberId: "sara" };
  const jack = { familyId: "f1", memberId: "jack" };
  const other = { familyId: "f2", memberId: "zoe" };
  const priv = { familyId: "f1", memberId: "sara", isShared: false, allowEdits: false };
  const shared = { ...priv, isShared: true };
  const sharedEdit = { ...priv, isShared: true, allowEdits: true };
  assert.ok(canSeeMix(sara, priv) && canEditMix(sara, priv));
  assert.ok(!canSeeMix(jack, priv) && !canEditMix(jack, priv));
  assert.ok(canSeeMix(jack, shared) && !canEditMix(jack, shared));
  assert.ok(canEditMix(jack, sharedEdit));
  assert.ok(!canSeeMix(other, sharedEdit) && !canEditMix(other, sharedEdit));
});

test("recently played keeps the newest first, no duplicates, capped", () => {
  let list = [] as ReturnType<typeof pushRecent>;
  for (let i = 0; i < 15; i++) list = pushRecent(list, { type: "sound", id: `s${i}` }, `2026-01-01T00:00:${String(i).padStart(2, "0")}Z`);
  assert.equal(list.length, RECENT_LIMIT);
  assert.equal(list[0]!.id, "s14");
  list = pushRecent(list, { type: "sound", id: "s10" }, "2026-01-02T00:00:00Z");
  assert.equal(list[0]!.id, "s10");
  assert.equal(list.filter((r) => r.id === "s10").length, 1);
  assert.deepEqual(pushRecent(null as never, { type: "mix", id: "m" }, "t"), [{ type: "mix", id: "m", at: "t" }]);
});

test("timer helpers", () => {
  assert.equal(formatRemaining(65_000), "1:05");
  assert.equal(formatRemaining(3_725_000), "1:02:05");
  assert.equal(formatRemaining(-5), "0:00");
  assert.equal(fadeSecondsFor(5), 30);
  assert.equal(fadeSecondsFor(60), 60);
  assert.equal(fadeSecondsFor(0.5), 5);
  assert.equal(sliderToGain(0), 0);
  assert.equal(sliderToGain(100), 1);
  assert.equal(sliderToGain(50), 0.25);
});

// ─── Engine against a fake Web Audio API ────────────────────────────────────

class FakeParam {
  value = 0;
  setValueAtTime() {}
  linearRampToValueAtTime() {}
  setTargetAtTime() {}
  cancelScheduledValues() {}
}
class FakeNode {
  static live = new Set<FakeNode>();
  connections = 0;
  gain = new FakeParam();
  frequency = new FakeParam();
  Q = new FakeParam();
  detune = new FakeParam();
  playbackRate = new FakeParam();
  threshold = new FakeParam();
  ratio = new FakeParam();
  type = "";
  loop = false;
  buffer: unknown = null;
  started = false;
  stopped = false;
  constructor() {
    FakeNode.live.add(this);
  }
  connect(t: unknown) {
    this.connections++;
    return t;
  }
  disconnect() {
    this.connections = 0;
    FakeNode.live.delete(this);
  }
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
  }
}
class FakeContext {
  static made = 0;
  state = "running";
  sampleRate = 8000;
  currentTime = 0;
  destination = {};
  constructor() {
    FakeContext.made++;
  }
  createGain = () => new FakeNode();
  createBiquadFilter = () => new FakeNode();
  createOscillator = () => new FakeNode();
  createBufferSource = () => new FakeNode();
  createDynamicsCompressor = () => new FakeNode();
  createBuffer(channels: number, length: number, rate: number) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { duration: length / rate, getChannelData: (i: number) => data[i]! };
  }
  resume = async () => undefined;
  suspend = async () => undefined;
}

test("engine: one context, no duplicate voices, every node cleaned up on stop", async () => {
  (globalThis as unknown as { window: unknown }).window = { AudioContext: FakeContext };
  const realTimeout = globalThis.setTimeout;
  (globalThis as unknown as { setTimeout: unknown }).setTimeout = (fn: () => void) => (fn(), 0); // run fades instantly
  try {
    const e = new SoundEngine();
    await e.unlock();
    await e.unlock();
    assert.equal(FakeContext.made, 1, "only one AudioContext");
    const base = FakeNode.live.size; // master + compressor
    for (const s of SOUNDS) {
      e.set(s.id, 60);
      e.set(s.id, 40); // same sound again only changes volume
      assert.equal(e.playingCount, 1, `${s.id}: one voice`);
      e.remove(s.id);
      assert.equal(e.playingCount, 0);
      assert.equal(FakeNode.live.size, base, `${s.id}: all nodes disconnected`);
    }
    // A mix: sync adds and removes exactly what's asked.
    e.sync([{ soundId: "rain", volume: 60 }, { soundId: "brown", volume: 30 }, { soundId: "thunder", volume: 10 }]);
    assert.equal(e.playingCount, 3);
    e.sync([{ soundId: "rain", volume: 60 }]);
    assert.equal(e.playingCount, 1);
    e.stopAll();
    assert.equal(e.playingCount, 0);
    assert.equal(FakeNode.live.size, base);
    // Unknown ids do nothing.
    e.set("not-a-sound", 50);
    assert.equal(e.playingCount, 0);
  } finally {
    (globalThis as unknown as { setTimeout: unknown }).setTimeout = realTimeout;
  }
});
