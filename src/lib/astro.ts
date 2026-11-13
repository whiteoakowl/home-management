/**
 * Astronomy for the Witchcraft module. Pure, dependency-free and unit-tested.
 * Algorithms: Jean Meeus, "Astronomical Algorithms" (2nd ed.):
 *  - ch. 49 true lunar phases (accurate to ~1 minute),
 *  - ch. 47 (main terms) lunar longitude for the moon's zodiac sign (~0.3°),
 *  - ch. 27 equinoxes & solstices (accurate to ~1 minute).
 * Times are UTC; ΔT is approximated (≈69–75 s for 2000–2050).
 */
const RAD = Math.PI / 180;
const sin = (deg: number) => Math.sin(deg * RAD);
const cos = (deg: number) => Math.cos(deg * RAD);

const jdToDate = (jd: number) => new Date((jd - 2440587.5) * 86400000);
const dateToJd = (d: Date) => d.getTime() / 86400000 + 2440587.5;
/** Approximate ΔT (TT − UT) in days. */
const deltaT = (year: number) => {
  const t = year - 2000;
  return (62.92 + 0.32217 * t + 0.005589 * t * t) / 86400;
};

export type PrincipalPhase = "new" | "first_quarter" | "full" | "last_quarter";
const QUARTER: Record<PrincipalPhase, number> = { new: 0, first_quarter: 0.25, full: 0.5, last_quarter: 0.75 };

/** Moment of a principal phase for lunation k (k = 0 is the new moon of 2000-01-06). */
function phaseJde(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T,
    T3 = T2 * T,
    T4 = T3 * T;
  let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T2 - 0.00000015 * T3 + 0.00000000073 * T4;
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const M = 2.5534 + 29.1053567 * k - 0.0000014 * T2 - 0.00000011 * T3;
  const Mp = 201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4;
  const F = 160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4;
  const Om = 124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3;
  const frac = Math.round((k - Math.floor(k)) * 4) / 4;
  if (frac === 0 || frac === 0.5) {
    const n = frac === 0;
    jde +=
      (n ? -0.4072 : -0.40614) * sin(Mp) +
      (n ? 0.17241 : 0.17302) * E * sin(M) +
      (n ? 0.01608 : 0.01614) * sin(2 * Mp) +
      (n ? 0.01039 : 0.01043) * sin(2 * F) +
      (n ? 0.00739 : 0.00734) * E * sin(Mp - M) -
      (n ? 0.00514 : 0.00515) * E * sin(Mp + M) +
      (n ? 0.00208 : 0.00209) * E * E * sin(2 * M) -
      0.00111 * sin(Mp - 2 * F) -
      0.00057 * sin(Mp + 2 * F) +
      0.00056 * E * sin(2 * Mp + M) -
      0.00042 * sin(3 * Mp) +
      0.00042 * E * sin(M + 2 * F) +
      0.00038 * E * sin(M - 2 * F) -
      0.00024 * E * sin(2 * Mp - M) -
      0.00017 * sin(Om) -
      0.00007 * sin(Mp + 2 * M) +
      0.00004 * sin(2 * Mp - 2 * F) +
      0.00004 * sin(3 * M) +
      0.00003 * sin(Mp + M - 2 * F) +
      0.00003 * sin(2 * Mp + 2 * F) -
      0.00003 * sin(Mp + M + 2 * F) +
      0.00003 * sin(Mp - M + 2 * F) -
      0.00002 * sin(Mp - M - 2 * F) -
      0.00002 * sin(3 * Mp + M) +
      0.00002 * sin(4 * Mp);
  } else {
    jde +=
      -0.62801 * sin(Mp) +
      0.17172 * E * sin(M) -
      0.01183 * E * sin(Mp + M) +
      0.00862 * sin(2 * Mp) +
      0.00804 * sin(2 * F) +
      0.00454 * E * sin(Mp - M) +
      0.00204 * E * E * sin(2 * M) -
      0.0018 * sin(Mp - 2 * F) -
      0.0007 * sin(Mp + 2 * F) -
      0.0004 * sin(3 * Mp) -
      0.00034 * E * sin(2 * Mp - M) +
      0.00032 * E * sin(M + 2 * F) +
      0.00032 * E * sin(M - 2 * F) -
      0.00028 * E * E * sin(Mp + 2 * M) +
      0.00027 * E * sin(2 * Mp + M) -
      0.00017 * sin(Om);
    const W = 0.00306 - 0.00038 * E * cos(M) + 0.00026 * cos(Mp) - 0.00002 * cos(Mp - M) + 0.00002 * cos(Mp + M) + 0.00002 * cos(2 * F);
    jde += frac === 0.25 ? W : -W;
  }
  // Planetary arguments (Meeus table 49.B, largest terms).
  const A1 = 299.77 + 0.107408 * k - 0.009173 * T2;
  const A2 = 251.88 + 0.016321 * k;
  const A3 = 251.83 + 26.651886 * k;
  const A4 = 349.42 + 36.412478 * k;
  const A5 = 84.66 + 18.206239 * k;
  jde += 0.000325 * sin(A1) + 0.000165 * sin(A2) + 0.000164 * sin(A3) + 0.000126 * sin(A4) + 0.00011 * sin(A5);
  return jde;
}

