import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { ArrowLeft, CalendarDays, MapPin, Repeat, Trash2, Trophy, User } from "lucide-react";
import { db } from "@/db";
import { sportGames, sportPractices, sportStatLines, sportTeams } from "@/db/schema";
import { deleteGame, deletePractice, deleteTeam } from "@/app/actions/sports";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { GameModal, PracticeModal, StatsModal, TeamModal } from "@/components/sports/forms";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar, Badge, PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { fmtTime, WEEKDAYS } from "@/lib/dance";
import { formatShortDate, todayIn } from "@/lib/dates";
import { memberOptions } from "@/lib/queries";
import { battingAverage, formatTime, outcomeOf, record, seasonLine, sportDef, teamStats, type StatDef } from "@/lib/sports";

export const metadata: Metadata = { title: "Team" };

const OUTCOME = { win: { label: "Win", tone: "olive" }, loss: { label: "Loss", tone: "wine" }, tie: { label: "Tie", tone: "mist" } } as const;
const KIND: Record<string, string> = { game: "Game", tournament: "Tournament", meet: "Meet", scrimmage: "Scrimmage", tryout: "Tryout", other: "Event" };

const show = (d: StatDef, v: number | null | undefined) => (v == null ? "—" : d.kind === "time" ? formatTime(v) : String(Math.round(v * 100) / 100));

