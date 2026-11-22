import type { Metadata } from "next";
import { Archive, Bell, Flame, Pencil, Target } from "lucide-react";
import { archiveWellnessGoal, toggleGoalMark } from "@/app/actions/wellness";
import { ActionButton } from "@/components/forms/inline";
import { AreaOff } from "@/components/health/area-off";
import { PersonalSwitcher } from "@/components/health/personal-switcher";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader, ProgressBar } from "@/components/ui/display";
import { BarChart } from "@/components/wellness/charts";
import { WellnessGoalModal } from "@/components/wellness/forms";
import { WellnessFooter, WellnessTabs } from "@/components/wellness/shared";
import { getViewer } from "@/lib/dal";
import { fmtTime } from "@/lib/dance";
import { addDays, formatShortDate, todayIn } from "@/lib/dates";
import { areaHidden, personalSubject } from "@/lib/privacy";
import { cn } from "@/lib/utils";
import { goalsWithProgress, type WellnessAccess } from "@/lib/wellness-data";
import { habitStreak, weeklyCounts, weeklyStreak } from "@/lib/wellness-insights";
import { GOAL_KINDS, SELF_CARE } from "@/lib/wellness";

export const metadata: Metadata = { title: "Goals & habits" };

const IDEAS = [
  { title: "Drink water with every meal", kind: "self_care", key: "water" },
  { title: "Get outside every day", kind: "self_care", key: "outside" },
  { title: "Move my body 3 times a week", kind: "self_care", key: "exercise" },
  { title: "Read before bed", kind: "self_care", key: "read" },
  { title: "Call or text a friend", kind: "self_care", key: "talked" },
  { title: "Time for a hobby", kind: "self_care", key: "hobby" },
  { title: "Rest without screens", kind: "self_care", key: "rested" },
  { title: "Write three good things", kind: "gratitude", key: null },
];

/** Daily and weekly goals and habits: ticks, streaks, reminders and progress over time. */
export default async function HabitsPage({ searchParams }: { searchParams: Promise<{ member?: string }> }) {
  const viewer = await getViewer();
  const sp = await searchParams;
  const { subject, subjects, own, canManage } = await personalSubject(viewer, "wellness", sp.member);
  if (own && areaHidden(viewer.member, "wellness")) return <AreaOff label="Mental Wellness" />;
  const today = todayIn(viewer.family.timezone);
  const goals = await goalsWithProgress(viewer, subject.id, (subject.access ?? "self") as WellnessAccess, today);
  const last14 = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <PageHeader eyebrow="My private · Mental Wellness" title="Goals & habits" description="Small, kind habits, daily or a few times a week. Streaks celebrate; missing a day never takes anything away." actions={canManage ? <WellnessGoalModal memberId={subject.id} /> : undefined} />
      <PersonalSwitcher subjects={subjects} current={subject.id} base="/wellness/habits" />
      <WellnessTabs active="habits" member={own ? undefined : subject.id} />
      {goals.length === 0 ? (
        <Card>
          <EmptyState icon={<Target />} title="No goals yet" description="Pick something small. Self-care goals tick themselves off from your check-ins." />
          {canManage && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {IDEAS.map((i) => (
                <li key={i.title}>
                  <WellnessGoalModal memberId={subject.id} triggerLabel={i.title} defaults={{ title: i.title, kind: i.kind, selfCareKey: i.key, timesPerWeek: 3, cadence: i.title.includes("every day") ? "daily" : "weekly" }} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <ul className="flex flex-col gap-4">
          {goals.map((g) => {
            const daily = g.cadence === "daily";
            const target = daily ? 7 : g.timesPerWeek;
            const streak = daily ? habitStreak(g.dates, today) : weeklyStreak(g.dates, today, g.timesPerWeek);
            const weeks = weeklyCounts(g.dates, today, 8);
            const set = new Set(g.dates);
            const how = g.kind === "self_care" ? `Counts when you tick “${SELF_CARE.find((s) => s.key === g.selfCareKey)?.label ?? g.selfCareKey}” in a check-in` : g.kind === "custom" ? "Tick it off below" : `Counts from your ${GOAL_KINDS.find((k) => k.key === g.kind)?.label.toLowerCase()}`;
            return (
              <li key={g.id}>
                <Card className="flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-semibold">{g.title}</h2>
                      <p className="text-sm text-muted">
                        {daily ? "Every day" : `${g.timesPerWeek}× a week`} · {how}
                        {g.reminderTime ? (
                          <span className="ml-1 inline-flex items-center gap-1">
                            · <Bell className="size-3.5" aria-hidden /> {fmtTime(g.reminderTime)}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold", streak ? "bg-sunflower-50 text-sunflower-700" : "bg-sunken text-muted")}>
                      <Flame className="size-4" aria-hidden /> {streak} {daily ? (streak === 1 ? "day" : "days") : streak === 1 ? "week" : "weeks"}
                      <span className="sr-only"> streak</span>
                    </span>
                  </div>
                  <div>
                    <p className="mb-1 text-sm">
                      This week: {Math.min(g.done, target)} of {target}
                    </p>
                    <ProgressBar value={Math.min(g.done, target)} max={target} label={`${g.title} this week`} />
                  </div>
                  <ol className="grid grid-cols-7 gap-1 sm:grid-cols-14" aria-label="Last 14 days">
                    {last14.map((d) => (
                      <li key={d} className="flex flex-col items-center gap-0.5 text-[10px] text-muted">
                        <span className={cn("flex size-8 items-center justify-center rounded-lg text-sm", set.has(d) ? "bg-olive-100 font-semibold text-olive-700" : "bg-sunken")} aria-label={`${formatShortDate(d)}: ${set.has(d) ? "done" : "not done"}`}>
                          {set.has(d) ? "✓" : ""}
                        </span>
                        {new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "narrow", timeZone: "UTC" })}
                      </li>
                    ))}
                  </ol>
                  <BarChart title="Days done per week (last 8 weeks)" bars={weeks.map((w) => ({ label: formatShortDate(w.start).replace(/^\w+ /, ""), value: w.n }))} max={7} />
                  {canManage && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {g.kind === "custom" && (
                        <ActionButton action={toggleGoalMark} fields={{ id: g.id }} className="h-10 rounded-full border border-line-strong px-4 text-sm font-medium hover:bg-sunken">
                          {g.doneToday ? "Done today ✓ (undo)" : "Did it today"}
                        </ActionButton>
                      )}
                      <WellnessGoalModal memberId={subject.id} defaults={{ id: g.id, title: g.title, kind: g.kind, timesPerWeek: g.timesPerWeek, selfCareKey: g.selfCareKey, cadence: g.cadence, reminderTime: g.reminderTime }} triggerContent={<Pencil className="size-4" aria-label="Edit goal" />} />
                      <ActionButton action={archiveWellnessGoal} fields={{ id: g.id }} label="Put away goal" className="inline-flex size-10 items-center justify-center rounded-full text-muted hover:bg-sunken">
                        <Archive className="size-4" />
                      </ActionButton>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <Card>
        <CardHeader title="Self-care ideas" />
        <p className="text-sm text-ink-soft">Exercise · Water · Time outdoors · Reading · Calling a friend · A hobby · Rest. Tick them in your daily check-in and goals that use them fill in on their own.</p>
      </Card>
      <WellnessFooter />
    </div>
  );
}
