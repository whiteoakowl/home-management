import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarHeart, Info } from "lucide-react";
import { BarChart } from "@/components/charts";
import { PersonalSwitcher } from "@/components/health/personal-switcher";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { cycleStats, periodsFrom } from "@/lib/cycle";
import { getViewer } from "@/lib/dal";
import { addDays, daysBetween, formatShortDate } from "@/lib/dates";
import { periodDaysFor } from "@/lib/personal-health";
import { personalSubject } from "@/lib/privacy";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Cycle history" };

const FLOW_DOT: Record<string, string> = { spotting: "bg-wine-100", light: "bg-wine-400/60", medium: "bg-wine-400", heavy: "bg-wine-700" };
const top = (xs: string[], n = 3) => [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);

export default async function CycleHistoryPage({ searchParams }: PageProps<"/health/period/history">) {
  const viewer = await getViewer();
  const sp = await searchParams;
  const { subject, subjects, own } = await personalSubject(viewer, "period", sp.member);
  const all = await periodDaysFor(subject.id);
  const periods = periodsFrom(all);
  const stats = cycleStats(periods);
  const rows = periods
    .map((p, i) => {
      const next = periods[i + 1];
      const end = next ? addDays(next.start, -1) : null;
      const inCycle = all.filter((d) => d.date >= p.start && (!end || d.date <= end));
      const flows = all.filter((d) => d.date >= p.start && d.date <= addDays(p.end, 1) && d.flow && d.flow !== "none");
      return { p, cycle: next ? daysBetween(p.start, next.start) : null, symptoms: top(inCycle.flatMap((d) => d.symptoms)), feelings: top(inCycle.flatMap((d) => d.feelings)), notes: inCycle.filter((d) => d.note).length, flows };
    })
    .reverse();
  const back = `/health/period${own ? "" : `?member=${subject.id}`}`;
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <Link href={back} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Period Tracker
      </Link>
      <PageHeader eyebrow="My private · Period Tracker" title={own ? "Cycle history" : `${subject.displayName}'s cycle history`} description="Compare your cycles over time. Everything here comes from what you recorded." />
      <PersonalSwitcher subjects={subjects} current={subject.id} base="/health/period/history" />
      {!periods.length ? (
        <Card>
          <EmptyState icon={<CalendarHeart />} title="No cycles yet" description="Record your period days on the calendar and your history will build up here." />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {[
              ["Recorded cycles", String(stats.recordedCycles)],
              ["Average cycle", stats.averageCycle === null ? "—" : `${stats.averageCycle} d`],
              ["Shortest cycle", stats.shortestCycle === null ? "—" : `${stats.shortestCycle} d`],
              ["Longest cycle", stats.longestCycle === null ? "—" : `${stats.longestCycle} d`],
              ["Recent cycle", stats.recentCycle === null ? "—" : `${stats.recentCycle} d`],
              ["Average period", stats.averagePeriod === null ? "—" : `${stats.averagePeriod} d`],
            ].map(([k, v]) => (
              <Card key={k} className="!p-4">
                <p className="text-xs font-semibold tracking-wider text-muted uppercase">{k}</p>
                <p className="mt-1 text-xl font-semibold">{v}</p>
              </Card>
            ))}
          </div>
          <p className="-mt-2 flex items-start gap-2 text-xs text-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Averages use up to your last 6 recorded cycles. They describe your records; they aren&apos;t a diagnosis.
          </p>
          {stats.recordedCycles > 0 && (
            <Card>
              <CardHeader title="Cycle length over time" />
              <BarChart
                label="Cycle length in days for each recorded cycle"
                series={[{ name: "Cycle length" }, { name: "Period length" }]}
                valueFormat={{ suffix: "days" }}
                data={rows
                  .filter((r) => r.cycle)
                  .reverse()
                  .slice(-12)
                  .map((r) => ({ label: formatShortDate(r.p.start), values: [r.cycle!, r.p.length] }))}
              />
            </Card>
          )}
          <Card>
            <CardHeader title="Every cycle" />
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs tracking-wider text-muted uppercase">
                  <tr>
                    <th className="px-2 py-2 font-semibold">Period start</th>
                    <th className="px-2 py-2 font-semibold">Period end</th>
                    <th className="px-2 py-2 font-semibold">Period</th>
                    <th className="px-2 py-2 font-semibold">Cycle</th>
                    <th className="px-2 py-2 font-semibold">Flow</th>
                    <th className="px-2 py-2 font-semibold">Symptoms</th>
                    <th className="px-2 py-2 font-semibold">Mood</th>
                    <th className="px-2 py-2 font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => (
                    <tr key={r.p.start}>
                      <td className="px-2 py-2.5 font-medium">{formatShortDate(r.p.start)}</td>
                      <td className="px-2 py-2.5">{formatShortDate(r.p.end)}</td>
                      <td className="px-2 py-2.5">{r.p.length} d</td>
                      <td className="px-2 py-2.5">{r.cycle ? `${r.cycle} d` : <span className="text-muted">Current</span>}</td>
                      <td className="px-2 py-2.5">
                        <span className="flex gap-0.5" aria-label={r.flows.map((d) => d.flow).join(", ")}>
                          {r.flows.map((d) => (
                            <span key={d.date} title={`${formatShortDate(d.date)}: ${d.flow}`} className={cn("size-3 rounded-full", FLOW_DOT[d.flow!] ?? "bg-line")} />
                          ))}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-ink-soft">{r.symptoms.join(", ") || "—"}</td>
                      <td className="px-2 py-2.5 text-ink-soft">{r.feelings.join(", ") || "—"}</td>
                      <td className="px-2 py-2.5">{r.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 flex flex-wrap gap-3 text-xs text-ink-soft">
              {Object.entries(FLOW_DOT).map(([k, c]) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className={cn("size-3 rounded-full", c)} /> {k[0]!.toUpperCase() + k.slice(1)}
                </span>
              ))}
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
