/**
 * Sleep Sounds audio engine (browser only).
 *
 * Every sound is generated with the Web Audio API. No audio files are used,
 * so nothing is downloaded or stored. How it stays light:
 *  - One AudioContext for the whole app, created on the first tap (browsers
 *    require a user gesture) and suspended whenever nothing is playing.
 *  - Textures (noise, raindrops, crackle, birdsong…) are rendered once into
 *    short looping AudioBuffers and shared; a buffer is released when no
 *    sound uses it any more.
 *  - Movement (waves, gusts) comes from slow oscillators and low-rate control
 *    buffers rather than timers, so playback keeps going in the background
 *    and uses very little CPU.
 *  - Each sound is a "voice" with its own gain. Playing a sound that is
 *    already playing only changes its volume (never two copies).
 *  - Stopping a voice fades it out, then stops and disconnects every node it
 *    created.
 */
import { sliderToGain } from "./catalog";

type Ctx = AudioContext;

// ─── Texture rendering (plain arrays, no audio APIs) ────────────────────────

type Render = (sr: number) => Float32Array[];

/** Deterministic random so textures sound the same each time (and loop cleanly). */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
}

function normalize(ch: Float32Array, peak = 0.9) {
  let m = 0;
  for (let i = 0; i < ch.length; i++) m = Math.max(m, Math.abs(ch[i]!));
  if (m > 0) for (let i = 0; i < ch.length; i++) ch[i] = (ch[i]! / m) * peak;
  return ch;
}

/** Crossfade the end into the start so a loop has no click. */
function seamless(ch: Float32Array, sr: number, secs = 0.25) {
  const n = Math.min(Math.floor(sr * secs), Math.floor(ch.length / 4));
  for (let i = 0; i < n; i++) {
    const a = i / n;
    const end = ch.length - n + i;
    ch[i] = ch[i]! * a + ch[end]! * (1 - a);
  }
  return ch.subarray(0, ch.length - n);
}

function whiteCh(len: number, seed: number) {
  const r = rng(seed);
  const ch = new Float32Array(len);
  for (let i = 0; i < len; i++) ch[i] = r();
  return ch;
}

function pinkCh(len: number, seed: number) {
  const r = rng(seed);
  const ch = new Float32Array(len);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < len; i++) {
    const w = r();
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    ch[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
    b6 = w * 0.115926;
  }
  return normalize(ch, 0.8);
}

function brownCh(len: number, seed: number) {
  const r = rng(seed);
  const ch = new Float32Array(len);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = (last + 0.02 * r()) / 1.02;
    ch[i] = last;
  }
  return normalize(ch, 0.85);
}

const stereo = (fn: (len: number, seed: number) => Float32Array, secs: number, seed: number): Render => (sr) => {
  const len = Math.floor(sr * secs);
  return [seamless(fn(len, seed), sr), seamless(fn(len, seed + 7919), sr)];
};

/** Sparse decaying bursts: raindrops (short, bright) or fire crackle (sharp, with pops). */
function bursts(opts: { secs: number; perSec: number; minMs: number; maxMs: number; seed: number; pops?: number }): Render {
  return (sr) => {
    const len = Math.floor(sr * opts.secs);
    return [0, 1].map((c) => {
      const r = rng(opts.seed + c * 101);
      const ch = new Float32Array(len);
      const count = Math.floor(opts.secs * opts.perSec);
      for (let k = 0; k < count; k++) {
        const at = Math.floor(((r() + 1) / 2) * (len - sr * 0.05));
        const tau = (opts.minMs + ((r() + 1) / 2) * (opts.maxMs - opts.minMs)) / 1000;
        const amp = Math.pow((r() + 1) / 2, 2) * 0.9 + 0.05;
        const n = Math.min(Math.floor(tau * sr * 5), len - at);
        for (let i = 0; i < n; i++) ch[at + i]! += r() * amp * Math.exp(-i / (tau * sr));
      }
      for (let k = 0; k < (opts.pops ?? 0) * opts.secs; k++) {
        const at = Math.floor(((r() + 1) / 2) * (len - sr * 0.1));
        const f = 700 + ((r() + 1) / 2) * 1800;
        const n = Math.floor(sr * 0.04);
        for (let i = 0; i < n; i++) ch[at + i]! += Math.sin((2 * Math.PI * f * i) / sr) * Math.exp(-i / (sr * 0.006)) * 0.8;
      }
      return seamless(normalize(ch, 0.9), sr, 0.05);
    });
  };
}

