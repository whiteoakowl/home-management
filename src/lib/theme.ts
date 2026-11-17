/**
 * Personal app colour theme. Each person can pick an accent colour for their own app;
 * it recolours buttons, highlights and tabs (the --color-primary-* tokens) only for them.
 * Member colours on avatars, the calendar and charts (chosen by parents) don't change.
 * Pure module (unit-tested in tests/theme.test.ts).
 */
import { contrastRatio, hexToHsl, hslToHex, isHexColor, MEMBER_COLORS, type MemberColor } from "./colors";

const STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800] as const;
const LIGHTNESS: Record<(typeof STOPS)[number], number> = { 50: 96, 100: 92, 200: 85, 300: 75, 400: 64, 500: 52, 600: 42, 700: 33, 800: 22 };

/** How much each stop follows the chosen colour's own lightness (500/600 fully). */
const FOLLOW: Record<(typeof STOPS)[number], number> = { 50: 0, 100: 0, 200: 0.2, 300: 0.5, 400: 0.8, 500: 1, 600: 1, 700: 0.6, 800: 0.3 };

/**
 * A primary scale (50…800) from one colour, kept as close to that colour as
 * readability allows: its hue and saturation are kept, the middle stops follow its
 * lightness, and if white text is readable on it, buttons (600) use it exactly.
 * 500+ are only darkened as far as needed for readable white text.
 */
export function themeScale(hex: string): Record<(typeof STOPS)[number], string> {
  const [h, s0, l0] = hexToHsl(hex);
  const delta = Math.min(60, Math.max(30, l0)) - 47;
  const out = {} as Record<(typeof STOPS)[number], string>;
  for (const stop of STOPS) {
    const s = Math.min(s0, stop <= 200 ? 70 : 95);
    let l = LIGHTNESS[stop] + delta * FOLLOW[stop];
    const need = stop === 500 ? 3 : stop === 600 ? 4.6 : stop >= 700 ? 7 : 0;
    let c = hslToHex(h, s, l);
    while (need && contrastRatio("#ffffff", c) < need && l > 5) c = hslToHex(h, s, (l -= 2));
    out[stop] = c;
  }
  if (contrastRatio("#ffffff", hex) >= 4.6) out[600] = hex.toLowerCase();
  return out;
}

export const THEME_KEYS = Object.keys(MEMBER_COLORS) as MemberColor[];

/** CSS variables that recolour the app for one person, or undefined for the default theme. */
export function themeStyle(key: string | null | undefined): Record<string, string> | undefined {
  if (!key || !(isHexColor(key) || key in MEMBER_COLORS)) return undefined;
  const scale = themeScale(isHexColor(key) ? key : MEMBER_COLORS[key as MemberColor].solid);
  return Object.fromEntries(Object.entries(scale).map(([stop, v]) => [`--color-primary-${stop}`, v]));
}
