import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { Briefcase, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { db } from "@/db";
import { workShifts } from "@/db/schema";
import { copyLastWeek, deleteShift } from "@/app/actions/work";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { ShiftModal } from "@/components/work/shift-form";
import { Card } from "@/components/ui/card";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/display";
import { SegmentLinks } from "@/components/ui/tabs";
import { getViewer } from "@/lib/dal";
import { fmtTime, shiftHours, WEEKDAYS } from "@/lib/dance";
import { addDays, formatShortDate, startOfWeek, todayIn } from "@/lib/dates";
import { memberOptions } from "@/lib/queries";
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

  const [shifts, recentJobs] = await Promise.all([
    db.select().from(workShifts).where(and(eq(workShifts.familyId, viewer.family.id), gte(workShifts.date, week), lte(workShifts.date, addDays(week, 6)))).orderBy(asc(workShifts.date), asc(workShifts.startTime)),
    db.selectDistinct({ job: workShifts.job, date: workShifts.date }).from(workShifts).where(eq(workShifts.familyId, viewer.family.id)).orderBy(desc(workShifts.date)).limit(40),
  ]);
  const jobs = [...new Set(recentJobs.map((r) => r.job).filter((j): j is string => !!j))].slice(0, 8);
  // People shown: anyone with shifts this week, plus yourself if you can add.
  const ids = [...new Set([...(canUse ? [viewer.member.id] : []), ...shifts.map((s) => s.memberId)])];
  const people = members.filter((m) => ids.includes(m.id) && (!member || m.id === member));
  const href = (p: Record<string, string>) => `/work?${new URLSearchParams({ ...(member ? { member } : {}), week, ...p })}`;
  const everyone = members.filter((m) => ids.includes(m.id));

  return (
    <>
      <PageHeader eyebrow="Activities" title="Work schedules" description="Everyone's shifts, week by week. They show on the family calendar." actions={workers.length ? <ShiftModal workers={workers} weekDays={days} defaultMember={member || viewer.member.id} jobs={jobs} defaultOpen={sp.new === "1"} /> : undefined} />
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
          <EmptyState icon={<Briefcase />} title="No shifts this week" description="Add work shifts for the week. Schedules can change every week; use Copy last week to start from the previous one." example="Mon, Wed, Fri · 9:00 AM – 5:30 PM · Café" />
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
                    return (
                      <li key={d} className={cn("flex gap-3 py-1.5 text-[15px]", d === today && "rounded-lg bg-primary-50/60 px-2 dark:bg-primary-950/30")}>
                        <span className="w-10 shrink-0 text-sm">
                          <span className="block font-semibold">{WEEKDAYS[new Date(`${d}T12:00:00Z`).getUTCDay()]!.slice(0, 3)}</span>
                          <span className="text-muted">{Number(d.slice(8))}</span>
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col">
                          {list.length === 0 ? (
                            <span className="text-sm text-muted">Off</span>
                          ) : (
                            list.map((s) => (
                              <div key={s.id} className="flex items-center gap-1">
                                <span className="min-w-0 flex-1 leading-snug">
                                  <span className="font-medium tabular-nums">
                                    {fmtTime(s.startTime)} – {fmtTime(s.endTime)}
                                  </span>
                                  {s.job && <span className="text-muted"> · {s.job}</span>}
                                  {s.notes && <span className="block text-xs text-muted">{s.notes}</span>}
                                </span>
                                {canChange(m.id) && (
                                  <>
                                    <ShiftModal workers={workers} weekDays={days} jobs={jobs} item={{ id: s.id, memberId: s.memberId, date: s.date, startTime: s.startTime, endTime: s.endTime, job: s.job, notes: s.notes }} />
                                    <DeleteButton action={deleteShift} fields={{ id: s.id }} what="this shift" className="size-8" />
                                  </>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
                {canChange(m.id) && (
                  <div className="flex flex-wrap gap-2">
                    <ShiftModal workers={canAll ? workers : workers.filter((w) => w.id === m.id)} weekDays={days} defaultMember={m.id} jobs={jobs} />
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