/** Rolling thunder: one or two long, low rumbles in a long buffer. */
const thunderRender: Render = (sr) => {
  const secs = 46;
  const len = Math.floor(sr * secs);
  const r = rng(4242);
  const out = [new Float32Array(len), new Float32Array(len)];
  const base = brownCh(len, 777);
  for (const [start, length, amp] of [
    [6, 9, 1],
    [28, 12, 0.7],
  ] as const) {
    const s0 = Math.floor(start * sr);
    const n = Math.floor(length * sr);
    for (let i = 0; i < n && s0 + i < len; i++) {
      const t = i / sr;
      // A soft onset, a few swells, then a long tail.
      const env = (1 - Math.exp(-t * 3)) * Math.exp(-t / (length / 3)) * (0.7 + 0.3 * Math.sin(t * 2.1 + r()));
      out[0]![s0 + i]! += base[s0 + i]! * env * amp;
      out[1]![s0 + i]! += base[(s0 + i + 2000) % len]! * env * amp;
    }
  }
  return out.map((ch) => seamless(normalize(ch, 0.95), sr, 0.5));
};

/** Birdsong: chirps, sweeps and short trills scattered across 24 seconds. */
const birdsRender: Render = (sr) => {
  const secs = 24;
  const len = Math.floor(sr * secs);
  return [0, 1].map((c) => {
    const r = rng(900 + c * 31);
    const ch = new Float32Array(len);
    let t = 0.4 + c * 0.9;
    while (t < secs - 1.5) {
      const notes = r() > 0.2 ? 1 + Math.floor(((r() + 1) / 2) * 6) : 1;
      const f0 = 2600 + ((r() + 1) / 2) * 2600;
      const sweep = (r() * 0.6) * f0;
      const dur = 0.04 + ((r() + 1) / 2) * 0.1;
      for (let k = 0; k < notes; k++) {
        const s0 = Math.floor((t + k * (dur + 0.03)) * sr);
        const n = Math.floor(dur * sr);
        let phase = 0;
        for (let i = 0; i < n && s0 + i < len; i++) {
          const x = i / n;
          const f = f0 + sweep * x;
          phase += (2 * Math.PI * f) / sr;
          ch[s0 + i]! += Math.sin(phase) * Math.sin(Math.PI * x) * 0.6 + Math.sin(phase * 2) * Math.sin(Math.PI * x) * 0.08;
        }
      }
      t += notes * (dur + 0.03) + 0.6 + ((r() + 1) / 2) * 2.8;
    }
    return seamless(normalize(ch, 0.7), sr, 0.1);
  });
};

/** Crickets: pulsed high tones in chirps, two crickets at different pitches and rates. */
const cricketsRender: Render = (sr) => {
  const secs = 12;
  const len = Math.floor(sr * secs);
  return [0, 1].map((c) => {
    const r = rng(55 + c * 13);
    const ch = new Float32Array(len);
    const f = c ? 4700 : 4300;
    const every = c ? 0.83 : 0.67;
    for (let t = c * 0.21; t < secs - 0.2; t += every + r() * 0.05) {
      for (let p = 0; p < 3; p++) {
        const s0 = Math.floor((t + p * 0.032) * sr);
        const n = Math.floor(0.018 * sr);
        for (let i = 0; i < n && s0 + i < len; i++) ch[s0 + i]! += Math.sin((2 * Math.PI * f * i) / sr) * Math.sin((Math.PI * i) / n);
      }
    }
    return seamless(normalize(ch, 0.6), sr, 0.05);
  });
};

/** One second of a soft "lub-dub" (60 a minute when looped). */
const heartbeatRender: Render = (sr) => {
  const len = sr;
  const ch = new Float32Array(len);
  const thump = (at: number, f: number, amp: number) => {
    const s0 = Math.floor(at * sr);
    const n = Math.floor(0.16 * sr);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      ch[s0 + i]! += Math.sin(2 * Math.PI * f * t) * Math.exp(-t / 0.045) * (1 - Math.exp(-t / 0.004)) * amp;
    }
  };
  thump(0.05, 58, 1);
  thump(0.33, 50, 0.7);
  normalize(ch, 0.9);
  return [ch, ch];
};

