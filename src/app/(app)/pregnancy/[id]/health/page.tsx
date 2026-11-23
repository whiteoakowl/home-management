import type { Metadata } from "next";
import { Card, CardHeader } from "@/components/ui/card";
import { PregnancyLogModal } from "@/components/pregnancy/forms";
import { SegmentLinks } from "@/components/ui/tabs";
import { BarChart, TrendChart } from "@/components/wellness/charts";
import { addDays, daysBetween, zonedToUtc } from "@/lib/dates";
import { TRIMESTERS } from "@/lib/pregnancy/dates";
import { logsOf } from "@/lib/pregnancy/queries";
import { URGENT_NOTE } from "@/lib/pregnancy/weeks";
import { PLogList, rangeStart } from "../../logs";
import { dateOf, PregnancyHeader, pregnancyContext } from "../../shared";

export const metadata: Metadata = { title: "Pregnancy health" };

export default async function HealthPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ range?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const ctx = await pregnancyContext(id);
  const { p, g, tz, today, now, can } = ctx;
  const range = ["week", "month", "trimester", "all"].includes(sp.range ?? "") ? sp.range! : "week";
  const since = rangeStart(range, today, tz, p, zonedToUtc, addDays, g ? TRIMESTERS[g.trimester].from : undefined);
  const logs = await logsOf(p.id, ["symptom", "mood", "weight", "measure"], { since, limit: 500 });
  const of = (k: string) => logs.filter((l) => l.kind === k);
  const first = since ? dateOf(since, tz) : logs.length ? dateOf(logs[logs.length - 1]!.startedAt, tz) : today;
  const span = Math.min(120, Math.max(1, daysBetween(first, today) + 1));
  const days = Array.from({ length: span }, (_, i) => addDays(today, i - span + 1));
  const daily = (k: string, val: (l: (typeof logs)[number]) => number | null) =>
    days.map((d) => {
      const xs = of(k).filter((l) => dateOf(l.startedAt, tz) === d).map(val).filter((v): v is number => v !== null && !Number.isNaN(v));
      return { date: d, value: xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null };
    });
  const moodPts = daily("mood", (l) => (l.data.mood ? Number(l.data.mood) : null));
  const energyPts = daily("mood", (l) => (l.data.energy ? Number(l.data.energy) : null));
  const stressPts = daily("mood", (l) => (l.data.stress ? Number(l.data.stress) : null));
  const weights = daily("weight", (l) => Number(l.amount));
  const wVals = weights.map((w) => w.value).filter((v): v is number => v !== null);
  const counts = new Map<string, number>();
  for (const l of of("symptom")) counts.set(String(l.data.symptom), (counts.get(String(l.data.symptom)) ?? 0) + 1);
  const topSymptoms = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const highStress = stressPts.filter((x) => x.value !== null && x.value >= 4).length >= 3 || moodPts.filter((x) => x.value !== null && x.value <= 2).length >= 3;
  const edit = (f: "symptoms" | "mood" | "weight" | "measurements") => can(f) && p.status !== "born";
  const ranges = [
    { key: "week", label: "7 days", href: "?range=week" },
    { key: "month", label: "30 days", href: "?range=month" },
    { key: "trimester", label: "Trimester", href: "?range=trimester" },
    { key: "all", label: "All", href: "?range=all" },
  ];

  return (
    <>
      <PregnancyHeader ctx={ctx} active="health" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SegmentLinks active={range} items={ranges} />
        <div className="flex flex-wrap gap-2">
          {edit("symptoms") && <PregnancyLogModal pregnancyId={p.id} kind="symptom" now={now} />}
          {edit("mood") && <PregnancyLogModal pregnancyId={p.id} kind="mood" now={now} />}
          {edit("weight") && <PregnancyLogModal pregnancyId={p.id} kind="weight" now={now} />}
          {edit("measurements") && <PregnancyLogModal pregnancyId={p.id} kind="measure" now={now} />}
        </div>
      </div>

      {highStress && (
        <p className="mb-4 rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm">
          💛 It looks like it&apos;s been a hard stretch. You&apos;re not alone: feelings like these are common in pregnancy, and your provider can help. If you ever feel unsafe or have thoughts of harming yourself, call or text 988 (US) or your local emergency number. <a href="/wellness" className="font-medium underline">Mental Wellness</a> has breathing and calming tools.
        </p>
      )}

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Symptoms" />
          {topSymptoms.length ? <BarChart title="How often" bars={topSymptoms.map(([label, value]) => ({ label: label.length > 10 ? `${label.slice(0, 9)}…` : label, value }))} max={topSymptoms[0]![1]} /> : <p className="text-sm text-muted">No symptoms logged in this range.</p>}
        </Card>
        <Card>
          <CardHeader title="Mood, energy & stress" />
          <div className="flex flex-col gap-3">
            <TrendChart title="Mood" points={moodPts} labels={["Low", "Great"]} />
            <TrendChart title="Energy" points={energyPts} labels={["Drained", "Energetic"]} />
            <TrendChart title="Stress" points={stressPts} labels={["Calm", "Stressed"]} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Weight" />
          {wVals.length ? (
            <TrendChart title="Weight" points={weights} min={Math.floor(Math.min(...wVals) - 2)} max={Math.ceil(Math.max(...wVals) + 2)} format={(v) => String(v)} />
          ) : (
            <p className="text-sm text-muted">No weights in this range.</p>
          )}
          <p className="mt-2 text-xs text-muted">Weight changes are a normal part of pregnancy and look different for everyone. Your provider can talk with you about what&apos;s right for you.</p>
        </Card>
        <Card>
          <CardHeader title="Health readings" />
          <PLogList ctx={ctx} logs={of("measure").slice(0, 10)} empty="Blood pressure, blood sugar, temperature or anything your provider asked you to track." canChange={edit("measurements")} />
          <p className="mt-2 text-xs text-muted">The app records readings; it doesn&apos;t interpret them or diagnose anything.</p>
        </Card>
      </div>

      <Card>
        <CardHeader title="All entries" />
        <PLogList ctx={ctx} logs={logs.filter((l) => l.kind !== "measure").slice(0, 100)} empty="Nothing logged in this range yet." canChange={ctx.canEdit} />
      </Card>
      <p className="mt-6 text-xs text-muted">{URGENT_NOTE}</p>
    </>
  );
}
