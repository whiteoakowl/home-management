import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { ChevronRight, MapPin, Trophy } from "lucide-react";
import { db } from "@/db";
import { sportGames, sportPractices, sportTeams } from "@/db/schema";
import { TeamModal } from "@/components/sports/forms";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar, Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { SegmentLinks } from "@/components/ui/tabs";
import { getViewer } from "@/lib/dal";
import { classDates, fmtTime, WEEKDAYS } from "@/lib/dance";
import { addDays, formatShortDate, startOfWeek, todayIn } from "@/lib/dates";
import { memberOptions } from "@/lib/queries";
import { outcomeOf, record, sportDef } from "@/lib/sports";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Sports" };

const OUTCOME = { win: { label: "W", tone: "olive" }, loss: { label: "L", tone: "wine" }, tie: { label: "T", tone: "mist" } } as const;

export default async function SportsPage({ searchParams }: PageProps<"/sports">) {
  const viewer = await getViewer();
  if (!viewer.can("sports")) notFound();
  const sp = await searchParams;
  const today = todayIn(viewer.family.timezone);
  const fid = viewer.family.id;
  const members = await memberOptions(viewer);
  const canAll = viewer.can("sports", "edit");
  const canUse = viewer.can("sports", "use");
  const athletesForForms = canAll ? members : canUse ? members.filter((m) => m.id === viewer.member.id) : [];
  const member = typeof sp.member === "string" && members.some((m) => m.id === sp.member) ? sp.member : "";

  const teams = await db.select().from(sportTeams).where(eq(sportTeams.familyId, fid)).orderBy(desc(sportTeams.active), asc(sportTeams.name));
  const shown = member ? teams.filter((t) => t.memberId === member) : teams;
  const ids = shown.map((t) => t.id);
  const week = startOfWeek(today, 1);
  const weekEnd = addDays(week, 6);
  const [practices, upcoming, recent, allPlayed] = ids.length
    ? await Promise.all([
        db.select().from(sportPractices).where(inArray(sportPractices.teamId, ids)),
        db.select().from(sportGames).where(and(inArray(sportGames.teamId, ids), gte(sportGames.date, today))).orderBy(asc(sportGames.date), asc(sportGames.startTime)).limit(12),
        db.select().from(sportGames).where(and(inArray(sportGames.teamId, ids), lt(sportGames.date, today))).orderBy(desc(sportGames.date)).limit(8),
        db.select({ teamId: sportGames.teamId, ourScore: sportGames.ourScore, theirScore: sportGames.theirScore, outcome: sportGames.outcome }).from(sportGames).where(inArray(sportGames.teamId, ids)),
      ])
    : [[], [], [], []];

  const teamOf = (id: string) => teams.find((t) => t.id === id)!;
  const nameOf = (id: string) => members.find((m) => m.id === id);
  const athleteIds = [...new Set(teams.map((t) => t.memberId))];
  const athletes = members.filter((m) => athleteIds.includes(m.id));

  // This week: practices + games, day by day.
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  type Item = { time: string; title: string; teamId: string; where: string | null; game: boolean };
  const byDay = new Map<string, Item[]>();
  const push = (d: string, it: Item) => (byDay.get(d) ?? byDay.set(d, []).get(d)!).push(it);
  for (const p of practices) {
    const t = teamOf(p.teamId);
    if (!t.active) continue;
    for (const d of classDates({ memberId: t.memberId, weekday: p.weekday, startsOn: p.startsOn, endsOn: p.endsOn }, week, weekEnd, [])) push(d, { time: p.startTime, title: `${t.name} practice`, teamId: t.id, where: p.location, game: false });
  }
  for (const g of upcoming) if (g.date <= weekEnd) push(g.date, { time: g.arriveTime ?? g.startTime ?? "00:00", title: g.opponent ? `vs ${g.opponent}` : teamOf(g.teamId).name, teamId: g.teamId, where: g.location, game: true });

  const action = canUse ? <TeamModal athletes={athletesForForms} /> : undefined;

  return (
    <>
      <PageHeader help="sports" eyebrow="Activities" title="Sports" description="Teams, practices, games and stats for every athlete in the family. Practices and games show on the family calendar." actions={action} />
      {athletes.length > 1 && (
        <div className="mb-5">
          <SegmentLinks fit active={member || "all"} items={[{ key: "all", href: "/sports", label: "Everyone" }, ...athletes.map((m) => ({ key: m.id, href: `/sports?member=${m.id}`, label: m.displayName.split(" ")[0]! }))]} />
        </div>
      )}

      {!teams.length ? (
        <Card>
          <EmptyState icon={<Trophy />} title="Add your first team" description="Add a team for each athlete, then their weekly practices and games. Keep score, track stats game by game, and see season totals." example="Liam · U12 Thunder soccer · Tue & Thu 5:30 PM" action={action} />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader title="This week" />
              <ol className="flex flex-col divide-y divide-line">
                {days.map((d) => {
                  const items = (byDay.get(d) ?? []).sort((a, b) => a.time.localeCompare(b.time));
                  return (
                    <li key={d} className={cn("flex gap-3 py-2.5", d === today && "rounded-xl bg-primary-50/60 px-2 dark:bg-primary-950/30")}>
                      <span className="w-12 shrink-0 text-sm">
                        <span className="block font-semibold">{WEEKDAYS[new Date(`${d}T12:00:00Z`).getUTCDay()]!.slice(0, 3)}</span>
                        <span className="text-muted">{Number(d.slice(8))}</span>
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        {items.length === 0 && <span className="text-sm text-muted">—</span>}
                        {items.map((it, i) => {
                          const t = teamOf(it.teamId);
                          const m = nameOf(t.memberId);
                          return (
                            <Link key={i} href={`/sports/${t.id}`} className={cn("flex items-center gap-2 text-[15px] hover:underline", it.game && "font-semibold")}>
                              {m && <Avatar name={m.displayName} color={m.color} size="xs" />}
                              <span className="w-16 shrink-0 text-sm text-muted tabular-nums">{it.time !== "00:00" ? fmtTime(it.time) : ""}</span>
                              <span className="min-w-0 flex-1 leading-snug">
                                {sportDef(t.sport).emoji} {it.title}
                                {it.where && <span className="block text-xs font-normal text-muted">{it.where}</span>}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>

            <Card>
              <CardHeader title="Upcoming games & events" icon={<Trophy className="size-4" />} />
              {upcoming.length ? (
                <ul className="flex flex-col gap-2">
                  {upcoming.map((g) => {
                    const t = teamOf(g.teamId);
                    const m = nameOf(t.memberId);
                    return (
                      <li key={g.id}>
                        <Link href={`/sports/${t.id}`} className="flex items-center gap-3 rounded-2xl border border-line p-3 hover:bg-sunken">
                          {m && <Avatar name={m.displayName} color={m.color} size="sm" />}
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold">
                              {sportDef(t.sport).emoji} {g.opponent ? `${g.homeAway === "away" ? "@" : "vs"} ${g.opponent}` : t.name}
                            </span>
                            <span className="block text-sm text-muted">
                              {formatShortDate(g.date)}
                              {g.arriveTime ? ` · arrive ${fmtTime(g.arriveTime)}` : ""}
                              {g.startTime ? ` · ${fmtTime(g.startTime)}` : ""} · {t.name}
                            </span>
                            {g.location && (
                              <span className="flex items-center gap-1 text-xs text-muted">
                                <MapPin className="size-3" aria-hidden /> {g.location}
                              </span>
                            )}
                          </span>
                          <ChevronRight className="size-4 text-muted" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted">Nothing scheduled. Open a team to add games.</p>
              )}
            </Card>
          </div>

          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader title="Teams" />
              <ul className="flex flex-col gap-2">
                {shown.map((t) => {
                  const m = nameOf(t.memberId);
                  const def = sportDef(t.sport);
                  const rec = record(allPlayed.filter((g) => g.teamId === t.id));
                  return (
                    <li key={t.id}>
                      <Link href={`/sports/${t.id}`} className={cn("flex items-center gap-3 rounded-2xl border border-line p-3 hover:bg-sunken", !t.active && "opacity-60")}>
                        <span className="text-2xl" aria-hidden>
                          {def.emoji}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{t.name}</span>
                          <span className="block text-sm text-muted">
                            {m?.displayName.split(" ")[0]} · {t.sport === "other" && t.sportName ? t.sportName : def.label}
                            {t.season ? ` · ${t.season}` : ""}
                            {!t.active ? " · past" : ""}
                          </span>
                        </span>
                        {rec.w + rec.l + rec.t > 0 && <Badge tone="primary">{rec.text}</Badge>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>

            {recent.length > 0 && (
              <Card>
                <CardHeader title="Recent results" />
                <ul className="flex flex-col divide-y divide-line">
                  {recent.map((g) => {
                    const t = teamOf(g.teamId);
                    const o = outcomeOf(g);
                    return (
                      <li key={g.id} className="flex items-center gap-2 py-2 text-sm">
                        {o ? <Badge tone={OUTCOME[o].tone}>{OUTCOME[o].label}</Badge> : <Badge>—</Badge>}
                        <Link href={`/sports/${t.id}`} className="min-w-0 flex-1 hover:underline">
                          {t.name} {g.opponent ? `vs ${g.opponent}` : ""}
                        </Link>
                        {g.ourScore != null && g.theirScore != null && (
                          <span className="font-semibold tabular-nums">
                            {g.ourScore}–{g.theirScore}
                          </span>
                        )}
                        <span className="text-muted">{formatShortDate(g.date)}</span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}
    </>
  );
}