export type PhaseEvent = { phase: PrincipalPhase; at: Date };

/** Principal phases (new, first quarter, full, last quarter) between two instants. */
export function phasesBetween(from: Date, to: Date): PhaseEvent[] {
  const year = from.getUTCFullYear() + from.getUTCMonth() / 12;
  let k = Math.floor((year - 2000) * 12.3685) - 1;
  const out: PhaseEvent[] = [];
  for (let guard = 0; guard < 2000; guard++, k++) {
    for (const phase of Object.keys(QUARTER) as PrincipalPhase[]) {
      const kk = k + QUARTER[phase];
      const at = jdToDate(phaseJde(kk) - deltaT(2000 + kk / 12.3685));
      if (at > to) return out.sort((a, b) => a.at.getTime() - b.at.getTime());
      if (at >= from) out.push({ phase, at });
    }
  }
  return out;
}

export const nextPhase = (phase: PrincipalPhase, from: Date) => phasesBetween(from, new Date(from.getTime() + 32 * 86400000)).find((e) => e.phase === phase)!;

export type PhaseName = "new_moon" | "waxing_crescent" | "first_quarter" | "waxing_gibbous" | "full_moon" | "waning_gibbous" | "last_quarter" | "waning_crescent";

export const PHASE_LABEL: Record<PhaseName, string> = {
  new_moon: "New Moon",
  waxing_crescent: "Waxing Crescent",
  first_quarter: "First Quarter",
  waxing_gibbous: "Waxing Gibbous",
  full_moon: "Full Moon",
  waning_gibbous: "Waning Gibbous",
  last_quarter: "Last Quarter",
  waning_crescent: "Waning Crescent",
};
export const PHASE_EMOJI: Record<PhaseName, string> = {
  new_moon: "🌑",
  waxing_crescent: "🌒",
  first_quarter: "🌓",
  waxing_gibbous: "🌔",
  full_moon: "🌕",
  waning_gibbous: "🌖",
  last_quarter: "🌗",
  waning_crescent: "🌘",
};

const SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"] as const;
export type ZodiacSign = (typeof SIGNS)[number];

/** Geocentric ecliptic longitude of the moon (degrees, tropical), Meeus ch. 47 main terms. */
export function moonLongitude(at: Date) {
  const T = (dateToJd(at) + deltaT(at.getUTCFullYear()) - 2451545) / 36525;
  const Lp = 218.3164477 + 481267.88123421 * T;
  const D = 297.8501921 + 445267.1114034 * T;
  const M = 357.5291092 + 35999.0502909 * T;
  const Mp = 134.9633964 + 477198.8675055 * T;
  const F = 93.272095 + 483202.0175233 * T;
  const lon =
    Lp +
    6.288774 * sin(Mp) +
    1.274027 * sin(2 * D - Mp) +
    0.658314 * sin(2 * D) +
    0.213618 * sin(2 * Mp) -
    0.185116 * sin(M) -
    0.114332 * sin(2 * F) +
    0.058793 * sin(2 * D - 2 * Mp) +
    0.057066 * sin(2 * D - M - Mp) +
    0.053322 * sin(2 * D + Mp) +
    0.045758 * sin(2 * D - M) -
    0.040923 * sin(M - Mp) -
    0.03472 * sin(D) -
    0.030383 * sin(M + Mp);
  return ((lon % 360) + 360) % 360;
}

export const moonSign = (at: Date): ZodiacSign => SIGNS[Math.floor(moonLongitude(at) / 30)]!;

export type MoonInfo = {
  phase: PhaseName;
  label: string;
  emoji: string;
  /** 0..1 illuminated fraction. */
  illumination: number;
  /** Days since the last new moon. */
  age: number;
  waxing: boolean;
  sign: ZodiacSign;
  /** The principal phase that occurs on this local date, if any (with its exact time). */
  exact?: PhaseEvent;
};

