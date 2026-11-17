/**
 * Pool & spa water chemistry (pure, unit-tested in tests/pool.test.ts).
 *
 * - Ideal / acceptable ranges per reading, by sanitizer and surface
 * - Free-chlorine targets that scale with stabilizer (CYA)
 * - "What to add" doses for the pool's volume
 * - Langelier Saturation Index (water balance: corrosive / balanced / scaling)
 *
 * Doses use standard chemistry (1 ppm in 10,000 gal = 37.85 g of the active
 * ingredient). Acid and base amounts are estimates because they depend on
 * alkalinity; the app always says to add part, circulate and retest.
 */

export type Sanitizer = "chlorine" | "salt" | "bromine";
export type BodyKind = "pool" | "spa";
export type Surface = "plaster" | "vinyl" | "fiberglass";
export type ChlorineProduct = "liquid10" | "liquid12" | "calhypo65" | "calhypo73" | "dichlor" | "trichlor";

export type PoolProfile = { kind: BodyKind; gallons: number; sanitizer: Sanitizer; surface: Surface; chlorineProduct: ChlorineProduct; saltTarget?: number | null };

export type Reading = {
  fc?: number | null;
  cc?: number | null;
  ph?: number | null;
  ta?: number | null;
  ch?: number | null;
  cya?: number | null;
  salt?: number | null;
  tempF?: number | null;
  phosphates?: number | null;
};

export type ReadingKey = keyof Reading;
export type Status = "low" | "watch-low" | "ok" | "watch-high" | "high";

export const READING_META: Record<ReadingKey, { label: string; short: string; unit: string; step: number }> = {
  fc: { label: "Free chlorine", short: "FC", unit: "ppm", step: 0.5 },
  cc: { label: "Combined chlorine", short: "CC", unit: "ppm", step: 0.1 },
  ph: { label: "pH", short: "pH", unit: "", step: 0.1 },
  ta: { label: "Total alkalinity", short: "TA", unit: "ppm", step: 10 },
  ch: { label: "Calcium hardness", short: "CH", unit: "ppm", step: 25 },
  cya: { label: "Stabilizer (CYA)", short: "CYA", unit: "ppm", step: 10 },
  salt: { label: "Salt", short: "Salt", unit: "ppm", step: 100 },
  tempF: { label: "Water temperature", short: "Temp", unit: "°F", step: 1 },
  phosphates: { label: "Phosphates", short: "Phos", unit: "ppb", step: 100 },
};

export const CHLORINE_PRODUCTS: Record<ChlorineProduct, { label: string; gramsPerPpm10k: number; liquid: boolean; cyaPerPpm?: number; note?: string }> = {
  liquid10: { label: "Liquid chlorine / bleach 10%", gramsPerPpm10k: 378.5, liquid: true },
  liquid12: { label: "Liquid chlorine 12.5%", gramsPerPpm10k: 302.8, liquid: true },
  calhypo65: { label: "Cal-hypo shock 65%", gramsPerPpm10k: 58.2, liquid: false, note: "Also raises calcium hardness about 0.8 ppm per 1 ppm of chlorine." },
  calhypo73: { label: "Cal-hypo shock 73%", gramsPerPpm10k: 51.8, liquid: false, note: "Also raises calcium hardness about 0.8 ppm per 1 ppm of chlorine." },
  dichlor: { label: "Dichlor granules 56%", gramsPerPpm10k: 67.6, liquid: false, cyaPerPpm: 0.9, note: "Also raises stabilizer (CYA) about 0.9 ppm per 1 ppm of chlorine." },
  trichlor: { label: "Trichlor 90%", gramsPerPpm10k: 42.1, liquid: false, cyaPerPpm: 0.6, note: "Also raises stabilizer (CYA) about 0.6 ppm per 1 ppm and lowers pH." },
};

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Free-chlorine levels for the current stabilizer: minimum, target and shock (SLAM-style). */
export function chlorineTargets(p: PoolProfile, cya: number | null | undefined) {
  if (p.sanitizer === "bromine") return { min: 3, target: 4, max: 6, shock: 10 };
  const c = Math.max(0, cya ?? 0);
  if (c < 10) return p.kind === "spa" ? { min: 3, target: 4, max: 5, shock: 10 } : { min: 1, target: 2, max: 4, shock: 10 };
  const salt = p.sanitizer === "salt";
  const min = r1(Math.max(1, c * (salt ? 0.045 : 0.075)));
  const target = r1(Math.max(min + 0.5, c * (salt ? 0.065 : 0.115)));
  return { min, target, max: r1(Math.max(target + 2, c * 0.2)), shock: r1(Math.max(10, c * 0.4)) };
}

