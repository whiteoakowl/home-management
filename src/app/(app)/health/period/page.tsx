import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, History, Info, Lock } from "lucide-react";
import { PeriodCalendar, type PeriodDayView } from "@/components/health/period-calendar";
import { PeriodSettingsForm } from "@/components/health/period-settings";
import { PersonalSwitcher } from "@/components/health/personal-switcher";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, PageHeader, ProgressRing } from "@/components/ui/display";
import { CYCLE_FEELINGS, cycleStats, estimate, phaseLabel, PHYSICAL_SYMPTOMS, periodsFrom, predictedMarks } from "@/lib/cycle";
import { AreaOff } from "@/components/health/area-off";
import { getViewer } from "@/lib/dal";
import { addDays, addMonths, daysBetween, formatShortDate, monthLabel, startOfMonth, todayIn } from "@/lib/dates";
import { healthProfile, periodDaysFor } from "@/lib/personal-health";
import { AUDIENCE_LABEL, isMinor, personalSubject, privacyFor, areaHidden } from "@/lib/privacy";

export const metadata: Metadata = { title: "Period Tracker" };

const fmt = (d: string | null) => (d ? formatShortDate(d) : "—");
const days = (n: number | null) => (n === null ? "—" : `${n} day${n === 1 ? "" : "s"}`);