/** A soft bell (singing-bowl style) twice in 32 seconds. */
const bellsRender: Render = (sr) => {
  const secs = 32;
  const len = Math.floor(sr * secs);
  const ch = new Float32Array(len);
  for (const [at, f0] of [
    [1.5, 261.63],
    [17, 196],
  ] as const) {
    const s0 = Math.floor(at * sr);
    for (const [ratio, amp, decay] of [
      [1, 1, 5],
      [2.01, 0.4, 3],
      [2.76, 0.25, 2.2],
      [5.4, 0.08, 1],
    ] as const) {
      const n = Math.min(Math.floor(decay * 4 * sr), len - s0);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        ch[s0 + i]! += Math.sin(2 * Math.PI * f0 * ratio * t) * amp * Math.exp(-t / decay) * (1 - Math.exp(-t / 0.01));
      }
    }
  }
  normalize(ch, 0.6);
  return [ch, ch];
};

/** Slow random control signal (-1…1), at a low sample rate to stay tiny. */
const controlRender = (seed: number, secs = 40, stepSecs = 1.2): Render => (sr) => {
  const len = Math.floor(sr * secs);
  const r = rng(seed);
  const ch = new Float32Array(len);
  const step = Math.floor(sr * stepSecs);
  const points = Math.ceil(len / step) + 1;
  const vals = Array.from({ length: points }, () => r());
  vals[points - 1] = vals[0]!; // loops smoothly
  for (let i = 0; i < len; i++) {
    const k = Math.floor(i / step);
    const x = (i % step) / step;
    const a = vals[k]!;
    const b = vals[Math.min(k + 1, points - 1)]!;
    ch[i] = a + (b - a) * (0.5 - 0.5 * Math.cos(Math.PI * x));
  }
  return [ch];
};

const TEXTURES: Record<string, { render: Render; rate?: number }> = {
  white: { render: stereo(whiteCh, 6, 11) },
  pink: { render: stereo(pinkCh, 7, 23) },
  brown: { render: stereo(brownCh, 8, 37) },
  drops: { render: bursts({ secs: 9, perSec: 220, minMs: 0.4, maxMs: 2.5, seed: 61 }) },
  dropsSoft: { render: bursts({ secs: 11, perSec: 70, minMs: 0.6, maxMs: 3, seed: 67 }) },
  dropsHeavy: { render: bursts({ secs: 8, perSec: 600, minMs: 0.3, maxMs: 2.2, seed: 71 }) },
  crackle: { render: bursts({ secs: 13, perSec: 9, minMs: 0.3, maxMs: 2.5, seed: 83, pops: 0.6 }) },
  crackleBig: { render: bursts({ secs: 14, perSec: 16, minMs: 0.3, maxMs: 4, seed: 89, pops: 1.2 }) },
  thunder: { render: thunderRender },
  birds: { render: birdsRender },
  crickets: { render: cricketsRender },
  heartbeat: { render: heartbeatRender },
  bells: { render: bellsRender },
  ctrlA: { render: controlRender(101), rate: 4000 },
  ctrlB: { render: controlRender(211, 37, 0.7), rate: 4000 },
  ctrlC: { render: controlRender(307, 43, 2.5), rate: 4000 },
  ctrlFast: { render: controlRender(401, 11, 0.12), rate: 4000 },
};

// ─── Voices ─────────────────────────────────────────────────────────────────

/** Tools a recipe uses; everything it makes is tracked and cleaned up on stop. */
class Kit {
  private nodes: AudioNode[] = [];
  private sources: AudioScheduledSourceNode[] = [];
  private used: string[] = [];
  constructor(
    readonly ctx: Ctx,
    readonly out: AudioNode,
    private engine: SoundEngine,
  ) {}

  private keep<T extends AudioNode>(n: T) {
    this.nodes.push(n);
    return n;
  }