type Range = { ideal: [number, number]; ok: [number, number]; target: number } | null;

/** Ideal and acceptable range per reading for this pool (null = informational only). */
export function rangeFor(p: PoolProfile, key: ReadingKey, reading: Reading = {}): Range {
  const spa = p.kind === "spa";
  switch (key) {
    case "fc": {
      const t = chlorineTargets(p, reading.cya);
      return { ideal: [t.min, t.max], ok: [t.min, t.shock], target: t.target };
    }
    case "cc":
      return { ideal: [0, 0.2], ok: [0, 0.5], target: 0 };
    case "ph":
      return { ideal: [7.4, 7.6], ok: [7.2, 7.8], target: 7.5 };
    case "ta":
      if (p.sanitizer === "salt") return { ideal: [60, 80], ok: [50, 100], target: 70 };
      if (p.sanitizer === "bromine" || spa) return { ideal: [80, 100], ok: [60, 120], target: 90 };
      return { ideal: [70, 100], ok: [60, 120], target: 80 };
    case "ch":
      if (spa) return { ideal: [150, 250], ok: [100, 350], target: 200 };
      if (p.surface === "plaster") return { ideal: [250, 450], ok: [200, 600], target: 350 };
      return { ideal: [150, 250], ok: [100, 400], target: 200 };
    case "cya":
      if (p.sanitizer === "bromine") return { ideal: [0, 0], ok: [0, 30], target: 0 };
      if (spa) return { ideal: [20, 40], ok: [0, 50], target: 30 };
      if (p.sanitizer === "salt") return { ideal: [60, 80], ok: [50, 90], target: 70 };
      return { ideal: [30, 50], ok: [20, 90], target: 40 };
    case "salt": {
      if (p.sanitizer !== "salt") return null;
      const t = p.saltTarget ?? 3200;
      return { ideal: [t - 300, t + 300], ok: [t - 600, t + 800], target: t };
    }
    case "phosphates":
      return { ideal: [0, 300], ok: [0, 1000], target: 0 };
    case "tempF":
      return null;
  }
}

export function statusOf(p: PoolProfile, key: ReadingKey, reading: Reading): Status | null {
  const v = reading[key];
  const r = rangeFor(p, key, reading);
  if (v === null || v === undefined || !r) return null;
  if (v < r.ok[0]) return "low";
  if (v > r.ok[1]) return "high";
  if (v < r.ideal[0]) return "watch-low";
  if (v > r.ideal[1]) return "watch-high";
  return "ok";
}

// ─── Water balance (Langelier Saturation Index) ─────────────────────────────

const TEMP_FACTOR: [number, number][] = [
  [32, 0], [37, 0.1], [46, 0.2], [53, 0.3], [60, 0.4], [66, 0.5], [76, 0.6], [84, 0.7], [94, 0.8], [105, 0.9], [128, 1.0],
];

function tempFactor(f: number) {
  if (f <= TEMP_FACTOR[0]![0]) return 0;
  for (let i = 1; i < TEMP_FACTOR.length; i++) {
    const [t1, v1] = TEMP_FACTOR[i]!;
    const [t0, v0] = TEMP_FACTOR[i - 1]!;
    if (f <= t1) return v0 + ((f - t0) / (t1 - t0)) * (v1 - v0);
  }
  return 1.0;
}

