import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MoonCard } from "@/components/craft/moon-card";
import { CraftTabs } from "@/components/craft/craft-tabs";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/display";
import { PHASE_EMOJI, phasesBetween } from "@/lib/astro";
import { moonFor, upcomingMoonPhases } from "@/lib/craft";
import { addDays, addMonths, monthLabel, startOfMonth, todayIn, zonedToUtc } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { craftViewer } from "../shared";

export const metadata: Metadata = { title: "Moon phases" };

const NAMES = { new: "New Moon", first_quarter: "First Quarter", full: "Full Moon", last_quarter: "Last Quarter" } as const;
const GUIDE = [
  { k: "new_moon", t: "New Moon", d: "Beginnings, setting intentions, rest and planning." },
  { k: "waxing_crescent", t: "Waxing", d: "Growth, attraction, building momentum: prosperity and new projects." },
  { k: "full_moon", t: "Full Moon", d: "Culmination, gratitude, charging crystals and water, divination." },
  { k: "waning_gibbous", t: "Waning", d: "Release, banishing, cleansing, breaking habits and reflection." },
] as const;

export default async function MoonPage({ searchParams }: PageProps<"/witchcraft/moon">) {
  const viewer = await craftViewer();
  const tz = viewer.family.timezone;
  const today = todayIn(tz);
  const sp = (await searchParams) as { month?: string };
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? `${sp.month}-01` : startOfMonth(today);
  const days = Array.from({ length: 31 }, (_, i) => addDays(month, i)).filter((d) => d.slice(0, 7) === month.slice(0, 7));
  const lead = new Date(`${month}T12:00:00Z`).getUTCDay();
  const events = phasesBetween(zonedToUtc(month, "00:00", tz), zonedToUtc(addMonths(month, 1), "00:00", tz));
  const fmt = (d: Date) => d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz });
  return (
    <>
      <PageHeader eyebrow="Witchcraft" title="Moon phases" description={`Calculated astronomically for ${viewer.family.locationName ?? "your"} time zone (${tz}).`} />
      <CraftTabs active="moon" />
      <MoonCard moon={moonFor(viewer, today)} upcoming={upcomingMoonPhases(viewer)} tz={tz} className="mb-6" />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{monthLabel(month)}</h2>
            <div className="flex gap-1">
              <Link href={`?month=${addMonths(month, -1).slice(0, 7)}`} aria-label="Previous month" className="inline-flex size-9 items-center justify-center rounded-full border border-line hover:bg-sunken">
                <ChevronLeft className="size-4" />
              </Link>
              <Link href="?" className="inline-flex h-9 items-center rounded-full border border-line px-3 text-sm hover:bg-sunken">
                Today
              </Link>
              <Link href={`?month=${addMonths(month, 1).slice(0, 7)}`} aria-label="Next month" className="inline-flex size-9 items-center justify-center rounded-full border border-line hover:bg-sunken">
                <ChevronRight className="size-4" />
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <ol className="mt-1 grid grid-cols-7 gap-1">
            {Array.from({ length: lead }, (_, i) => (
              <li key={`b${i}`} aria-hidden />
            ))}
            {days.map((d) => {
              const m = moonFor(viewer, d);
              return (
                <li
                  key={d}
                  className={cn("flex flex-col items-center gap-0.5 rounded-xl py-2", m.exact ? "bg-primary-50" : "bg-sunken/50", d === today && "ring-2 ring-primary-500")}
                  title={`${m.label}, ${Math.round(m.illumination * 100)}% · Moon in ${m.sign}`}
                >
                  <span className="text-xs text-muted">{Number(d.slice(8))}</span>
                  <span className="text-xl" aria-label={m.label}>
                    {m.emoji}
                  </span>
                  <span className="hidden text-[10px] text-muted sm:block">{Math.round(m.illumination * 100)}%</span>
                  {m.exact && <span className="hidden text-[10px] font-semibold text-primary-700 sm:block">{m.label}</span>}
                </li>
              );
            })}
          </ol>
        </Card>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="This month's phases" />
            <ul className="flex flex-col gap-2">
              {events.map((e) => (
                <li key={e.at.toISOString()} className="flex items-center gap-3 text-sm">
                  <span className="text-xl" aria-hidden>
                    {PHASE_EMOJI[({ new: "new_moon", first_quarter: "first_quarter", full: "full_moon", last_quarter: "last_quarter" } as const)[e.phase]]}
                  </span>
                  <span className="font-medium">{NAMES[e.phase]}</span>
                  <span className="ml-auto text-muted">{fmt(e.at)}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Working with the moon" />
            <ul className="flex flex-col gap-3 text-sm">
              {GUIDE.map((g) => (
                <li key={g.k}>
                  <span className="mr-1" aria-hidden>
                    {PHASE_EMOJI[g.k]}
                  </span>
                  <strong>{g.t}:</strong> {g.d}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