  /** A looping texture, started at a random point so layers never line up. */
  loop(key: string, opts: { rate?: number } = {}) {
    const buf = this.engine.buffer(key);
    this.used.push(key);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    if (opts.rate) src.playbackRate.value = opts.rate;
    src.start(0, Math.random() * buf.duration);
    this.sources.push(src);
    return this.keep(src);
  }
  filter(type: BiquadFilterType, freq: number, q = 0.7) {
    const f = this.keep(this.ctx.createBiquadFilter());
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }
  gain(v: number) {
    const g = this.keep(this.ctx.createGain());
    g.gain.value = v;
    return g;
  }
  osc(type: OscillatorType, freq: number, detune = 0) {
    const o = this.keep(this.ctx.createOscillator());
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    o.start();
    this.sources.push(o);
    return o;
  }
  /** A slow sine swinging `param` between min and max. */
  lfo(param: AudioParam, rate: number, min: number, max: number) {
    param.value = (min + max) / 2;
    const o = this.osc("sine", rate);
    const g = this.gain((max - min) / 2);
    o.connect(g).connect(param);
  }
  /** A slow random wander of `param` between min and max. */
  wander(param: AudioParam, key: "ctrlA" | "ctrlB" | "ctrlC" | "ctrlFast", min: number, max: number) {
    param.value = (min + max) / 2;
    const src = this.loop(key);
    const g = this.gain((max - min) / 2);
    src.connect(g).connect(param);
  }
  /** Connect a chain of nodes and send the last one out at `level`. */
  chain(level: number, ...nodes: AudioNode[]) {
    for (let i = 0; i < nodes.length - 1; i++) nodes[i]!.connect(nodes[i + 1]!);
    const g = this.gain(level);
    nodes[nodes.length - 1]!.connect(g).connect(this.out);
    return g;
  }

  dispose() {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    for (const n of this.nodes) n.disconnect();
    this.nodes = [];
    this.sources = [];
    for (const k of this.used) this.engine.release(k);
    this.used = [];
  }
}

type Recipe = (k: Kit) => void;

const rain = (k: Kit, o: { drops: string; body: number; dropLevel: number; tone: number; rumble?: number }) => {
  k.chain(o.body, k.loop("pink"), k.filter("bandpass", o.tone, 0.45));
  k.chain(o.dropLevel, k.loop(o.drops), k.filter("highpass", 1200), k.filter("lowpass", o.tone * 3));
  if (o.rumble) k.chain(o.rumble, k.loop("brown"), k.filter("lowpass", 250));
};
const waves = (k: Kit, rate: number, lo: number, hi: number, level: number) => {
  const f = k.filter("lowpass", 800, 0.5);
  const g = k.gain(level);
  k.loop("brown").connect(f);
  const p = k.loop("pink");
  const pg = k.gain(0.35);
  p.connect(pg).connect(f);
  f.connect(g).connect(k.out);
  k.lfo(f.frequency, rate, lo, hi);
  k.lfo(g.gain, rate, level * 0.15, level);
};
const windR = (k: Kit, level: number) => {
  const f = k.filter("bandpass", 700, 0.9);
  const g = k.gain(level);
  k.loop("pink").connect(f).connect(g).connect(k.out);
  k.wander(f.frequency, "ctrlA", 300, 1300);
  k.wander(g.gain, "ctrlB", level * 0.25, level);
};
const pad = (k: Kit, freqs: number[], level: number, cutoff: number) => {
  const f = k.filter("lowpass", cutoff, 0.5);
  const g = k.gain(level);
  for (const [i, fr] of freqs.entries()) {
    const o1 = k.osc(i % 2 ? "triangle" : "sine", fr, -4);
    const o2 = k.osc("sine", fr, 5);
    const og = k.gain(1 / freqs.length);
    o1.connect(og);
    o2.connect(og);
    og.connect(f);
  }
  f.connect(g).connect(k.out);
  k.lfo(f.frequency, 0.03, cutoff * 0.5, cutoff * 1.3);
  k.wander(g.gain, "ctrlC", level * 0.6, level);
};