/** LSI from pH, temperature, calcium, alkalinity (corrected for stabilizer) and salt. Null if anything is missing. */
export function lsi(p: PoolProfile, r: Reading) {
  if (r.ph == null || r.ch == null || r.ta == null) return null;
  const temp = r.tempF ?? (p.kind === "spa" ? 102 : 80);
  const carbAlk = r.ta - (r.cya ?? 0) / 3;
  if (r.ch <= 0 || carbAlk <= 0) return null;
  const tds = p.sanitizer === "salt" ? (r.salt ?? 3200) + 300 : 1000;
  const value = r.ph + tempFactor(temp) + (Math.log10(r.ch) - 0.4) + Math.log10(carbAlk) - (tds >= 1000 ? 12.2 : 12.1);
  const v = Math.round(value * 100) / 100;
  return { value: v, verdict: v < -0.3 ? ("corrosive" as const) : v > 0.3 ? ("scaling" as const) : ("balanced" as const), estimatedTemp: r.tempF == null };
}

// ─── What to add ──────────────────────────────────────────────────────────────

export type Advice = { key: ReadingKey; severity: "act" | "watch"; title: string; product?: string; amount?: string; note?: string };

const G_PER_OZ = 28.3495;
const ML_PER_FLOZ = 29.5735;

/** "12 fl oz", "1.5 gal", "6 oz", "2.3 lb": friendly amounts. */
export function formatAmount(value: number, kind: "floz" | "oz"): string {
  if (!(value > 0)) return "0";
  if (kind === "floz") return value >= 127.5 ? `${r1(value / 128)} gal` : `${Math.max(1, Math.round(value))} fl oz`;
  return value >= 16 ? `${r1(value / 16)} lb` : `${Math.max(1, Math.round(value))} oz`;
}

/** Chlorine product amount to raise free chlorine by `ppm`. */
export function chlorineDose(p: PoolProfile, ppm: number) {
  const prod = CHLORINE_PRODUCTS[p.chlorineProduct];
  const grams = prod.gramsPerPpm10k * ppm * (p.gallons / 10000);
  return { product: prod.label, amount: prod.liquid ? formatAmount(grams / ML_PER_FLOZ, "floz") : formatAmount(grams / G_PER_OZ, "oz"), note: prod.note };
}

