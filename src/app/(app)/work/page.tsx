import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, gte, isNull, or } from "drizzle-orm";
import { Briefcase, CalendarOff, ChevronLeft, ChevronRight, Copy, Repeat } from "lucide-react";
import { db } from "@/db";
import { workPatterns, workShifts, workTimeOff } from "@/db/schema";
import { copyLastWeek, deleteShift, deleteTimeOff, endPattern, skipWorkDay } from "@/app/actions/work";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { PatternModal, ShiftModal, TimeOffModal, WorkSharingModal } from "@/components/work/shift-form";
import { Card } from "@/components/ui/card";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/display";
import { SegmentLinks } from "@/components/ui/tabs";
import { getViewer } from "@/lib/dal";
import { fmtTime, shiftHours, WEEKDAYS } from "@/lib/dance";
import { addDays, formatShortDate, startOfWeek, todayIn } from "@/lib/dates";
import { memberOptions } from "@/lib/queries";
import { myWorkSharing, workBetween } from "@/lib/work";
import { offOn, timeOffEmoji, timeOffLabel, weekdaysText } from "@/lib/work-schedule";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Work schedules" };

export default async function WorkPage({ searchParams }: PageProps<"/work">) {
  const viewer = await getViewer();
  if (!viewer.can("work")) notFound();
  const sp = await searchParams;
  const today = todayIn(viewer.family.timezone);
  const week = startOfWeek(typeof sp.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : today, 1);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const members = await memberOptions(viewer);
  const canAll = viewer.can("work", "edit");
  const canUse = viewer.can("work", "use");
  const workers = canAll ? members : canUse ? members.filter((m) => m.id === viewer.member.id) : [];
  const canChange = (id: string) => canAll || (canUse && id === viewer.member.id);
  const member = typeof sp.member === "string" && members.some((m) => m.id === sp.member) ? sp.member : "";

  const [work, recentJobs, share, allPatterns, upcomingOff] = await Promise.all([
    workBetween(viewer, week, addDays(week, 6)),
    db.selectDistinct({ job: workShifts.job, date: workShifts.date }).from(workShifts).where(eq(workShifts.familyId, viewer.family.id)).orderBy(desc(workShifts.date)).limit(40),
    myWorkSharing(viewer),
    // Regular schedules still running (for the summary on each person's card).
    db.select().from(workPatterns).where(and(eq(workPatterns.familyId, viewer.family.id), or(isNull(workPatterns.endsOn), gte(workPatterns.endsOn, today)))),
    db.select().from(workTimeOff).where(and(eq(workTimeOff.familyId, viewer.family.id), gte(workTimeOff.endDate, today))).orderBy(workTimeOff.startDate).limit(100),
  ]);
  // Each person chooses who sees their schedule (workBetween already filters).
  const { shifts, timeOff, see } = work;
  const patterns = allPatterns.filter((p) => see.has(p.memberId));
  const comingOff = upcomingOff.filter((o) => see.has(o.memberId));
  const jobs = [...new Set([...patterns.map((p) => p.job), ...recentJobs.map((r) => r.job)].filter((j): j is string => !!j))].slice(0, 8);
  // People shown: anyone with shifts, a regular schedule or time off, plus yourself if you can add.
  const ids = [...new Set([...(canUse ? [viewer.member.id] : []), ...shifts.map((s) => s.memberId), ...patterns.map((p) => p.memberId), ...timeOff.map((o) => o.memberId)])];
  const people = members.filter((m) => ids.includes(m.id) && (!member || m.id === member));
  const href = (p: Record<string, string>) => `/work?${new URLSearchParams({ ...(member ? { member } : {}), week, ...p })}`;
  const everyone = members.filter((m) => ids.includes(m.id));

  return (
    <>
      <PageHeader help="work-schedules" eyebrow="Activities" title="Work schedules" description="Regular schedules, extra shifts and time off. Everything shows on the family calendar." actions={
          workers.length ? (
            <>
              <WorkSharingModal members={members.filter((m) => m.id !== viewer.member.id)} visibility={share.visibility} shared={share.memberIds} />
              <PatternModal workers={workers} defaultMember={member || viewer.member.id} jobs={jobs} today={today} />
              <TimeOffModal workers={workers} defaultMember={member || viewer.member.id} />
              <ShiftModal workers={workers} weekDays={days} defaultMember={member || viewer.member.id} jobs={jobs} defaultOpen={sp.new === "1"} />
            </>
          ) : undefined
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={href({ week: addDays(week, -7) })} aria-label="Previous week" className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface hover:bg-sunken">
          <ChevronLeft className="size-5" />
        </Link>
        <Link href={href({ week: addDays(week, 7) })} aria-label="Next week" className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface hover:bg-sunken">
          <ChevronRight className="size-5" />
        </Link>
        <h2 className="ml-1 text-xl font-semibold">
          {formatShortDate(week)} – {formatShortDate(addDays(week, 6))}
        </h2>
        {week !== startOfWeek(today, 1) && (
          <Link href={href({ week: startOfWeek(today, 1) })} className="text-sm font-medium text-primary-700 hover:underline">
            This week
          </Link>
        )}
      </div>
      {everyone.length > 1 && (
        <div className="mb-5">
          <SegmentLinks fit active={member || "all"} items={[{ key: "all", href: `/work?week=${week}`, label: "Everyone" }, ...everyone.map((m) => ({ key: m.id, href: `/work?member=${m.id}&week=${week}`, label: m.displayName.split(" ")[0]! }))]} />
        </div>
      )}

      {people.length === 0 ? (
        <Card>
          <EmptyState icon={<Briefcase />} title="No shifts this week" description="Set a regular schedule that repeats every week (like Mon–Fri, 9 to 5), add one-off shifts, and add time off for vacations and sick days." example="Mon–Fri · 9:00 AM – 5:00 PM · Office" />
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {people.map((m) => {
            const mine = shifts.filter((s) => s.memberId === m.id);
            return (
              <Card key={m.id} className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Avatar name={m.displayName} color={m.color} size="sm" />
                  <span className="font-semibold">{m.displayName}</span>
                  <span className="ml-auto text-sm text-muted">{shiftHours(mine)} hrs</span>
                </div>
                <ol className="flex flex-col divide-y divide-line">
                  {days.map((d) => {
                    const list = mine.filter((s) => s.date === d);
                    const off = offOn(timeOff, m.id, d);
                    return (
                      <li key={d} className={cn("flex gap-3 py-1.5 text-[15px]", d === today && "rounded-lg bg-primary-50/60 px-2 dark:bg-primary-950/30")}>
                        <span className="w-10 shrink-0 text-sm">
                          <span className="block font-semibold">{WEEKDAYS[new Date(`${d}T12:00:00Z`).getUTCDay()]!.slice(0, 3)}</span>
                          <span className="text-muted">{Number(d.slice(8))}</span>
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col">
                          {off && (
                            <span className="flex items-center gap-1 text-sm">
                              <span className="min-w-0 flex-1 font-medium text-olive-700">
                                {timeOffEmoji(off.kind)} {timeOffLabel(off)}
                              </span>
                              {canChange(m.id) && off.startDate === d && (
                                <>
                                  <TimeOffModal workers={workers} item={{ ...off, notes: off.notes ?? null }} />
                                  <DeleteButton action={deleteTimeOff} fields={{ id: off.id }} what="this time off" className="size-8" />
                                </>
                              )}
                            </span>
                          )}
                          {list.length === 0 ? (
                            !off && <span className="text-sm text-muted">Off</span>
                          ) : (
                            list.map((s) => (
                              <div key={s.id} className="flex items-center gap-1">
                                <span className="min-w-0 flex-1 leading-snug">
                                  <span className="font-medium tabular-nums">
                                    {fmtTime(s.startTime)} – {fmtTime(s.endTime)}
                                  </span>
                                  {s.patternId && <Repeat className="ml-1 inline size-3 text-muted" aria-label="Regular schedule" />}
                                  {s.job && <span className="text-muted"> · {s.job}</span>}
                                  {s.notes && <span className="block text-xs text-muted">{s.notes}</span>}
                                </span>
                                {canChange(m.id) &&
                                  (s.patternId ? (
                                    <ActionButton action={skipWorkDay} fields={{ memberId: m.id, date: d }} label="Not working this day" title="Not working this day" className="size-8 rounded-full text-muted hover:bg-sunken">
                                      <CalendarOff className="size-3.5" />
                                    </ActionButton>
                                  ) : (
                                    <>
                                      <ShiftModal workers={workers} weekDays={days} jobs={jobs} item={{ id: s.id, memberId: s.memberId, date: s.date, startTime: s.startTime, endTime: s.endTime, job: s.job, notes: s.notes }} />
                                      <DeleteButton action={deleteShift} fields={{ id: s.id }} what="this shift" className="size-8" />
                                    </>
                                  ))}
                              </div>
                            ))
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
                {patterns.filter((p) => p.memberId === m.id).map((p) => (
                  <div key={p.id} className="flex items-center gap-1 rounded-xl bg-sunken px-3 py-2 text-sm">
                    <Repeat className="size-4 shrink-0 text-muted" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">
                        {weekdaysText(p.weekdays)} · {fmtTime(p.startTime)} – {fmtTime(p.endTime)}
                      </span>
                      <span className="block text-xs text-muted">{[p.job, p.startsOn > today ? `Starts ${formatShortDate(p.startsOn)}` : null, p.endsOn ? `Until ${formatShortDate(p.endsOn)}` : "Every week"].filter(Boolean).join(" · ")}</span>
                    </span>
                    {canChange(m.id) && (
                      <>
                        <PatternModal workers={workers} jobs={jobs} today={today} item={p} />
                        <ActionButton action={endPattern} fields={{ id: p.id }} confirm="Stop this regular schedule? Past weeks stay as they were." label="End regular schedule" className="h-8 rounded-full px-2 text-xs text-muted hover:bg-sunken">
                          End
                        </ActionButton>
                      </>
                    )}
                  </div>
                ))}
                {comingOff.filter((o) => o.memberId === m.id).length > 0 && (
                  <div className="text-sm">
                    <p className="mb-1 font-medium text-muted">Upcoming time off</p>
                    <ul className="flex flex-col gap-1">
                      {comingOff
                        .filter((o) => o.memberId === m.id)
                        .slice(0, 5)
                        .map((o) => (
                          <li key={o.id} className="flex items-center gap-1">
                            <span className="min-w-0 flex-1">
                              {timeOffEmoji(o.kind)} {timeOffLabel(o)} · {formatShortDate(o.startDate)}
                              {o.endDate !== o.startDate ? ` – ${formatShortDate(o.endDate)}` : ""}
                            </span>
                            {canChange(m.id) && (
                              <>
                                <TimeOffModal workers={workers} item={o} />
                                <DeleteButton action={deleteTimeOff} fields={{ id: o.id }} what="this time off" className="size-8" />
                              </>
                            )}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
                {canChange(m.id) && (
                  <div className="flex flex-wrap gap-2">
                    {!patterns.some((p) => p.memberId === m.id) && <PatternModal workers={canAll ? workers : workers.filter((w) => w.id === m.id)} defaultMember={m.id} jobs={jobs} today={today} />}
                    <ShiftModal workers={canAll ? workers : workers.filter((w) => w.id === m.id)} weekDays={days} defaultMember={m.id} jobs={jobs} />
                    <TimeOffModal workers={canAll ? workers : workers.filter((w) => w.id === m.id)} defaultMember={m.id} />
                    <ActionButton action={copyLastWeek} fields={{ memberId: m.id, week }} className="h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-sm font-medium hover:bg-sunken">
                      <Copy className="size-4" /> Copy last week
                    </ActionButton>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
