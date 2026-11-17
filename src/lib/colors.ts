/**
 * Member colour palette, drawn from the Vanderbilt Family palette.
 * Used consistently on avatars, events, chores and reports.
 */
export const MEMBER_COLORS = {
  plum: { label: "Plum", solid: "#6a2d5e", soft: "#f0dfec", ink: "#2d0f26" },
  orchid: { label: "Orchid", solid: "#8e4e7b", soft: "#f3e3ef", ink: "#4a1f40" },
  lilac: { label: "Lilac", solid: "#c991c4", soft: "#f6e8f4", ink: "#5e2e59" },
  wine: { label: "Wine", solid: "#7a2e44", soft: "#f3e1e6", ink: "#4d1c2b" },
  mauve: { label: "Mauve", solid: "#a2748f", soft: "#f2e8ee", ink: "#4f3044" },
  olive: { label: "Olive", solid: "#6d6a3c", soft: "#ecebdc", ink: "#3f3f1e" },
  khaki: { label: "Khaki", solid: "#9c9772", soft: "#f1efe3", ink: "#4a4728" },
  slate: { label: "Slate", solid: "#7d7586", soft: "#ecebef", ink: "#3a3442" },
  lemon: { label: "Lemon", solid: "#fff689", soft: "#fffde2", ink: "#595630" },
  sunflower: { label: "Sunflower", solid: "#f4d35e", soft: "#fcf4d7", ink: "#554a21" },
  peach: { label: "Peach", solid: "#ffb88a", soft: "#ffede2", ink: "#664a37" },
  apricot: { label: "Apricot", solid: "#ff9c5b", soft: "#ffe6d6", ink: "#663e24" },
  tangerine: { label: "Tangerine", solid: "#f67b45", soft: "#fdded0", ink: "#6f371f" },
  blush: { label: "Blush", solid: "#fbc2c2", soft: "#fef0f0", ink: "#584444" },
  rose: { label: "Rose", solid: "#e39b99", soft: "#f8e6e6", ink: "#5b3e3d" },
  clay: { label: "Clay", solid: "#cb7876", soft: "#f2dddd", ink: "#663c3b" },
  sage: { label: "Sage", solid: "#b4cfa4", soft: "#ecf3e8", ink: "#485342" },
  fern: { label: "Fern", solid: "#8ba47c", soft: "#e2e8de", ink: "#3f4a38" },
  pine: { label: "Pine", solid: "#62866c", soft: "#d8e1da", ink: "#314336" },
  sky: { label: "Sky", solid: "#a0c5e3", soft: "#e7f0f8", ink: "#404f5b" },
  cornflower: { label: "Cornflower", solid: "#81b2d9", soft: "#e0ecf6", ink: "#344757" },
  ocean: { label: "Ocean", solid: "#32769b", soft: "#ccdde6", ink: "#193b4e" },
  lavender: { label: "Lavender", solid: "#bba6dd", soft: "#eee9f6", ink: "#4b4258" },
  heather: { label: "Heather", solid: "#8c7da8", soft: "#e2dee9", ink: "#463e54" },
  dusk: { label: "Dusk", solid: "#64557b", soft: "#d8d4de", ink: "#322a3e" },
  midnight: { label: "Midnight", solid: "#1e2136", soft: "#c7c8cd", ink: "#0f101b" },
} as const;

export type MemberColor = keyof typeof MEMBER_COLORS;

export const MEMBER_COLOR_KEYS = Object.keys(MEMBER_COLORS) as MemberColor[];

/** WCAG contrast ratio between two hex colours. */
export function contrastRatio(a: string, b: string) {
  const lum = (hex: string) => {
    const [r, g, b2] = [1, 3, 5].map((i) => {
      const v = parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b2;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/** Text colour to use on top of a member's solid colour: white when it's readable, else the colour's dark ink. */
export function onSolid(key: string | null | undefined) {
  const c = memberColor(key);
  return contrastRatio("#ffffff", c.solid) >= 3 ? "#ffffff" : c.ink;
}

// ─── Custom colours ("#rrggbb", chosen on the colour wheel) ─────────────────

export const isHexColor = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
/** A palette name or an exact "#rrggbb" colour. */
export const isMemberColor = (v: unknown): v is string => isHexColor(v) || (typeof v === "string" && v in MEMBER_COLORS);
/** Normalise a submitted colour: palette key as-is, hex lowercased; anything else → null. */
export const cleanColor = (v: unknown) => (isHexColor(v) ? v.toLowerCase() : isMemberColor(v) ? (v as string) : null);

export function hexToHsl(hex: string): [number, number, number] {
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

export function hslToHex(h: number, s: number, l: number) {
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

/** Solid / soft / ink for a palette key or an exact "#rrggbb" colour. */
export function memberColor(key: string | null | undefined): { label: string; solid: string; soft: string; ink: string } {
  if (typeof key === "string" && /^#[0-9a-f]{6}$/i.test(key)) {
    const [h, s] = hexToHsl(key);
    return { label: "Custom", solid: key.toLowerCase(), soft: hslToHex(h, Math.min(s, 60), 94), ink: hslToHex(h, Math.min(s, 60), 20) };
  }
  return MEMBER_COLORS[(key as MemberColor) ?? "plum"] ?? MEMBER_COLORS.plum;
}

/** Pick the next unused colour for a new member. */
export function nextMemberColor(used: string[]): MemberColor {
  return MEMBER_COLOR_KEYS.find((c) => !used.includes(c)) ?? MEMBER_COLOR_KEYS[used.length % MEMBER_COLOR_KEYS.length]!;
}