/** Step-by-step suggestions for a test, most important first. */
export function adviceFor(p: PoolProfile, r: Reading): Advice[] {
  const out: Advice[] = [];
  const f = p.gallons / 10000;
  const range = (k: ReadingKey) => rangeFor(p, k, r)!;
  const st = (k: ReadingKey) => statusOf(p, k, r);
  const t = chlorineTargets(p, r.cya);

  // Sanitizer first.
  if (r.cc != null && r.cc > 0.5 && p.sanitizer !== "bromine") {
    const ppm = Math.max(0, t.shock - (r.fc ?? 0));
    out.push({ key: "cc", severity: "act", title: `Shock: combined chlorine is ${r.cc} ppm. Raise free chlorine to ${t.shock} ppm and hold it until CC is 0.5 or less.`, ...(ppm > 0 ? chlorineDose(p, ppm) : {}) });
  } else if (r.fc != null && (st("fc") === "low" || st("fc") === "watch-low" || r.fc < t.min)) {
    const ppm = r1(t.target - r.fc);
    if (p.sanitizer === "bromine") out.push({ key: "fc", severity: "act", title: `Bromine is low (${r.fc} ppm). Raise it to about ${t.target} ppm: refill the floater/feeder or turn it up, and shock with non-chlorine (MPS) shock per the label.` });
    else if (ppm > 0) {
      const salt = p.sanitizer === "salt";
      out.push({ key: "fc", severity: "act", title: `Free chlorine is low (${r.fc} ppm). Raise it to about ${t.target} ppm.${salt ? " Turn up your salt cell output, or add a one-time boost:" : ""}`, ...chlorineDose(p, ppm) });
    }
  } else if (r.fc != null && r.fc > t.shock) out.push({ key: "fc", severity: "watch", title: `Free chlorine is very high (${r.fc} ppm). Wait for it to drop below ${t.max} ppm before swimming; leave the cover off in the sun.` });

  // pH (balance alkalinity first if it's far off).
  const taFarLow = r.ta != null && r.ta < range("ta").ok[0];
  if (r.ph != null && (st("ph") === "low" || st("ph") === "watch-low")) {
    const delta = 7.5 - r.ph;
    if (taFarLow) out.push({ key: "ph", severity: "act", title: `pH is low (${r.ph}). Raise alkalinity first (below); baking soda will lift pH too.` });
    else out.push({ key: "ph", severity: st("ph") === "low" ? "act" : "watch", title: `pH is low (${r.ph}). Raise it toward 7.5.`, product: "Soda ash (sodium carbonate)", amount: formatAmount((delta / 0.2) * 6 * f, "oz"), note: "Estimate: add about half, circulate 4 hours and retest." });
  } else if (r.ph != null && (st("ph") === "high" || st("ph") === "watch-high")) {
    const delta = r.ph - 7.5;
    const ta = r.ta ?? 90;
    out.push({ key: "ph", severity: st("ph") === "high" ? "act" : "watch", title: `pH is high (${r.ph}). Lower it toward 7.5.`, product: "Muriatic acid 31.45%", amount: formatAmount((delta / 0.2) * 12 * f * (ta / 100), "floz"), note: "Estimate. Pour slowly in front of a return with the pump running; retest after 4 hours. Use the equivalent dry acid per its label if you prefer." });
  }

  // Alkalinity.
  if (r.ta != null && (st("ta") === "low" || st("ta") === "watch-low")) {
    const target = range("ta").target;
    out.push({ key: "ta", severity: st("ta") === "low" ? "act" : "watch", title: `Alkalinity is low (${r.ta} ppm). Raise it to about ${target} ppm.`, product: "Baking soda (sodium bicarbonate)", amount: formatAmount(((target - r.ta) / 10) * 1.4 * f * 16, "oz"), note: "Add in a few doses an hour apart; it also raises pH slightly." });
  } else if (r.ta != null && st("ta") === "high") {
    const target = range("ta").target;
    out.push({ key: "ta", severity: "watch", title: `Alkalinity is high (${r.ta} ppm). Lower it slowly toward ${target} ppm.`, product: "Muriatic acid 31.45%", amount: formatAmount(((r.ta - target) / 10) * 26 * f, "floz"), note: "Total over several days: lower pH to 7.0–7.2 with acid, then aerate (fountains, jets) to bring pH back up. Repeat." });
  }

  // Calcium.
  if (r.ch != null && (st("ch") === "low" || st("ch") === "watch-low")) {
    const target = range("ch").target;
    out.push({ key: "ch", severity: st("ch") === "low" ? "act" : "watch", title: `Calcium hardness is low (${r.ch} ppm). Raise it to about ${target} ppm.`, product: "Calcium chloride 77%", amount: formatAmount(((target - r.ch) / 10) * 1.25 * f * 16, "oz"), note: "Pre-dissolve in a bucket of pool water; it gets hot." });
  } else if (r.ch != null && st("ch") === "high") {
    out.push({ key: "ch", severity: "watch", title: `Calcium hardness is high (${r.ch} ppm). Replace about ${Math.round((1 - range("ch").target / r.ch) * 100)}% of the water, or keep pH on the low side (7.2–7.4) to avoid scale.` });
  }

  // Stabilizer.
  if (p.sanitizer !== "bromine" && r.cya != null && (st("cya") === "low" || st("cya") === "watch-low")) {
    const target = range("cya").target;
    out.push({ key: "cya", severity: st("cya") === "low" ? "act" : "watch", title: `Stabilizer is low (${r.cya} ppm). Raise it to about ${target} ppm to protect chlorine from the sun.`, product: "Stabilizer (cyanuric acid)", amount: formatAmount(((target - r.cya) / 10) * 13 * f, "oz"), note: "Dissolves slowly: put it in a sock in the skimmer or a bucket. Retest after a week." });
  } else if (r.cya != null && st("cya") === "high") {
    const target = range("cya").target;
    out.push({ key: "cya", severity: "act", title: `Stabilizer is high (${r.cya} ppm). Replace about ${Math.round((1 - target / r.cya) * 100)}% of the water. Until then keep free chlorine at ${chlorineTargets(p, r.cya).target}+ ppm.` });
  }

  // Salt.
  if (p.sanitizer === "salt" && r.salt != null && (st("salt") === "low" || st("salt") === "watch-low")) {
    const target = range("salt").target;
    out.push({ key: "salt", severity: st("salt") === "low" ? "act" : "watch", title: `Salt is low (${r.salt} ppm). Raise it to about ${target} ppm.`, product: "Pool salt", amount: formatAmount(((target - r.salt) / 100) * 8.34 * f * 16, "oz"), note: "Brush it toward the main drain to dissolve; run the pump 24 hours before turning the cell back on." });
  } else if (p.sanitizer === "salt" && r.salt != null && st("salt") === "high") {
    out.push({ key: "salt", severity: "watch", title: `Salt is high (${r.salt} ppm). Replace about ${Math.round((1 - range("salt").target / r.salt) * 100)}% of the water.` });
  }

  if (r.phosphates != null && (st("phosphates") === "high" || st("phosphates") === "watch-high")) {
    out.push({ key: "phosphates", severity: "watch", title: `Phosphates are ${r.phosphates} ppb. Keeping chlorine in range prevents algae; a phosphate remover (per the label) can help.` });
  }
  return out;
}

