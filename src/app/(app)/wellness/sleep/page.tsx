import type { Metadata } from "next";
import Link from "next/link";
import { Moon, Pencil } from "lucide-react";
import { deleteSleepEntry } from "@/app/actions/wellness";
import { DeleteButton } from "@/components/forms/inline";
import { AreaOff } from "@/components/health/area-off";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/display";
import { TrendChart } from "@/components/wellness/charts";
import { SleepForm, SleepModal, SleepSettingsForm } from "@/components/wellness/forms";
import { WellnessFooter, WellnessTabs } from "@/components/wellness/shared";
import { getViewer } from "@/lib/dal";
import { fmtTime } from "@/lib/dance";
import { addDays, formatShortDate, todayIn } from "@/lib/dates";
import { healthProfile } from "@/lib/personal-health";
import { areaHidden } from "@/lib/privacy";
import { sleepNightsFor } from "@/lib/wellness-data";
import { hoursText, SCALES, series, sleepMinutes } from "@/lib/wellness-insights";

export const metadata: Metadata = { title: "Sleep journal" };

/** Bed and wake times, sleep quality, trends and a bedtime reminder. Private to you. */
export default async function SleepJournalPage() {
  const viewer = await getViewer();
  if (areaHidden(viewer.member, "wellness")) return <AreaOff label="Mental Wellness" />;
  const today = todayIn(viewer.family.timezone);
  const [profile, nights] = await Promise.all([healthProfile(viewer.family.id, viewer.member.id), sleepNightsFor(viewer.member.id, addDays(today, -90), today)]);
  const withMin = nights.map((n) => ({ ...n, minutes: sleepMinutes(n.bedTime, n.wakeTime) }));
  const week = withMin.filter((n) => n.date > addDays(today, -7));
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  const avgMin = avg(week.map((n) => n.minutes).filter((x): x is number => x !== null));
  const avgQ = avg(week.map((n) => n.quality).filter((x): x is number => !!x));
  const goalMin = Number(profile.sleepGoalHours) * 60;
  const todays = withMin.find((n) => n.date === today);
  const from = addDays(today, -29);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <PageHeader eyebrow="My private · Mental Wellness" title="Sleep journal" description="When you slept, how well, and how it's trending. Private to you." />
      <WellnessTabs active="sleep" />
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card className="flex flex-col gap-3">
          <CardHeader title={todays ? "Last night (saved)" : "How did you sleep last night?"} icon={<Moon className="size-4" />} />
          <SleepForm key={todays?.id ?? "new"} d={todays ?? { date: today, bedTime: null, wakeTime: null, quality: null, awakenings: null, notes: null }} />
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="This week" />
            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-sunken/60 p-3">
                <dt className="text-xs text-muted">Average sleep</dt>
                <dd className="text-lg font-semibold">{avgMin === null ? "—" : hoursText(Math.round(avgMin))}</dd>
                {avgMin !== null && <dd className="text-xs text-muted">{avgMin >= goalMin ? "Meeting your goal" : `${hoursText(Math.round(goalMin - avgMin))} under your goal`}</dd>}
              </div>
              <div className="rounded-xl bg-sunken/60 p-3">
                <dt className="text-xs text-muted">Average quality</dt>
                <dd className="text-lg font-semibold">{avgQ === null ? "—" : SCALES.sleepQuality.options[Math.round(avgQ) - 1]}</dd>
                <dd className="text-xs text-muted">{week.length} night{week.length === 1 ? "" : "s"} logged</dd>
              </div>
            </dl>
          </Card>
          <Card className="flex flex-col gap-2">
            <CardHeader title="Bedtime reminder & goal" />
            <SleepSettingsForm bedtimeReminder={profile.bedtimeReminder} sleepGoalHours={profile.sleepGoalHours} />
            {viewer.can("sounds") && (
              <Link href="/sounds" className="text-sm font-semibold text-primary-700 hover:underline">
                Wind down with Sleep Sounds →
              </Link>
            )}
          </Card>
        </div>
      </div>
      <Card className="flex flex-col gap-4">
        <CardHeader title="Last 30 nights" />
        <div className="grid gap-5 md:grid-cols-2">
          <TrendChart title="Hours of sleep" points={series(withMin, from, 30, (n) => (n.minutes === null ? null : Math.round((n.minutes / 60) * 10) / 10))} min={3} max={12} labels={["3 h", "12 h"]} format={(v) => `${v} hours`} />
          <TrendChart title="Sleep quality" points={series(withMin, from, 30, (n) => n.quality)} labels={["Poor", "Great"]} />
        </div>
      </Card>
      <Card>
        <CardHeader title="Sleep history" />
        {withMin.length ? (
          <ul className="divide-y divide-line">
            {withMin.map((n) => (
              <li key={n.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {formatShortDate(n.date)} · {hoursText(n.minutes)}
                  </p>
                  <p className="text-sm text-muted">
                    {[n.bedTime && n.wakeTime ? `${fmtTime(n.bedTime)} – ${fmtTime(n.wakeTime)}` : null, n.quality ? `Slept ${SCALES.sleepQuality.options[n.quality - 1]!.toLowerCase()}` : null, n.awakenings ? `woke ${n.awakenings}×` : null, n.notes].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <SleepModal d={n} triggerContent={<Pencil className="size-4" aria-label={`Edit ${formatShortDate(n.date)}`} />} />
                <DeleteButton action={deleteSleepEntry} fields={{ id: n.id }} what={`the night of ${formatShortDate(n.date)}`} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Log a few nights to see your patterns.</p>
        )}
      </Card>
      <WellnessFooter />
    </div>
  );
}