export default async function PeriodPage({ searchParams }: PageProps<"/health/period">) {
  const viewer = await getViewer();
  const sp = await searchParams;
  const { subject, subjects, canManage, own } = await personalSubject(viewer, "period", sp.member);
  if (own && areaHidden(viewer.member, "period")) return <AreaOff label="Period Tracker" />;
  const today = todayIn(viewer.family.timezone);
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? `${sp.month}-01` : startOfMonth(today);
  const profile = await healthProfile(viewer.family.id, subject.id);
  const q = (m: string) => `/health/period?${subject.id !== viewer.member.id ? `member=${subject.id}&` : ""}month=${m.slice(0, 7)}`;

  const header = (
    <>
      <PageHeader help="period-tracker" eyebrow="My private · Personal Health" title={own ? "Period Tracker" : `${subject.displayName}'s Period Tracker`} description="Track your cycle, flow, symptoms and feelings. Private unless you choose to share it." />
      <PersonalSwitcher subjects={subjects} current={subject.id} base="/health/period" />
    </>
  );

  if (!profile.periodEnabled) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        {header}
        <Card className="flex flex-col gap-4">
          <CardHeader title="Set up your Period Tracker" icon={<Lock className="size-4" />} />
          <p className="text-[15px] text-ink-soft">Only you can see it unless you share it in the Privacy Center. Tell us your usual lengths to get started (you can change them any time).</p>
          {canManage ? <PeriodSettingsForm memberId={subject.id} cycle={profile.typicalCycleLength} period={profile.typicalPeriodLength} customSymptoms={profile.customSymptoms} customFeelings={profile.customFeelings} enabled={false} /> : <p className="text-sm text-muted">{subject.displayName} hasn&apos;t turned on the Period Tracker.</p>}
        </Card>
      </div>
    );
  }

  const [all, privacy] = await Promise.all([periodDaysFor(subject.id), privacyFor(viewer.member.id, "period")]);
  const mode = profile.periodMode;
  const showOvulation = mode !== "basic";
  const windowWord = mode === "fertility" ? "Fertile" : "Ovulation";
  const est = estimate(all, today, { cycle: profile.typicalCycleLength, period: profile.typicalPeriodLength }, { ovulation: showOvulation });
  const minor = isMinor(subject, today);
  const periods = periodsFrom(all);
  const stats = cycleStats(periods);
  const prev = periods.length > 1 ? periods[periods.length - 2]! : null;
  const marks = Object.fromEntries(predictedMarks(est, 3));
  for (const p of periods) for (let d = p.start; d <= p.end; d = addDays(d, 1)) marks[d] = "period";
  const dayMap: Record<string, PeriodDayView> = Object.fromEntries(all.map((d) => [d.date, { flow: d.flow, symptoms: d.symptoms, feelings: d.feelings, moodIntensity: d.moodIntensity, note: d.note }]));
  const recent = all.filter((d) => d.date >= addDays(today, -45) && (d.symptoms.length || d.feelings.length || d.note)).reverse().slice(0, 8);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      {header}
      {!own && <p className="rounded-xl bg-mist-50 px-4 py-2.5 text-sm text-mist-700">{subject.displayName} shares this with you. You can view it but not change it.</p>}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Card className="flex flex-col gap-4">
          <div className="flex items-center gap-5">
            <ProgressRing value={est.cycleDay ?? 0} max={est.cycleLength} size={96}>
              <span className="flex flex-col items-center leading-none">
                <span className="text-[11px] font-semibold tracking-wider text-muted uppercase">Day</span>
                <span className="font-display text-3xl font-semibold">{est.cycleDay ?? "–"}</span>
              </span>
            </ProgressRing>
            <div className="min-w-0">
              <p className="text-sm text-muted">Current cycle day {est.cycleDay ?? "—"} of about {est.cycleLength}</p>
              <p className="font-display text-2xl font-semibold">{est.phase ? phaseLabel(est.phase, mode) : "Log your period to begin"}</p>
              {est.phase && est.phase !== "period" && <Badge tone="mist">Estimate</Badge>}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-wine-50 p-3 text-wine-700">
              <dt className="text-xs font-semibold tracking-wider uppercase">Next period (estimate)</dt>
              <dd className="mt-1 text-lg font-semibold">{fmt(est.nextPeriodStart)}</dd>
            </div>
            {showOvulation ? (
              <>
                <div className="rounded-xl bg-olive-50 p-3 text-olive-700">
                  <dt className="text-xs font-semibold tracking-wider uppercase">{windowWord} window (estimate)</dt>
                  <dd className="mt-1 text-lg font-semibold">{est.fertileStart ? `${fmt(est.fertileStart)} – ${fmt(est.fertileEnd)}` : "—"}</dd>
                </div>
                <div className="rounded-xl bg-olive-50 p-3 text-olive-700">
                  <dt className="text-xs font-semibold tracking-wider uppercase">Ovulation day (estimate)</dt>
                  <dd className="mt-1 text-lg font-semibold">{fmt(est.ovulation)}</dd>
                </div>
              </>
            ) : (
              <div className="rounded-xl bg-sunken p-3">
                <dt className="text-xs font-semibold tracking-wider text-muted uppercase">Days until next period</dt>
                <dd className="mt-1 text-lg font-semibold">{est.nextPeriodStart ? (daysBetween(today, est.nextPeriodStart) > 0 ? `About ${daysBetween(today, est.nextPeriodStart)}` : "Any day now") : "—"}</dd>
              </div>
            )}
            <div className="rounded-xl bg-sunken p-3">
              <dt className="text-xs font-semibold tracking-wider text-muted uppercase">Last period</dt>
              <dd className="mt-1 text-lg font-semibold">{est.lastPeriod ? `${fmt(est.lastPeriod.start)} · ${days(est.lastPeriod.length)}` : "—"}</dd>
            </div>
          </dl>
          <p className="flex items-start gap-2 text-xs text-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Estimates are based on {est.usingTypical ? "your typical lengths until you've recorded at least two periods" : `your ${stats.recordedCycles} recorded cycle${stats.recordedCycles === 1 ? "" : "s"}`}. Cycles vary, so predictions can be wrong. {showOvulation ? "They aren't reliable as contraception or a medical diagnosis." : "They aren't a medical diagnosis."}
          </p>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <Link href={q(addMonths(month, -1))} aria-label="Previous month" className="inline-flex size-10 items-center justify-center rounded-full hover:bg-sunken">
              <ChevronLeft className="size-5" />
            </Link>
            <h2 className="font-display text-lg font-semibold">{monthLabel(month)}</h2>
            <Link href={q(addMonths(month, 1))} aria-label="Next month" className="inline-flex size-10 items-center justify-center rounded-full hover:bg-sunken">
              <ChevronRight className="size-5" />
            </Link>
          </div>
          <PeriodCalendar
            month={month}
            today={today}
            days={dayMap}
            marks={marks}
            memberId={subject.id}
            canEdit={canManage}
            showOvulation={showOvulation}
            windowWord={windowWord}
            symptoms={[...PHYSICAL_SYMPTOMS, ...profile.customSymptoms]}
            feelings={[...CYCLE_FEELINGS, ...profile.customFeelings]}
          />
          {canManage && <p className="mt-2 text-xs text-muted">Tap any day to record flow, symptoms, feelings or a note.</p>}
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Previous period", prev ? `${fmt(prev.start)}` : "—"],
          ["Recent cycle length", days(stats.recentCycle)],
          ["Average cycle length", stats.averageCycle === null ? "—" : `${stats.averageCycle} days`],
          ["Average period", stats.averagePeriod === null ? "—" : `${stats.averagePeriod} days`],
        ].map(([k, v]) => (
          <Card key={k} className="!p-4">
            <p className="text-xs font-semibold tracking-wider text-muted uppercase">{k}</p>
            <p className="mt-1 text-xl font-semibold">{v}</p>
          </Card>
        ))}
      </div>
      <p className="-mt-2 text-xs text-muted">Averages are based on your recorded data.</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Symptoms, feelings & notes" />
          {recent.length ? (
            <ul className="divide-y divide-line">
              {recent.map((d) => (
                <li key={d.date} className="py-2.5 text-sm">
                  <p className="font-medium">{formatShortDate(d.date)}</p>
                  {(d.symptoms.length > 0 || d.feelings.length > 0) && <p className="text-ink-soft">{[...d.symptoms, ...d.feelings].join(" · ")}</p>}
                  {d.note && <p className="text-muted">{d.note}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing recorded in the last few weeks.</p>
          )}
        </Card>
        <Card className="flex flex-col gap-3">
          <CardHeader title="Cycle history" icon={<History className="size-4" />} href={`/health/period/history${own ? "" : `?member=${subject.id}`}`} hrefLabel="See all" />
          {periods.length ? (
            <ul className="flex flex-col gap-2 text-sm">
              {periods
                .map((p, i) => ({ p, cycle: periods[i + 1] ? daysBetween(p.start, periods[i + 1]!.start) : null }))
                .slice(-4)
                .reverse()
                .map(({ p, cycle }) => (
                  <li key={p.start} className="flex justify-between gap-2">
                    <span>{fmt(p.start)}</span>
                    <span className="text-muted">
                      {days(p.length)} period{cycle ? ` · ${cycle}-day cycle` : " · current"}
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Your recorded periods will appear here.</p>
          )}
        </Card>
      </div>

      {own && (
        <details className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
          <summary className="cursor-pointer font-medium">Tracker settings</summary>
          <div className="mt-4">
            <PeriodSettingsForm memberId={subject.id} cycle={profile.typicalCycleLength} period={profile.typicalPeriodLength} customSymptoms={profile.customSymptoms} customFeelings={profile.customFeelings} mode={mode} canChooseMode={!minor} />
          </div>
        </details>
      )}
      {own && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <Lock className="size-4" aria-hidden /> {AUDIENCE_LABEL[privacy.audience]}.{" "}
          <Link href="/privacy" className="font-medium text-primary-700 underline">
            Change in Privacy Center
          </Link>
        </p>
      )}
    </div>
  );
}