export const RECIPES: Record<string, Recipe> = {
  white: (k) => void k.chain(0.32, k.loop("white"), k.filter("lowpass", 14000)),
  pink: (k) => void k.chain(0.5, k.loop("pink")),
  brown: (k) => void k.chain(0.75, k.loop("brown")),
  rain: (k) => rain(k, { drops: "drops", body: 0.38, dropLevel: 0.22, tone: 2400 }),
  "gentle-rain": (k) => rain(k, { drops: "dropsSoft", body: 0.22, dropLevel: 0.16, tone: 1500 }),
  "heavy-rain": (k) => rain(k, { drops: "dropsHeavy", body: 0.55, dropLevel: 0.25, tone: 3000, rumble: 0.3 }),
  thunderstorm: (k) => {
    rain(k, { drops: "dropsHeavy", body: 0.45, dropLevel: 0.2, tone: 2600, rumble: 0.25 });
    k.chain(0.9, k.loop("thunder"), k.filter("lowpass", 320));
  },
  thunder: (k) => void k.chain(0.9, k.loop("thunder"), k.filter("lowpass", 280)),
  ocean: (k) => waves(k, 0.09, 250, 1500, 0.8),
  "gentle-ocean": (k) => waves(k, 0.06, 180, 800, 0.6),
  river: (k) => {
    k.chain(0.3, k.loop("pink"), k.filter("bandpass", 900, 0.6));
    const f = k.filter("bandpass", 2600, 1.8);
    const g = k.gain(0.18);
    k.loop("white").connect(f).connect(g).connect(k.out);
    k.wander(f.frequency, "ctrlFast", 1600, 3400);
    k.wander(g.gain, "ctrlFast", 0.04, 0.2);
  },
  waterfall: (k) => {
    k.chain(0.45, k.loop("pink"), k.filter("highpass", 180), k.filter("lowpass", 7000));
    k.chain(0.35, k.loop("brown"));
  },
  fireplace: (k) => {
    k.chain(0.4, k.loop("brown"), k.filter("lowpass", 400));
    k.chain(0.35, k.loop("crackle"), k.filter("highpass", 900));
  },
  campfire: (k) => {
    k.chain(0.25, k.loop("brown"), k.filter("lowpass", 300));
    k.chain(0.45, k.loop("crackleBig"), k.filter("highpass", 700));
    windR(k, 0.12);
  },
  fan: (k) => {
    const f = k.filter("lowpass", 850, 0.6);
    const g = k.gain(0.55);
    k.loop("pink").connect(f);
    k.loop("brown").connect(f);
    f.connect(g).connect(k.out);
    k.lfo(g.gain, 7.5, 0.5, 0.56); // blade flutter
    k.chain(0.015, k.osc("sine", 116));
  },
  ac: (k) => {
    k.chain(0.4, k.loop("pink"), k.filter("highpass", 120), k.filter("lowpass", 1400));
    k.chain(0.012, k.osc("sine", 60));
    k.chain(0.008, k.osc("sine", 120));
  },
  wind: (k) => windR(k, 0.5),
  forest: (k) => {
    windR(k, 0.2);
    const f = k.filter("highpass", 3000);
    const g = k.gain(0.06);
    k.loop("white").connect(f).connect(g).connect(k.out);
    k.wander(g.gain, "ctrlB", 0.01, 0.07); // leaves
    k.chain(0.12, k.loop("birds"));
  },
  birds: (k) => {
    k.chain(0.35, k.loop("birds"));
    k.chain(0.04, k.loop("pink"), k.filter("lowpass", 900));
  },
  night: (k) => {
    k.chain(0.18, k.loop("crickets"));
    windR(k, 0.1);
    k.chain(0.06, k.loop("brown"), k.filter("lowpass", 300));
  },
  crickets: (k) => void k.chain(0.3, k.loop("crickets")),
  heartbeat: (k) => void k.chain(0.8, k.loop("heartbeat"), k.filter("lowpass", 160)),
  "ambient-noise": (k) => {
    const f = k.filter("lowpass", 900, 0.5);
    const g = k.gain(0.45);
    k.loop("brown").connect(f);
    k.loop("pink").connect(k.gain(0.25)).connect(f);
    f.connect(g).connect(k.out);
    k.wander(g.gain, "ctrlC", 0.3, 0.45);
  },
  ambient: (k) => pad(k, [130.81, 196, 246.94, 329.63], 0.22, 900),
  drone: (k) => pad(k, [55, 82.41, 110, 164.81], 0.3, 600),
  meditation: (k) => {
    pad(k, [98, 146.83, 196, 293.66], 0.16, 700);
    k.chain(0.22, k.loop("bells"), k.filter("lowpass", 3000));
  },
};

type Voice = { kit: Kit; gain: GainNode; level: number };

const FADE_IN = 1.2;
const FADE_OUT = 0.6;

export class SoundEngine {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private voices = new Map<string, Voice>();
  private buffers = new Map<string, { buf: AudioBuffer; users: number }>();
  private suspendTimer: ReturnType<typeof setTimeout> | null = null;
  private masterLevel = 1;

