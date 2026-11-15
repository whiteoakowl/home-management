/**
 * Personal app colour theme. Each person can pick an accent colour for their own app;
 * it recolours buttons, highlights and tabs (the --color-primary-* tokens) only for them.
 * Member colours on avatars, the calendar and charts (chosen by parents) don't change.
 * Pure module (unit-tested in tests/theme.test.ts).
 */
import { contrastRatio, MEMBER_COLORS, type MemberColor } from "./colors";

const STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800] as const;
const LIGHTNESS: Record<(typeof STOPS)[number], number> = { 50: 96, 100: 92, 200: 85, 300: 75, 400: 64, 500: 52, 600: 42, 700: 33, 800: 22 };

function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number) {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** A primary scale (50…800) from one colour. 500+ are darkened until white text on them is readable. */
export function themeScale(hex: string): Record<(typeof STOPS)[number], string> {
  const [h, s0] = hexToHsl(hex);
  const out = {} as Record<(typeof STOPS)[number], string>;
  for (const stop of STOPS) {
    const s = Math.min(s0, stop <= 200 ? 60 : 75);
    let l = LIGHTNESS[stop];
    const need = stop === 500 ? 3 : stop === 600 ? 4.6 : stop >= 700 ? 7 : 0;
    let c = hslToHex(h, s, l);
    while (need && contrastRatio("#ffffff", c) < need && l > 5) c = hslToHex(h, s, (l -= 2));
    out[stop] = c;
  }
  return out;
}

export const THEME_KEYS = Object.keys(MEMBER_COLORS) as MemberColor[];

/** CSS variables that recolour the app for one person, or undefined for the default theme. */
export function themeStyle(key: string | null | undefined): Record<string, string> | undefined {
  if (!key || !(key in MEMBER_COLORS)) return undefined;
  const scale = themeScale(MEMBER_COLORS[key as MemberColor].solid);
  return Object.fromEntries(Object.entries(scale).map(([stop, v]) => [`--color-primary-${stop}`, v]));
}
