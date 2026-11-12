/**
 * Member colour palette, drawn from the Vanderbilt Family Home palette.
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
} as const;

export type MemberColor = keyof typeof MEMBER_COLORS;

export const MEMBER_COLOR_KEYS = Object.keys(MEMBER_COLORS) as MemberColor[];

/** Text colour to use on top of a member's solid colour. */
export function onSolid(key: string | null | undefined) {
  return key === "lilac" || key === "khaki" ? memberColor(key).ink : "#ffffff";
}

export function memberColor(key: string | null | undefined) {
  return MEMBER_COLORS[(key as MemberColor) ?? "plum"] ?? MEMBER_COLORS.plum;
}

/** Pick the next unused colour for a new member. */
export function nextMemberColor(used: string[]): MemberColor {
  return MEMBER_COLOR_KEYS.find((c) => !used.includes(c)) ?? MEMBER_COLOR_KEYS[used.length % MEMBER_COLOR_KEYS.length]!;
}
