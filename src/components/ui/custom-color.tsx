"use client";

import { memberColor, onSolid, isHexColor, MEMBER_COLORS, type MemberColor } from "@/lib/colors";
import { themeScale } from "@/lib/theme";
import { cn } from "@/lib/utils";

const RAINBOW = "conic-gradient(from 0deg, #ff4d4d, #ffb84d, #fff04d, #6ee36e, #4dd2ff, #6b6bff, #d24dff, #ff4d4d)";

/**
 * "Custom" swatch: opens the device's colour wheel/gradient so any exact colour can be
 * chosen. Shows a rainbow until a custom colour is picked, then that colour.
 */
export function CustomColorSwatch({ value, onChange, size = "md" }: { value: string; onChange: (hex: string) => void; size?: "md" | "lg" }) {
  const custom = isHexColor(value);
  return (
    <label
      title="Custom colour"
      className={cn(
        "relative inline-flex cursor-pointer items-center gap-2 rounded-full border border-black/10 pr-3 text-sm font-medium ring-offset-2 ring-offset-surface",
        custom ? "ring-2 ring-ink" : "hover:ring-2 hover:ring-line-strong",
      )}
    >
      <span className={cn("rounded-full border border-black/10", size === "lg" ? "size-11" : "size-9")} style={{ background: custom ? value : RAINBOW }} aria-hidden />
      Custom
      <input
        type="color"
        aria-label="Choose a custom colour"
        value={custom ? value : "#6a2d5e"}
        onChange={(e) => onChange(e.target.value.toLowerCase())}
        onInput={(e) => onChange((e.target as HTMLInputElement).value.toLowerCase())}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      />
    </label>
  );
}

const solidOf = (value: string) => (isHexColor(value) ? value : value in MEMBER_COLORS ? MEMBER_COLORS[value as MemberColor].solid : null);

/** How a member colour will look once saved: avatar and a calendar chip. */
export function MemberColorPreview({ value, name = "A" }: { value: string; name?: string }) {
  if (!value) return null;
  const c = memberColor(value);
  return (
    <div className="flex items-center gap-3 text-sm" aria-label="Preview">
      <span className="text-muted">Preview</span>
      <span className="flex size-9 items-center justify-center rounded-full font-semibold" style={{ backgroundColor: c.solid, color: onSolid(value) }}>
        {name.slice(0, 1).toUpperCase()}
      </span>
      <span className="rounded-lg px-2.5 py-1 font-medium" style={{ backgroundColor: c.soft, color: c.ink, borderLeft: `4px solid ${c.solid}` }}>
        Calendar event
      </span>
    </div>
  );
}

/** How an app theme will look once saved: a button, a tab and a highlight. */
export function ThemePreview({ value }: { value: string }) {
  const solid = solidOf(value);
  if (!solid) return null;
  const s = themeScale(solid);
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm" aria-label="Preview">
      <span className="text-muted">Preview</span>
      <span className="rounded-[var(--radius-control)] px-4 py-2 font-semibold text-white" style={{ backgroundColor: s[600] }}>
        Button
      </span>
      <span className="rounded-full px-3 py-1 font-medium" style={{ backgroundColor: s[50], color: s[700] }}>
        Highlight
      </span>
      <span className="border-b-2 pb-0.5 font-medium" style={{ borderColor: s[500], color: s[700] }}>
        Tab
      </span>
    </div>
  );
}