export default async function TeamPage({ params }: PageProps<"/sports/[teamId]">) {
  const viewer = await getViewer();
  if (!viewer.can("sports")) notFound();
  const { teamId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(teamId)) notFound();
  const [team] = await db.select().from(sportTeams).where(and(eq(sportTeams.id, teamId), eq(sportTeams.familyId, viewer.family.id)));
  if (!team) notFound();
  const today = todayIn(viewer.family.timezone);
  const members = await memberOptions(viewer);
  const athlete = members.find((m) => m.id === team.memberId);
  const canChange = viewer.can("sports", "edit") || (viewer.can("sports", "use") && team.memberId === viewer.member.id);

  const [practices, games] = await Promise.all([
    db.select().from(sportPractices).where(eq(sportPractices.teamId, team.id)).orderBy(asc(sportPractices.weekday), asc(sportPractices.startTime)),
    db.select().from(sportGames).where(eq(sportGames.teamId, team.id)).orderBy(asc(sportGames.date), asc(sportGames.startTime)),
  ]);
  const lines = games.length ? await db.select().from(sportStatLines).where(and(inArray(sportStatLines.gameId, games.map((g) => g.id)), eq(sportStatLines.memberId, team.memberId))) : [];
  const lineFor = (gameId: string) => lines.find((l) => l.gameId === gameId);

  const def = sportDef(team.sport);
  const defs = teamStats(team.sport, team.customStats);
  const upcoming = games.filter((g) => g.date >= today);
  const played = games.filter((g) => g.date < today).reverse();
  const rec = record(games);
  const season = seasonLine(defs, lines.map((l) => l.stats));
  const avg = team.sport === "baseball" ? battingAverage(lines.map((l) => l.stats)) : null;
  const first = athlete?.displayName.split(" ")[0] ?? "Athlete";
  const sportLabel = team.sport === "other" && team.sportName ? team.sportName : def.label;

  const teamDefaults = {
    id: team.id,
    memberId: team.memberId,
    sport: team.sport,
    sportName: team.sportName,
    name: team.name,
    season: team.season,
    league: team.league,
    position: team.position,
    jerseyNumber: team.jerseyNumber,
    coach: team.coach,
    coachContact: team.coachContact,
    customStats: team.customStats,
    notes: team.notes,
  };

  const gameRow = (g: (typeof games)[number], past: boolean) => {
    const o = outcomeOf(g);
    const line = lineFor(g.id);
    return (
      <li key={g.id} className="rounded-2xl border border-line p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {g.opponent ? `${g.homeAway === "away" ? "@" : "vs"} ${g.opponent}` : KIND[g.kind]}{" "}
              {o && <Badge tone={OUTCOME[o].tone}>{OUTCOME[o].label}</Badge>}{" "}
              {g.ourScore != null && g.theirScore != null && (
                <span className="tabular-nums">
                  {g.ourScore}–{g.theirScore}
                </span>
              )}
            </p>
            <p className="text-sm text-muted">
              <Badge tone="mist">{KIND[g.kind]}</Badge> {formatShortDate(g.date)}
              {g.arriveTime ? ` · arrive ${fmtTime(g.arriveTime)}` : ""}
              {g.startTime ? ` · starts ${fmtTime(g.startTime)}` : ""}
              {g.homeAway ? ` · ${g.homeAway}` : ""}
            </p>
            {g.location && (
              <p className="flex items-center gap-1 text-sm text-muted">
                <MapPin className="size-3.5" aria-hidden /> {g.location}
              </p>
            )}
            {g.details && <p className="mt-1 text-sm whitespace-pre-line text-ink-soft">{g.details}</p>}
            {g.notes && <p className="mt-1 text-sm whitespace-pre-line text-ink-soft">{g.notes}</p>}
            {line && Object.keys(line.stats).length > 0 && (
              <p className="mt-1.5 flex flex-wrap gap-1">
                {defs
                  .filter((d) => line.stats[d.key] != null)
                  .map((d) => (
                    <Badge key={d.key} tone="primary">
                      {d.short} {show(d, line.stats[d.key])}
                    </Badge>
                  ))}
              </p>
            )}
            {line?.note && <p className="mt-1 text-sm text-muted italic">{line.note}</p>}
          </div>
          {canChange && (
            <span className="flex shrink-0 items-center gap-1">
              {past && <StatsModal teamId={team.id} gameId={g.id} athlete={first} defs={defs} values={line?.stats ?? {}} note={line?.note ?? null} />}
              <GameModal teamId={team.id} scoring={def.scoring} today={today} item={{ ...g }} />
              <DeleteButton action={deleteGame} fields={{ id: g.id, teamId: team.id }} what="this game" />
            </span>
          )}
        </div>
      </li>
    );
  };

  return (
    <>
      <Link href="/sports" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline">
        <ArrowLeft className="size-4" /> All sports
      </Link>
      <PageHeader
        eyebrow={`${def.emoji} ${sportLabel}${team.season ? ` · ${team.season}` : ""}`}
        title={team.name}
        description={[first, team.position, team.jerseyNumber ? `#${team.jerseyNumber}` : null, team.league].filter(Boolean).join(" · ")}
        actions={
          canChange ? (
            <>
              <GameModal teamId={team.id} scoring={def.scoring} today={today} />
              <PracticeModal teamId={team.id} />
              <TeamModal athletes={[]} item={teamDefaults} />
            </>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Coming up" icon={<CalendarDays className="size-4" />} />
            {upcoming.length ? <ul className="flex flex-col gap-3">{upcoming.map((g) => gameRow(g, g.date <= today))}</ul> : <p className="text-sm text-muted">No games scheduled yet.</p>}
          </Card>
          <Card>
            <CardHeader title="Results & stats" icon={<Trophy className="size-4" />} />
            {played.length ? <ul className="flex flex-col gap-3">{played.map((g) => gameRow(g, true))}</ul> : <p className="text-sm text-muted">Played games show here. Add the score and {first}&apos;s stats after each one.</p>}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Season" />
            <div className="mb-3 flex items-center gap-3">
              {athlete && <Avatar name={athlete.displayName} color={athlete.color} size="md" />}
              <div>
                {def.scoring !== "none" && rec.w + rec.l + rec.t > 0 && (
                  <p className="text-2xl font-semibold tabular-nums">
                    {rec.text} <span className="text-sm font-normal text-muted">record</span>
                  </p>
                )}
                <p className="text-sm text-muted">
                  {played.length} played · {upcoming.length} to go{avg ? ` · AVG ${avg}` : ""}
                </p>
              </div>
            </div>
            {defs.length > 0 && lines.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="py-1 font-medium">Stat</th>
                    <th className="py-1 text-right font-medium">Total</th>
                    <th className="py-1 text-right font-medium">Per game</th>
                    <th className="py-1 text-right font-medium">Best</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {defs.map((d) => {
                    const v = season[d.key]!;
                    if (!v.games) return null;
                    return (
                      <tr key={d.key}>
                        <td className="py-1.5">{d.label}</td>
                        <td className="py-1.5 text-right font-semibold tabular-nums">{show(d, v.total)}</td>
                        <td className="py-1.5 text-right tabular-nums">{d.kind === "time" || d.key === "place" ? "—" : show(d, v.avg)}</td>
                        <td className="py-1.5 text-right tabular-nums">{show(d, v.best)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted">Season totals appear once stats are entered for a game.</p>
            )}
          </Card>

          <Card>
            <CardHeader title="Practices" icon={<Repeat className="size-4" />} />
            {practices.length ? (
              <ul className="flex flex-col divide-y divide-line">
                {practices.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 py-2 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold">{WEEKDAYS[p.weekday]}</span> · {fmtTime(p.startTime)}
                      {p.endTime ? `–${fmtTime(p.endTime)}` : ""}
                      {p.location && <span className="block text-muted">{p.location}</span>}
                      {(p.startsOn || p.endsOn) && (
                        <span className="block text-xs text-muted">
                          {p.startsOn ? `from ${formatShortDate(p.startsOn)}` : ""} {p.endsOn ? `until ${formatShortDate(p.endsOn)}` : ""}
                        </span>
                      )}
                    </span>
                    {canChange && <DeleteButton action={deletePractice} fields={{ id: p.id, teamId: team.id }} what="this practice" />}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Add the weekly practice days and they&apos;ll repeat on the calendar.</p>
            )}
          </Card>

          {(team.coach || team.coachContact || team.notes) && (
            <Card>
              <CardHeader title="Team info" icon={<User className="size-4" />} />
              {team.coach && <p className="text-sm">Coach {team.coach}</p>}
              {team.coachContact && <p className="text-sm text-muted">{team.coachContact}</p>}
              {team.notes && <p className="mt-2 text-sm whitespace-pre-line text-ink-soft">{team.notes}</p>}
            </Card>
          )}

          {canChange && (
            <ActionButton action={deleteTeam} fields={{ id: team.id }} confirm={`Delete ${team.name} with all its games and stats? This can't be undone.`} className="self-start text-sm font-medium text-wine-600 hover:underline">
              <Trash2 className="size-4" /> Delete team and its games
            </ActionButton>
          )}
        </div>
      </div>
    </>
  );
}
