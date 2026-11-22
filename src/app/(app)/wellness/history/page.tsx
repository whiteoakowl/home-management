import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PersonalSwitcher } from "@/components/health/personal-switcher";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/display";
import { SegmentLinks } from "@/components/ui/tabs";
import { WellnessFooter, WellnessTabs } from "@/components/wellness/shared";
import { AreaOff } from "@/components/health/area-off";
import { getViewer } from "@/lib/dal";
import { addDays, addMonths, formatLongDate, formatShortDate, monthLabel, startOfMonth, startOfWeek, todayIn } from "@/lib/dates";
import { personalSubject, areaHidden } from "@/lib/privacy";
import { checkInsFor, sleepNightsFor, wellnessEntriesFor, type WellnessAccess } from "@/lib/wellness-data";
import { insights, moodByWeekday, periodSummary, SCALES, series, sleepMinutes } from "@/lib/wellness-insights";
import { BarChart, TrendChart } from "@/components/wellness/charts";
import { averageMood, MOODS, moodForScore, moodInfo, selfCareLabel } from "@/lib/wellness";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Mood history" };

const TONE: Record<string, string> = { great: "bg-olive-100", good: "bg-olive-50", okay: "bg-sunken", low: "bg-mist-50", rough: "bg-wine-50" };

/** Weekly / monthly / yearly mood patterns. Records, not diagnoses. */
export default async function MoodHistoryPage({ searchParams }: PageProps<"/wellness/history">) {
  const viewer = await getViewer();
  const sp = await searchParams;
  const { subject, subjects, own } = await personalSubject(viewer, "wellness", sp.member);
  if (own && areaHidden(viewer.member, "wellness")) return <AreaOff label="Mental Wellness" />;
  const access = (subject.access ?? "self") as WellnessAccess;
  const today = todayIn(viewer.family.timezone);
  const range = sp.range === "month" || sp.range === "year" ? sp.range : "week";
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const from = range === "week" ? startOfWeek(date, 1) : range === "month" ? startOfMonth(date) : `${date.slice(0, 4)}-01-01`;
  const to = range === "week" ? addDays(from, 6) : range === "month" ? addDays(addMonths(from, 1), -1) : `${date.slice(0, 4)}-12-31`;
  const day = typeof sp.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) ? sp.day : null;
  const trendFrom = addDays(today, -29);
  const [checkIns, entries, recent, nights] = await Promise.all([
    checkInsFor(subject.id, access, from, to),
    wellnessEntriesFor(viewer, subject.id, { from, to }),
    checkInsFor(subject.id, access, addDays(today, -120), today),
    access === "self" || access === "managed" ? sleepNightsFor(subject.id, addDays(today, -120), today) : Promise.resolve([]),
  ]);
  const found = insights(recent, nights.map((n) => ({ date: n.date, minutes: sleepMinutes(n.bedTime, n.wakeTime), quality: n.quality })), today);
  const summary = periodSummary(checkIns, from, to);
  const moodScore = (c: (typeof recent)[number]) => moodInfo(c.mood)?.score ?? null;
  const byWeekday = moodByWeekday(recent).filter((d) => d.n > 0);
  const byDay = new Map(checkIns.map((c) => [c.date, c]));
  const href = (o: { range?: string; date?: string; day?: string | null }) => {
    const p = new URLSearchParams();
    if (!own) p.set("member", subject.id);
    p.set("range", o.range ?? range);
    p.set("date", o.date ?? date);
    if (o.day) p.set("day", o.day);
    return `/wellness/history?${p}`;
  };
  const prev = range === "week" ? addDays(from, -7) : range === "month" ? addMonths(from, -1) : `${Number(date.slice(0, 4)) - 1}-01-01`;
  const next = range === "week" ? addDays(from, 7) : range === "month" ? addMonths(from, 1) : `${Number(date.slice(0, 4)) + 1}-01-01`;
  const title = range === "week" ? `Week of ${formatShortDate(from)}` : range === "month" ? monthLabel(from) : date.slice(0, 4);
  const counts = MOODS.map((m) => ({ ...m, n: checkIns.filter((c) => c.mood === m.key).length }));
  const maxN = Math.max(1, ...counts.map((c) => c.n));
  const feelingTally = [...checkIns.flatMap((c) => c.feelings).reduce((m, f) => m.set(f, (m.get(f) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const dayCheckIn = day ? byDay.get(day) : undefined;
  const dayEntries = day ? entries.filter((e) => e.date === day) : [];

  const cell = (d: string) => {
    const c = byDay.get(d);
    const m = moodInfo(c?.mood);
    return (
      <Link key={d} href={href({ day: d })} aria-label={`${formatLongDate(d)}: ${m?.label ?? (c ? "checked in" : "no check-in")}`} className={cn("flex aspect-square min-h-11 flex-col items-center justify-center rounded-xl text-xs", c ? TONE[c.mood ?? ""] ?? "bg-primary-50" : "bg-surface border border-line", day === d && "ring-2 ring-primary-500")}>
        <span className="text-muted">{Number(d.slice(8))}</span>
        <span className="text-lg leading-none" aria-hidden>
          {m?.emoji ?? ""}
        </span>
      </Link>
    );
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <PageHeader eyebrow="My private · Mental Wellness" title="Mood history" description="Patterns from your check-ins. They're a record for you, not a diagnosis." />
      <PersonalSwitcher subjects={subjects} current={subject.id} base="/wellness/history" />
      <WellnessTabs active="history" member={own ? undefined : subject.id} />
      <div className="flex flex-wrap items-center gap-2">
        <SegmentLinks active={range} items={(["week", "month", "year"] as const).map((r) => ({ key: r, href: href({ range: r }), label: r[0]!.toUpperCase() + r.slice(1) }))} />
        <Link href={href({ date: prev })} aria-label="Previous" className="ml-2 inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface hover:bg-sunken">
          <ChevronLeft className="size-5" />
        </Link>
        <Link href={href({ date: next })} aria-label="Next" className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface hover:bg-sunken">
          <ChevronRight className="size-5" />
        </Link>
        <h2 className="ml-1 text-lg font-semibold">{title}</h2>
      </div>

      <Card>
        {range === "week" && <div className="grid grid-cols-7 gap-1.5">{Array.from({ length: 7 }, (_, i) => cell(addDays(from, i)))}</div>}
        {range === "month" && (
          <>
            <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-muted" aria-hidden>
              {["M", "T", "W", "T", "F", "S", "S"].map((w, i) => (
                <span key={i}>{w}</span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1.5">
              {Array.from({ length: (new Date(`${from}T12:00:00Z`).getUTCDay() + 6) % 7 }, (_, i) => (
                <span key={`pad${i}`} />
              ))}
              {Array.from({ length: Number(to.slice(8)) }, (_, i) => cell(addDays(from, i)))}
            </div>
          </>
        )}
        {range === "year" && (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 12 }, (_, i) => {
              const m0 = `${date.slice(0, 4)}-${String(i + 1).padStart(2, "0")}-01`;
              const inMonth = checkIns.filter((c) => c.date.startsWith(m0.slice(0, 7)));
              const avg = averageMood(inMonth.map((c) => c.mood));
              return (
                <li key={m0}>
                  <Link href={href({ range: "month", date: m0 })} className="flex items-center justify-between rounded-xl border border-line p-3 hover:border-primary-300">
                    <span>
                      <span className="block font-medium">{new Date(`${m0}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" })}</span>
                      <span className="text-xs text-muted">{inMonth.length} check-in{inMonth.length === 1 ? "" : "s"}</span>
                    </span>
                    <span className="text-2xl" aria-label={moodForScore(avg)?.label ?? "No check-ins"}>
                      {moodForScore(avg)?.emoji ?? ""}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {day && (
        <Card className="flex flex-col gap-2">
          <CardHeader title={formatLongDate(day)} />
          {dayCheckIn ? (
            <>
              <p className="text-[15px]">
                {moodInfo(dayCheckIn.mood)?.emoji} {moodInfo(dayCheckIn.mood)?.label ?? "Checked in"}
                {dayCheckIn.intensity ? ` · ${dayCheckIn.intensity}` : ""}
              </p>
              {dayCheckIn.feelings.length > 0 && <p className="text-sm text-ink-soft">Feelings: {dayCheckIn.feelings.join(", ")}</p>}
              {dayCheckIn.selfCare.length > 0 && <p className="text-sm text-ink-soft">Self-care: {dayCheckIn.selfCare.map(selfCareLabel).join(", ")}</p>}
              {dayCheckIn.note && <p className="text-sm text-muted">{dayCheckIn.note}</p>}
            </>
          ) : (
            <p className="text-sm text-muted">No check-in this day.</p>
          )}
          {dayEntries.map((e) => (
            <div key={e.id} className="rounded-xl bg-sunken/60 p-3 text-sm">
              <p className="font-medium">Journal{e.title ? `: ${e.title}` : ""}</p>
              {e.body && <p className="whitespace-pre-line text-ink-soft">{e.body}</p>}
            </div>
          ))}
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <CardHeader title={`Summary: ${title}`} />
        {summary.checkIns ? (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { k: "Check-ins", v: String(summary.checkIns) },
              { k: "Average mood", v: summary.mood ? `${moodForScore(summary.mood)?.emoji ?? ""} ${moodForScore(summary.mood)?.label ?? ""}` : "—" },
              { k: "Average energy", v: summary.energy ? SCALES.energy.options[Math.round(summary.energy) - 1]! : "—" },
              { k: "Average stress", v: summary.stress ? SCALES.stress.options[Math.round(summary.stress) - 1]! : "—" },
            ].map((x) => (
              <div key={x.k} className="rounded-xl bg-sunken/60 p-3">
                <dt className="text-xs text-muted">{x.k}</dt>
                <dd className="font-semibold">{x.v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted">No check-ins in this period.</p>
        )}
        {(summary.topFeelings.length > 0 || summary.topSelfCare.length > 0) && (
          <p className="text-sm text-ink-soft">
            {summary.topFeelings.length > 0 && <>Felt most: {summary.topFeelings.join(", ")}. </>}
            {summary.topSelfCare.length > 0 && <>Self-care you did most: {summary.topSelfCare.join(", ")}.</>}
          </p>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <CardHeader title="Insights" />
        {found.length ? (
          <ul className="flex flex-col gap-2">
            {found.map((i) => (
              <li key={i.key} className="rounded-xl bg-primary-50/60 px-3 py-2 text-[15px]">
                💡 {i.text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Keep checking in (energy, stress and sleep too). Patterns show up here after a couple of weeks.</p>
        )}
        <p className="text-xs text-muted">Based only on what you logged. Patterns, not diagnoses.</p>
      </Card>

      <Card className="flex flex-col gap-4">
        <CardHeader title="Last 30 days" />
        <div className="grid gap-5 md:grid-cols-2">
          <TrendChart title="Mood" points={series(recent, trendFrom, 30, moodScore)} labels={["Rough", "Great"]} />
          <TrendChart title="Energy" points={series(recent, trendFrom, 30, (c) => c.energy)} labels={["Drained", "High"]} />
          <TrendChart title="Stress" points={series(recent, trendFrom, 30, (c) => c.stress)} labels={["Calm", "Very"]} />
          <TrendChart title="Sleep quality" points={series(recent, trendFrom, 30, (c) => c.sleepQuality)} labels={["Poor", "Great"]} />
        </div>
        {byWeekday.length >= 3 && <BarChart title="Average mood by day of the week (1–5)" bars={byWeekday.map((d) => ({ label: d.name.slice(0, 3), value: d.avg ?? 0 }))} max={5} />}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Moods in this period" />
          <ul className="flex flex-col gap-2">
            {counts.map((c) => (
              <li key={c.key} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0">
                  {c.emoji} {c.label}
                </span>
                <span className="h-3 flex-1 overflow-hidden rounded-full bg-sunken">
                  <span className="block h-full rounded-full bg-primary-400" style={{ width: `${(c.n / maxN) * 100}%` }} />
                </span>
                <span className="w-6 text-right tabular-nums">{c.n}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Feelings you named most" />
          {feelingTally.length ? (
            <ul className="flex flex-wrap gap-2">
              {feelingTally.map(([f, n]) => (
                <li key={f} className="rounded-full bg-primary-50 px-3 py-1 text-sm text-primary-700">
                  {f} · {n}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No feelings recorded in this period.</p>
          )}
        </Card>
      </div>
      <WellnessFooter />
    </div>
  );
}
