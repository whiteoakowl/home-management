import type { MoonInfo, PhaseEvent } from "@/lib/astro";
import { PHASE_EMOJI } from "@/lib/astro";
import { cn } from "@/lib/utils";

const PRINCIPAL = { new: "New Moon", first_quarter: "First Quarter", full: "Full Moon", last_quarter: "Last Quarter" } as const;
const PE = { new: PHASE_EMOJI.new_moon, first_quarter: PHASE_EMOJI.first_quarter, full: PHASE_EMOJI.full_moon, last_quarter: PHASE_EMOJI.last_quarter } as const;

/** Lit disc drawn from the illuminated fraction (SVG terminator). */
export function MoonDisc({ moon, size = 120 }: { moon: Pick<MoonInfo, "illumination" | "waxing">; size?: number }) {
  const r = size / 2 - 2;
  const c = size / 2;
  // Terminator ellipse x-radius: |1 - 2k| * r; bulge side depends on gibbous/crescent.
  const k = moon.illumination;
  const rx = Math.abs(1 - 2 * k) * r;
  const lightRight = moon.waxing; // northern view
  const sweepOuter = lightRight ? 1 : 0;
  const sweepInner = k > 0.5 ? (lightRight ? 1 : 0) : lightRight ? 0 : 1;
  const d = `M ${c} ${c - r} A ${r} ${r} 0 0 ${sweepOuter} ${c} ${c + r} A ${rx} ${r} 0 0 ${sweepInner} ${c} ${c - r} Z`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${Math.round(k * 100)}% illuminated`}>
      <defs>
        <radialGradient id="moonlit" cx="40%" cy="35%">
          <stop offset="0%" stopColor="#fbf6ee" />
          <stop offset="100%" stopColor="#e6dcc8" />
        </radialGradient>
      </defs>
      <circle cx={c} cy={c} r={r} fill="#3a2236" />
      {k > 0.01 && <path d={k > 0.99 ? `M ${c} ${c - r} A ${r} ${r} 0 1 1 ${c} ${c + r} A ${r} ${r} 0 1 1 ${c} ${c - r} Z` : d} fill="url(#moonlit)" />}
      <circle cx={c} cy={c} r={r} fill="none" stroke="#c991c4" strokeOpacity="0.4" />
    </svg>
  );
}

export function MoonCard({ moon, upcoming, tz, className }: { moon: MoonInfo; upcoming: PhaseEvent[]; tz: string; className?: string }) {
  const fmt = (d: Date) => d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz });
  return (
    <section className={cn("relative overflow-hidden rounded-[var(--radius-card)] bg-gradient-to-br from-[#2d0f26] via-[#4d1c2b] to-[#6a2d5e] p-5 text-white sm:p-6", className)} aria-label="Moon today">
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(1px_1px_at_20%_30%,white,transparent),radial-gradient(1px_1px_at_70%_20%,white,transparent),radial-gradient(1px_1px_at_85%_70%,white,transparent),radial-gradient(1px_1px_at_35%_80%,white,transparent),radial-gradient(1.5px_1.5px_at_55%_45%,white,transparent)]" aria-hidden />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
        <MoonDisc moon={moon} />
        <div className="flex-1">
          <p className="text-xs font-semibold tracking-[0.14em] text-[#c991c4] uppercase">Tonight&apos;s moon</p>
          <p className="font-display text-3xl font-semibold">{moon.label}</p>
          <p className="mt-1 text-sm text-white/80">
            {Math.round(moon.illumination * 100)}% illuminated · {moon.waxing ? "waxing" : "waning"} · day {Math.floor(moon.age) + 1} of the cycle · Moon in {moon.sign}
          </p>
          {moon.exact && <p className="mt-1 text-sm text-[#e8d5e4]">Exact {PRINCIPAL[moon.exact.phase].toLowerCase()} at {moon.exact.at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz })}</p>}
        </div>
        <ul className="grid grid-cols-2 gap-2 text-sm sm:w-72">
          {upcoming.map((e) => (
            <li key={e.at.toISOString()} className="rounded-xl bg-white/10 px-3 py-2">
              <span aria-hidden>{PE[e.phase]}</span> <span className="font-medium">{PRINCIPAL[e.phase]}</span>
              <span className="block text-xs text-white/75">{fmt(e.at)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
