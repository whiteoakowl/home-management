import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, gte } from "drizzle-orm";
import { CalendarOff, Camera, ChevronLeft, ChevronRight, Clock, ExternalLink, Footprints, MapPin, Megaphone, Music, Star, Trophy } from "lucide-react";
import { db } from "@/db";
import { danceClasses, danceDaysOff, danceEnrollments, danceEvents } from "@/db/schema";
import { deleteDanceClass, deleteDanceEvent, deleteDayOff, deleteEnrollment } from "@/app/actions/dance";
import { DanceClassModal, DanceEventModal, DayOffModal, EnrollmentModal } from "@/components/dance/forms";
import { DeleteButton } from "@/components/forms/inline";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar, Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { SegmentLinks } from "@/components/ui/tabs";
import { getViewer } from "@/lib/dal";
import { classDates, dayOffFor, fmtTime, WEEKDAYS } from "@/lib/dance";
import { pointeSummary, reorderText } from "@/lib/pointe";
import { addDays, formatShortDate, startOfWeek, todayIn } from "@/lib/dates";
import { memberOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dance" };

const KIND_LABEL: Record<string, string> = { performance: "Performance", competition: "Competition", recital: "Recital", rehearsal: "Dress rehearsal", audition: "Audition", photos: "Picture day", other: "Event" };
const usd = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;

export default async function DancePage({ searchParams }: PageProps<"/dance">) {
  const viewer = await getViewer();
  if (!viewer.can("dance")) notFound();
  const sp = await searchParams;
  const today = todayIn(viewer.family.timezone);
  const fid = viewer.family.id;
  const members = await memberOptions(viewer);
  const canAll = viewer.can("dance", "edit");
  const canUse = viewer.can("dance", "use");
  // Who this viewer can add for: everyone (Add & edit) or just themselves (Use).
  const dancersForForms = canAll ? members : canUse ? members.filter((m) => m.id === viewer.member.id) : [];
  const canChange = (memberId: string | null) => canAll || (canUse && memberId === viewer.member.id);
  const member = typeof sp.member === "string" && members.some((m) => m.id === sp.member) ? sp.member : "";
  const week = startOfWeek(typeof sp.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : today, 1);
  const weekEnd = addDays(week, 6);

  const [enrollments, classes, daysOff, events] = await Promise.all([
    db.select().from(danceEnrollments).where(eq(danceEnrollments.familyId, fid)).orderBy(asc(danceEnrollments.name)),
    db.select().from(danceClasses).where(eq(danceClasses.familyId, fid)).orderBy(asc(danceClasses.weekday), asc(danceClasses.startTime)),
    db.select().from(danceDaysOff).where(and(eq(danceDaysOff.familyId, fid), gte(danceDaysOff.endDate, addDays(today, -60)))).orderBy(asc(danceDaysOff.startDate)),
    db.select().from(danceEvents).where(and(eq(danceEvents.familyId, fid), gte(danceEvents.date, addDays(today, -1)))).orderBy(asc(danceEvents.date)),
  ]);
  const forMember = <T extends { memberId: string | null }>(rows: T[]) => (member ? rows.filter((r) => r.memberId === member || r.memberId === null) : rows);
  const myClasses = member ? classes.filter((c) => c.memberId === member) : classes;
  const myEvents = member ? events.filter((e) => e.memberIds.includes(member)) : events;
  const dancerIds = [...new Set([...enrollments.map((e) => e.memberId), ...classes.map((c) => c.memberId), ...events.flatMap((e) => e.memberIds)])];
  const dancers = members.filter((m) => dancerIds.includes(m.id));
  const nameOf = (id: string) => members.find((m) => m.id === id);
  const href = (p: Record<string, string>) => `/dance?${new URLSearchParams({ ...(member ? { member } : {}), week, ...p })}`;

  // This week, day by day.
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const offRules = daysOff.map((d) => ({ memberId: d.memberId, startDate: d.startDate, endDate: d.endDate, title: d.title }));
  const byDay = new Map<string, { time: string; title: string; who: string; where: string | null; kind: "class" | "event"; ev?: (typeof events)[number] }[]>();
  for (const c of myClasses) {
    for (const d of classDates({ memberId: c.memberId, weekday: c.weekday, startsOn: c.startsOn, endsOn: c.endsOn }, week, weekEnd, offRules)) {
      (byDay.get(d) ?? byDay.set(d, []).get(d)!).push({ time: c.startTime, title: c.title, who: c.memberId, where: c.location, kind: "class" });
    }
  }
  for (const e of myEvents) if (e.date >= week && e.date <= weekEnd) (byDay.get(e.date) ?? byDay.set(e.date, []).get(e.date)!).push({ time: e.callTime ?? e.startTime ?? "00:00", title: e.title, who: e.memberIds[0] ?? "", where: e.location, kind: "event", ev: e });

  const hasAny = enrollments.length + classes.length + events.length > 0;
  const upcomingCost = myEvents.reduce((sum, e) => sum + (e.costCents ?? 0), 0);
  // Pointe shoes: who needs to order a new pair, and when.
  const pointe = await pointeSummary(viewer, member ? [member] : null, today);
  const actions = canUse ? (
    <>
      <DanceClassModal dancers={dancersForForms} enrollments={enrollments.filter((e) => e.active)} defaultMember={member || undefined} defaultOpen={sp.new === "1"} />
      <DanceEventModal dancers={dancersForForms} defaultMember={member || undefined} />
      <DayOffModal dancers={dancersForForms} canAll={canAll} />
      <EnrollmentModal dancers={dancersForForms} defaultMember={member || undefined} />
    </>
  ) : undefined;

  return (
    <>
      <PageHeader help="dance" eyebrow="Activities" title="Dance" description="Classes, teams and levels, days off and performances for each dancer. Everything shows on the family calendar." actions={actions} />
      {dancers.length > 0 && (
        <div className="mb-5">
          <SegmentLinks fit active={member || "all"} items={[{ key: "all", href: `/dance?week=${week}`, label: "Everyone" }, ...dancers.map((m) => ({ key: m.id, href: `/dance?member=${m.id}&week=${week}`, label: m.displayName.split(" ")[0]! }))]} />
        </div>
      )}

      {!hasAny ? (
        <Card>
          <EmptyState icon={<Music />} title="Set up the dance schedule" description="Add each dancer's teams or levels, their weekly classes, days off and upcoming performances. Classes repeat every week and show on the calendar." example="Serenity · Junior Competition Team · Tue & Thu 4:30–6:00 PM" action={canUse ? <DanceClassModal dancers={dancersForForms} enrollments={enrollments.filter((e) => e.active)} defaultMember={member || undefined} /> : undefined} />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col gap-6">
            <Card>
              <div className="mb-3 flex items-center gap-2">
                <Link href={href({ week: addDays(week, -7) })} aria-label="Previous week" className="inline-flex size-9 items-center justify-center rounded-full border border-line hover:bg-sunken">
                  <ChevronLeft className="size-4" />
                </Link>
                <Link href={href({ week: addDays(week, 7) })} aria-label="Next week" className="inline-flex size-9 items-center justify-center rounded-full border border-line hover:bg-sunken">
                  <ChevronRight className="size-4" />
                </Link>
                <h2 className="ml-1 text-lg font-semibold">Week of {formatShortDate(week)}</h2>
                {week !== startOfWeek(today, 1) && (
                  <Link href={href({ week: startOfWeek(today, 1) })} className="ml-auto text-sm font-medium text-primary-700 hover:underline">
                    This week
                  </Link>
                )}
              </div>
              <ol className="flex flex-col divide-y divide-line">
                {days.map((d) => {
                  const items = (byDay.get(d) ?? []).sort((a, b) => a.time.localeCompare(b.time));
                  const off = forMember(daysOff).filter((o) => d >= o.startDate && d <= o.endDate);
                  return (
                    <li key={d} className={cn("flex gap-3 py-2.5", d === today && "rounded-xl bg-primary-50/60 px-2 dark:bg-primary-950/30")}>
                      <span className="w-12 shrink-0 text-sm">
                        <span className="block font-semibold">{WEEKDAYS[new Date(`${d}T12:00:00Z`).getUTCDay()]!.slice(0, 3)}</span>
                        <span className="text-muted">{Number(d.slice(8))}</span>
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        {off.map((o) => (
                          <span key={o.id} className="inline-flex w-fit items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
                            <CalendarOff className="size-3" aria-hidden /> {o.title}
                            {o.memberId ? ` · ${nameOf(o.memberId)?.displayName.split(" ")[0] ?? ""}` : ""}
                          </span>
                        ))}
                        {items.length === 0 && !off.length && <span className="text-sm text-muted">—</span>}
                        {items.map((it, i) => {
                          const m = nameOf(it.who);
                          return (
                            <div key={i} className={cn("flex items-center gap-2 text-[15px]", it.kind === "event" && "font-semibold")}>
                              {m && <Avatar name={m.displayName} color={m.color} size="xs" />}
                              <span className="w-16 shrink-0 text-sm text-muted tabular-nums">{it.time !== "00:00" ? fmtTime(it.time) : ""}</span>
                              <span className="min-w-0 flex-1 leading-snug">
                                {it.kind === "event" && <Trophy className="mr-1 inline size-3.5 text-amber-600" aria-hidden />}
                                {it.title}
                                {it.ev?.callTime && <span className="text-sm font-normal text-muted"> · call {fmtTime(it.ev.callTime)}</span>}
                                {it.where && <span className="block text-xs font-normal text-muted">{it.where}</span>}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>

            <Card>
              <CardHeader
                title="Performances, auditions & picture days"
                icon={<Trophy className="size-4" />}
                action={
                  canUse ? (
                    <span className="flex flex-wrap gap-1">
                      <DanceEventModal dancers={dancersForForms} defaultMember={member || undefined} defaultKind="audition" triggerLabel="Audition" triggerIcon={<Megaphone className="size-4" />} />
                      <DanceEventModal dancers={dancersForForms} defaultMember={member || undefined} defaultKind="photos" triggerLabel="Picture day" triggerIcon={<Camera className="size-4" />} />
                    </span>
                  ) : undefined
                }
              />
              {upcomingCost > 0 && (
                <p className="-mt-1 mb-3 text-sm text-muted">
                  Coming up: <strong className="text-ink tabular-nums">{usd(upcomingCost)}</strong> in costs
                </p>
              )}
              {myEvents.length ? (
                <ul className="flex flex-col gap-3">
                  {myEvents.map((e) => (
                    <li key={e.id} className="rounded-2xl border border-line p-3">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{e.title}</p>
                          <p className="text-sm text-muted">
                            <Badge tone="mist">{KIND_LABEL[e.kind] ?? "Event"}</Badge> {formatShortDate(e.date)}
                            {e.endDate && e.endDate !== e.date ? `–${formatShortDate(e.endDate)}` : ""}
                            {e.callTime ? ` · call ${fmtTime(e.callTime)}` : ""}
                            {e.startTime ? ` · ${fmtTime(e.startTime)}${e.endTime ? `–${fmtTime(e.endTime)}` : ""}` : ""}
                          </p>
                          {e.location && (
                            <p className="flex items-center gap-1 text-sm text-muted">
                              <MapPin className="size-3.5" aria-hidden /> {e.location}
                            </p>
                          )}
                          <p className="mt-1 flex flex-wrap gap-1">
                            {e.memberIds.map((id) => {
                              const m = nameOf(id);
                              return m ? <Badge key={id}>{m.displayName.split(" ")[0]}</Badge> : null;
                            })}
                          </p>
                          {e.details && <p className="mt-1.5 text-sm whitespace-pre-line text-ink-soft">{e.details}</p>}
                          {(e.costCents != null || e.ticketCents != null || e.link) && (
                            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                              {e.costCents != null && (
                                <span>
                                  <span className="text-muted">Cost</span> <strong className="tabular-nums">{usd(e.costCents)}</strong>
                                </span>
                              )}
                              {e.ticketCents != null && (
                                <span>
                                  <span className="text-muted">Tickets</span> <strong className="tabular-nums">{usd(e.ticketCents)}</strong> <span className="text-muted">each</span>
                                </span>
                              )}
                              {e.link && (
                                <a href={e.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary-700 hover:underline">
                                  <ExternalLink className="size-3.5" aria-hidden /> {e.kind === "audition" ? "Sign-up / info" : "Tickets / info"}
                                </a>
                              )}
                            </p>
                          )}
                        </div>
                        {e.memberIds.every((id) => canChange(id)) && (
                          <span className="flex">
                            <DanceEventModal dancers={dancersForForms} item={{ id: e.id, memberIds: e.memberIds, kind: e.kind, title: e.title, date: e.date, endDate: e.endDate, callTime: e.callTime, startTime: e.startTime, endTime: e.endTime, location: e.location, details: e.details, costCents: e.costCents, ticketCents: e.ticketCents, link: e.link }} />
                            <DeleteButton action={deleteDanceEvent} fields={{ id: e.id }} what={e.title} className="size-9" />
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Nothing coming up. Add recitals, competitions, auditions, dress rehearsals and picture days.</p>
              )}
            </Card>
          </div>

          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader title="Pointe shoes" icon={<Footprints className="size-4" />} href={member ? `/dance/pointe?member=${member}` : "/dance/pointe"} hrefLabel="Open" />
              {pointe.length ? (
                <ul className="flex flex-col divide-y divide-line">
                  {pointe.map((p) => {
                    const m = nameOf(p.memberId);
                    return (
                      <li key={p.memberId} className="flex items-center gap-2 py-2">
                        {m && <Avatar name={m.displayName} color={m.color} size="xs" />}
                        <span className="min-w-0 flex-1 text-[15px]">
                          <span className="font-medium">{m?.displayName.split(" ")[0]}</span>
                          <span className="block text-xs text-muted">{[p.inUse && `wearing ${p.inUse}`, p.spares ? `${p.spares} spare${p.spares === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ") || "No pairs on hand"}</span>
                        </span>
                        <Badge tone={p.due.status === "now" ? "wine" : p.due.status === "soon" ? "olive" : "mist"}>{reorderText(p.due, today)}</Badge>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted">Track each pair: brand, size, shank, wings, price, when it was bought, worn and died, and when to order the next one.</p>
              )}
            </Card>
            <Card>
              <CardHeader title="Teams & levels" icon={<Star className="size-4" />} />
              {(member ? enrollments.filter((e) => e.memberId === member) : enrollments).length ? (
                <ul className="flex flex-col divide-y divide-line">
                  {(member ? enrollments.filter((e) => e.memberId === member) : enrollments).map((e) => {
                    const m = nameOf(e.memberId);
                    return (
                      <li key={e.id} className={cn("flex items-center gap-2 py-2", !e.active && "opacity-60")}>
                        {m && <Avatar name={m.displayName} color={m.color} size="xs" />}
                        <span className="min-w-0 flex-1">
                          <span className="font-medium">{e.name}</span>
                          <span className="block text-xs text-muted">{[e.kind[0]!.toUpperCase() + e.kind.slice(1), e.level, e.style, e.studio, e.season, e.active ? null : "past"].filter(Boolean).join(" · ")}</span>
                        </span>
                        {canChange(e.memberId) && (
                          <>
                            <EnrollmentModal dancers={dancersForForms} item={{ id: e.id, memberId: e.memberId, name: e.name, kind: e.kind, level: e.level, studio: e.studio, style: e.style, season: e.season, active: e.active, notes: e.notes }} />
                            <DeleteButton action={deleteEnrollment} fields={{ id: e.id }} what={e.name} className="size-9" />
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted">Add teams, levels or companies. A dancer can have several.</p>
              )}
            </Card>

            <Card>
              <CardHeader title="Weekly classes" icon={<Clock className="size-4" />} />
              {myClasses.length ? (
                <ul className="flex flex-col divide-y divide-line">
                  {myClasses.map((c) => {
                    const m = nameOf(c.memberId);
                    const enr = enrollments.find((e) => e.id === c.enrollmentId);
                    const ended = c.endsOn && c.endsOn < today;
                    return (
                      <li key={c.id} className={cn("flex items-center gap-2 py-2", ended && "opacity-60")}>
                        {m && <Avatar name={m.displayName} color={m.color} size="xs" />}
                        <span className="min-w-0 flex-1">
                          <span className="font-medium">{c.title}</span>
                          <span className="block text-xs text-muted">
                            {WEEKDAYS[c.weekday]} {fmtTime(c.startTime)}
                            {c.endTime ? `–${fmtTime(c.endTime)}` : ""}
                            {enr ? ` · ${enr.name}` : ""}
                            {c.location ? ` · ${c.location}` : ""}
                            {c.endsOn ? ` · until ${formatShortDate(c.endsOn)}` : ""}
                          </span>
                        </span>
                        {canChange(c.memberId) && (
                          <>
                            <DanceClassModal dancers={dancersForForms} enrollments={enrollments} item={{ id: c.id, memberId: c.memberId, enrollmentId: c.enrollmentId, title: c.title, weekday: c.weekday, startTime: c.startTime, endTime: c.endTime, location: c.location, startsOn: c.startsOn, endsOn: c.endsOn, notes: c.notes }} />
                            <DeleteButton action={deleteDanceClass} fields={{ id: c.id }} what={`${c.title} on ${WEEKDAYS[c.weekday]}`} className="size-9" />
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted">Add each weekly class or rehearsal once; it repeats every week.</p>
              )}
            </Card>

            <Card>
              <CardHeader title="Days off & holidays" icon={<CalendarOff className="size-4" />} />
              {forMember(daysOff).filter((d) => d.endDate >= today).length ? (
                <ul className="flex flex-col divide-y divide-line">
                  {forMember(daysOff)
                    .filter((d) => d.endDate >= today)
                    .map((d) => (
                      <li key={d.id} className="flex items-center gap-2 py-2">
                        <span className="min-w-0 flex-1">
                          <span className="font-medium">{d.title}</span>
                          <span className="block text-xs text-muted">
                            {formatShortDate(d.startDate)}
                            {d.endDate !== d.startDate ? `–${formatShortDate(d.endDate)}` : ""} · {d.memberId ? (nameOf(d.memberId)?.displayName ?? "") : "Everyone"}
                          </span>
                        </span>
                        {(d.memberId ? canChange(d.memberId) : canAll) && (
                          <>
                            <DayOffModal dancers={dancersForForms} canAll={canAll} item={{ id: d.id, memberId: d.memberId, title: d.title, startDate: d.startDate, endDate: d.endDate }} />
                            <DeleteButton action={deleteDayOff} fields={{ id: d.id }} what={d.title} className="size-9" />
                          </>
                        )}
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Add breaks, holidays and studio closures; classes are skipped on those days.</p>
              )}
            </Card>
          </div>
        </div>
      )}
      {dayOffFor(today, viewer.member.id, offRules) && <p className="sr-only">Today is a day off.</p>}
    </>
  );
}
