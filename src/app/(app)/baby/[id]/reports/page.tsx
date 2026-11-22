import type { Metadata } from "next";
import Link from "next/link";
import { Download, Printer } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { SegmentLinks } from "@/components/ui/tabs";
import { BarChart } from "@/components/wellness/charts";
import { dayBounds, logsInRange } from "@/lib/baby";
import { dayTotals, duration, periodReport, pottyStats, reportSummary } from "@/lib/baby-kinds";
import { addDays, formatShortDate } from "@/lib/dates";
import { BabyHeader, babyContext } from "../../shared";

export const metadata: Metadata = { title: "Baby reports" };

const PERIODS = { day: 1, week: 7, month: 30 } as const;

/** Daily, weekly and monthly summaries, trends, and an export for the pediatrician. */
export default async function BabyReportsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ period?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await babyContext(id);
  const { baby, tz, today, nowDate, units } = ctx;
  const period = (sp.period && sp.period in PERIODS ? sp.period : "week") as keyof typeof PERIODS;
  const n = PERIODS[period];
  const first = addDays(today, -(n - 1));
  const prevFirst = addDays(first, -n);
  const logs = await logsInRange(baby.id, dayBounds(addDays(prevFirst, -1), tz).start, dayBounds(today, tz).end);
  const days = (from: string, count: number) =>
    Array.from({ length: count }, (_, i) => {
      const d = addDays(from, i);
      const b = dayBounds(d, tz);
      return { d, t: dayTotals(logs, b.start, b.end, nowDate), b };
    });
  const cur = days(first, n);
  const prev = days(prevFirst, n);
  const pumps = (rows: typeof cur) => logs.filter((l) => l.kind === "pump" && rows.some((r) => l.startedAt >= r.b.start && l.startedAt < r.b.end)).map((l) => Number(l.amount ?? 0));
  const report = periodReport(cur.map((x) => x.t), pumps(cur));
  const before = periodReport(prev.map((x) => x.t), pumps(prev));
  const inCur = (l: (typeof logs)[number]) => l.startedAt >= cur[0]!.b.start && l.startedAt < cur[cur.length - 1]!.b.end;
  const potty = pottyStats(logs.filter((l) => l.kind === "potty" && inCur(l)));
  const label = (d: string) => (n <= 7 ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }) : d.slice(8));
  const bars = (pick: (t: (typeof cur)[number]["t"]) => number) => cur.map((x) => ({ label: label(x.d), value: Math.round(pick(x.t) * 10) / 10 }));

  return (
    <>
      <BabyHeader ctx={ctx} active="reports" />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SegmentLinks active={period} items={(Object.keys(PERIODS) as (keyof typeof PERIODS)[]).map((p) => ({ key: p, href: `/baby/${baby.id}/reports?period=${p}`, label: p === "day" ? "Today" : p === "week" ? "Last 7 days" : "Last 30 days" }))} />
        <span className="flex-1" />
        <Link href={`/api/baby/${baby.id}/export?days=${Math.max(n, 7)}`} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-medium hover:bg-sunken">
          <Download className="size-4" aria-hidden /> Export (CSV)
        </Link>
        <Link href={`/baby/${baby.id}/report?days=14`} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-medium hover:bg-sunken">
          <Printer className="size-4" aria-hidden /> Pediatrician summary
        </Link>
      </div>

      <Card className="mb-4 flex flex-col gap-3">
        <CardHeader title={`Summary: ${formatShortDate(first)}${n > 1 ? ` – ${formatShortDate(today)}` : ""}`} />
        <p className="text-[15px] text-ink-soft">{reportSummary(report, n > 1 ? before : null, units.volume)}</p>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { k: "Feeds", v: String(report.feeds), s: n > 1 ? `${report.feedsPerDay}/day` : undefined },
            { k: "Bottles", v: `${report.bottleAmount} ${units.volume}`, s: n > 1 ? `${report.bottlePerDay}/day` : undefined },
            { k: "Nursing", v: duration(report.nursingMinutes) },
            { k: "Sleep", v: duration(report.sleepMinutes), s: n > 1 ? `${duration(report.sleepPerDay)}/day` : undefined },
            { k: "Diapers", v: String(report.diapers), s: `${report.wet} wet · ${report.dirty} dirty` },
            { k: "Pumping", v: `${report.pumpTotal} ${units.volume}`, s: `${report.pumpSessions} sessions` },
          ].map((x) => (
            <div key={x.k} className="rounded-xl bg-sunken/60 p-3">
              <dt className="text-xs text-muted">{x.k}</dt>
              <dd className="text-lg font-semibold">{x.v}</dd>
              {x.s && <dd className="text-xs text-muted">{x.s}</dd>}
            </div>
          ))}
        </dl>
        {potty.tries + potty.accidents > 0 && (
          <p className="text-sm">
            🚽 Potty: {potty.wins} success{potty.wins === 1 ? "" : "es"} from {potty.tries} tries{potty.rate !== null ? ` (${potty.rate}%)` : ""}, {potty.accidents} accident{potty.accidents === 1 ? "" : "s"}.
          </p>
        )}
      </Card>

      {n > 1 && (
        <Card className="flex flex-col gap-5">
          <CardHeader title="Trends" />
          <div className="grid gap-6 md:grid-cols-2">
            <BarChart title="Feeds per day" bars={bars((t) => t.feeds)} max={Math.max(1, ...cur.map((x) => x.t.feeds))} />
            <BarChart title={`Bottle ${units.volume} per day`} bars={bars((t) => t.bottleAmount)} max={Math.max(1, ...cur.map((x) => x.t.bottleAmount))} />
            <BarChart title="Hours of sleep per day" bars={bars((t) => t.sleepMinutes / 60)} max={Math.max(1, ...cur.map((x) => x.t.sleepMinutes / 60))} />
            <BarChart title="Diapers per day" bars={bars((t) => t.diapers)} max={Math.max(1, ...cur.map((x) => x.t.diapers))} />
            <BarChart title="Tummy time (minutes)" bars={bars((t) => t.tummyMinutes)} max={Math.max(1, ...cur.map((x) => x.t.tummyMinutes))} />
          </div>
        </Card>
      )}
    </>
  );
}