  /** Create (or wake) the audio context. Call from a click or tap. */
  async unlock() {
    if (!this.ctx) {
      const AC: typeof AudioContext | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) throw new Error("This browser can't play generated sound.");
      this.ctx = new AC({ latencyHint: "playback" });
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 3;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.masterLevel;
      this.master.connect(comp).connect(this.ctx.destination);
    }
    if (this.suspendTimer) clearTimeout(this.suspendTimer);
    if (this.ctx.state !== "running") await this.ctx.resume().catch(() => undefined);
    return this.ctx;
  }

  get running() {
    return this.ctx?.state === "running";
  }

  buffer(key: string) {
    const hit = this.buffers.get(key);
    if (hit) {
      hit.users++;
      return hit.buf;
    }
    const t = TEXTURES[key];
    if (!t || !this.ctx) throw new Error(`Unknown texture ${key}`);
    const make = (sr: number) => {
      const chans = t.render(sr);
      const b = this.ctx!.createBuffer(chans.length, chans[0]!.length, sr);
      chans.forEach((c, i) => b.getChannelData(i).set(c));
      return b;
    };
    let buf: AudioBuffer;
    try {
      buf = make(t.rate ?? this.ctx.sampleRate);
    } catch {
      // Some browsers (older Safari) only accept their usual sample rates.
      buf = make(this.ctx.sampleRate);
    }
    this.buffers.set(key, { buf, users: 1 });
    return buf;
  }

  release(key: string) {
    const hit = this.buffers.get(key);
    if (!hit) return;
    hit.users--;
    if (hit.users <= 0) this.buffers.delete(key); // let the memory go
  }

  /** Start a sound (or just change its volume if it's already playing). */
  set(soundId: string, volume: number) {
    if (!this.ctx || !this.master) return;
    const level = sliderToGain(volume);
    const now = this.ctx.currentTime;
    const v = this.voices.get(soundId);
    if (v) {
      v.level = level;
      v.gain.gain.cancelScheduledValues(now);
      v.gain.gain.setTargetAtTime(level, now, 0.08);
      return;
    }
    const recipe = RECIPES[soundId];
    if (!recipe) return;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(level, now + FADE_IN);
    gain.connect(this.master);
    const kit = new Kit(this.ctx, gain, this);
    recipe(kit);
    this.voices.set(soundId, { kit, gain, level });
  }

  /** Fade a sound out and free everything it used. */
  remove(soundId: string, fade = FADE_OUT) {
    const v = this.voices.get(soundId);
    if (!v || !this.ctx) return;
    this.voices.delete(soundId);
    const now = this.ctx.currentTime;
    v.gain.gain.cancelScheduledValues(now);
    v.gain.gain.setValueAtTime(v.gain.gain.value, now);
    v.gain.gain.linearRampToValueAtTime(0, now + fade);
    setTimeout(() => {
      v.kit.dispose();
      v.gain.disconnect();
      this.maybeSuspend();
    }, fade * 1000 + 80);
  }

  /** Make the running set of sounds match `items` exactly. */
  sync(items: { soundId: string; volume: number; muted?: boolean }[]) {
    const want = new Map(items.map((i) => [i.soundId, i.muted ? 0 : i.volume]));
    for (const id of [...this.voices.keys()]) if (!want.has(id)) this.remove(id);
    for (const [id, vol] of want) this.set(id, vol);
  }

  /** Overall volume (0–100) and mute. */
  setMaster(volume: number, muted: boolean) {
    this.masterLevel = muted ? 0 : sliderToGain(volume);
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.masterLevel, now, 0.05);
  }

  /** Gradually bring everything down to silence over `seconds`, then stop. */
  fadeOutAll(seconds: number, then?: () => void) {
    if (!this.ctx || !this.master) return then?.();
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0.0001, now + seconds);
    return setTimeout(() => {
      this.stopAll(0.05);
      then?.();
    }, seconds * 1000);
  }

  /** Cancel a fade that's under way (e.g. the person changed the timer). */
  cancelFade() {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.masterLevel, now, 0.1);
  }

  stopAll(fade = FADE_OUT) {
    for (const id of [...this.voices.keys()]) this.remove(id, fade);
    if (this.ctx && this.master) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.masterLevel, now + fade + 0.05);
    }
  }

  /** Pause without tearing anything down (instant resume). */
  async pause() {
    await this.ctx?.suspend().catch(() => undefined);
  }

  async resume() {
    await this.unlock();
  }

  get playingCount() {
    return this.voices.size;
  }

  /** Nothing playing for a while: let the audio hardware sleep (saves battery). */
  private maybeSuspend() {
    if (this.voices.size || !this.ctx) return;
    if (this.suspendTimer) clearTimeout(this.suspendTimer);
    this.suspendTimer = setTimeout(() => {
      if (!this.voices.size) void this.ctx?.suspend().catch(() => undefined);
    }, 1500);
  }
}

let engine: SoundEngine | null = null;
/** The one engine for the whole app. */
export const soundEngine = () => (engine ??= new SoundEngine());