/**
 * Moon for a local calendar date (evaluated at local noon). Principal phases
 * are named only on the local date they occur; other days get the
 * intermediate name (waxing crescent etc.).
 */
export function moonForDate(isoDate: string, tzOffsetMinutes = 0): MoonInfo {
  const noon = new Date(Date.parse(`${isoDate}T12:00:00Z`) - tzOffsetMinutes * 60000);
  const dayStart = new Date(Date.parse(`${isoDate}T00:00:00Z`) - tzOffsetMinutes * 60000);
  const dayEnd = new Date(dayStart.getTime() + 86400000);
  const around = phasesBetween(new Date(noon.getTime() - 32 * 86400000), new Date(noon.getTime() + 32 * 86400000));
  const exact = around.find((e) => e.at >= dayStart && e.at < dayEnd);
  const prevNew = [...around].reverse().find((e) => e.phase === "new" && e.at <= noon)!;
  const nextNew = around.find((e) => e.phase === "new" && e.at > noon)!;
  const frac = (noon.getTime() - prevNew.at.getTime()) / (nextNew.at.getTime() - prevNew.at.getTime());
  const age = (noon.getTime() - prevNew.at.getTime()) / 86400000;
  const waxing = frac < 0.5;
  let phase: PhaseName;
  if (exact) phase = ({ new: "new_moon", first_quarter: "first_quarter", full: "full_moon", last_quarter: "last_quarter" } as const)[exact.phase];
  else {
    const prev = [...around].reverse().find((e) => e.at <= noon)!;
    phase = ({ new: "waxing_crescent", first_quarter: "waxing_gibbous", full: "waning_gibbous", last_quarter: "waning_crescent" } as const)[prev.phase];
  }
  return {
    phase,
    label: PHASE_LABEL[phase],
    emoji: PHASE_EMOJI[phase],
    illumination: (1 - Math.cos(2 * Math.PI * frac)) / 2,
    age,
    waxing,
    sign: moonSign(noon),
    exact,
  };
}

// ─── Equinoxes & solstices ───────────────────────────────────────────────────

export type SeasonEvent = "march_equinox" | "june_solstice" | "september_equinox" | "december_solstice";

const PERIODIC: [number, number, number][] = [
  [485, 324.96, 1934.136], [203, 337.23, 32964.467], [199, 342.08, 20.186], [182, 27.85, 445267.112],
  [156, 73.14, 45036.886], [136, 171.52, 22518.443], [77, 222.54, 65928.934], [74, 296.72, 3034.906],
  [70, 243.58, 9037.513], [58, 119.81, 33718.147], [52, 297.17, 150.678], [50, 21.02, 2281.226],
  [45, 247.54, 29929.562], [44, 325.15, 31555.956], [29, 60.93, 4443.417], [18, 155.12, 67555.328],
  [17, 288.79, 4562.452], [16, 198.04, 62894.029], [14, 199.76, 31436.921], [12, 95.39, 14577.848],
  [12, 287.11, 31931.756], [12, 320.81, 34777.259], [9, 227.73, 1222.114], [8, 15.45, 16859.074],
];

/** UTC instant of an equinox or solstice (years 1000–3000). */
export function seasonEvent(year: number, event: SeasonEvent): Date {
  const Y = (year - 2000) / 1000;
  const Y2 = Y * Y,
    Y3 = Y2 * Y,
    Y4 = Y3 * Y;
  const jde0 = {
    march_equinox: 2451623.80984 + 365242.37404 * Y + 0.05169 * Y2 - 0.00411 * Y3 - 0.00057 * Y4,
    june_solstice: 2451716.56767 + 365241.62603 * Y + 0.00325 * Y2 + 0.00888 * Y3 - 0.0003 * Y4,
    september_equinox: 2451810.21715 + 365242.01767 * Y - 0.11575 * Y2 + 0.00337 * Y3 + 0.00078 * Y4,
    december_solstice: 2451900.05952 + 365242.74049 * Y - 0.06223 * Y2 - 0.00823 * Y3 + 0.00032 * Y4,
  }[event];
  const T = (jde0 - 2451545) / 36525;
  const W = 35999.373 * T - 2.47;
  const dl = 1 + 0.0334 * cos(W) + 0.0007 * cos(2 * W);
  const S = PERIODIC.reduce((s, [A, B, C]) => s + A * cos(B + C * T), 0);
  return jdToDate(jde0 + (0.00001 * S) / dl - deltaT(year));
}