/** Recommended routine for a pool or spa (used to set up chores). */
export function suggestedRoutine(kind: BodyKind, sanitizer: Sanitizer) {
  const spa = kind === "spa";
  return [
    { title: spa ? "Test the spa water" : "Test the pool water", freq: "weekly" as const, byWeekday: [1, 4], points: 5, minutes: 10, instructions: "Test free chlorine and pH (plus TA, CH, CYA weekly) and log it in Pool." },
    ...(spa
      ? [
          { title: "Rinse the spa filter", freq: "weekly" as const, byWeekday: [6], points: 5, minutes: 15, instructions: "Hose the cartridge from top to bottom." },
          { title: "Drain and refill the spa", freq: "monthly" as const, byWeekday: null, points: 20, minutes: 90, instructions: "Every 3–4 months depending on use. Clean the shell and the cover." },
        ]
      : [
          { title: "Skim the pool and empty the skimmer baskets", freq: "daily" as const, byWeekday: null, points: 3, minutes: 10, instructions: "Also check the pump basket." },
          { title: "Brush the pool walls, steps and floor", freq: "weekly" as const, byWeekday: [6], points: 10, minutes: 20, instructions: "Brush toward the main drain." },
          { title: "Vacuum the pool", freq: "weekly" as const, byWeekday: [6], points: 10, minutes: 30, instructions: "Or empty the robot cleaner's bag." },
          { title: "Clean or backwash the filter", freq: "monthly" as const, byWeekday: null, points: 15, minutes: 30, instructions: "When pressure is 8–10 psi above clean. Cartridge: hose off; sand/DE: backwash." },
        ]),
    ...(sanitizer === "salt" ? [{ title: "Inspect the salt cell for scale", freq: "monthly" as const, byWeekday: null, points: 10, minutes: 15, instructions: "Clean with a mild acid solution only if there's scale." }] : []),
  ];
}
