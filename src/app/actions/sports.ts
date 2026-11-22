"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { familyMembers, sportGames, sportPractices, sportStatLines, sportTeams } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { AuthorizationError, requireModule, type Viewer } from "@/lib/dal";
import { f } from "@/lib/records";
import { parseTime, SPORTS, teamStats } from "@/lib/sports";

/**
 * Sports. Anyone with Sports "Use" manages their own teams; "Add & edit"
 * (parents by default) manages every athlete's.
 */
function revalidateSports() {
  revalidatePath("/sports", "layout");
  revalidatePath("/calendar", "layout");
  revalidatePath("/");
}

const time = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "");
  return /^\d{2}:\d{2}/.test(v) ? v.slice(0, 5) : null;
};

async function athlete(viewer: Viewer, memberId: string | null) {
  if (!memberId) throw new AuthorizationError("Choose who plays.");
  const [m] = await db.select({ id: familyMembers.id }).from(familyMembers).where(and(eq(familyMembers.id, memberId), eq(familyMembers.familyId, viewer.family.id)));
  if (!m) throw new AuthorizationError("Choose who plays.");
  if (m.id !== viewer.member.id && !viewer.can("sports", "edit")) throw new AuthorizationError("You can only change your own teams.");
  return m.id;
}

/** A team in this family the viewer may change. */
async function team(viewer: Viewer, id: string | null) {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new AuthorizationError("Team not found.");
  const [t] = await db.select().from(sportTeams).where(and(eq(sportTeams.id, id), eq(sportTeams.familyId, viewer.family.id)));
  if (!t) throw new AuthorizationError("Team not found.");
  if (t.memberId !== viewer.member.id && !viewer.can("sports", "edit")) throw new AuthorizationError("You can only change your own teams.");
  return t;
}

export async function saveTeam(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("sports", "use");
    const id = f.str(fd, "id");
    const existing = id ? await team(viewer, id) : null;
    const memberId = existing ? existing.memberId : await athlete(viewer, f.str(fd, "memberId"));
    const name = f.str(fd, "name");
    if (!name) return fail("Name the team.", "name");
    const sport = f.str(fd, "sport") ?? "other";
    if (!SPORTS.some((s) => s.key === sport)) return fail("Choose a sport.", "sport");
    const values = {
      sport,
      sportName: sport === "other" ? f.str(fd, "sportName") : null,
      name,
      season: f.str(fd, "season"),
      league: f.str(fd, "league"),
      position: f.str(fd, "position"),
      jerseyNumber: f.str(fd, "jerseyNumber"),
      coach: f.str(fd, "coach"),
      coachContact: f.str(fd, "coachContact"),
      customStats: f.split(fd, "customStats").slice(0, 12),
      active: fd.has("active") ? f.bool(fd, "active") : true,
      notes: f.str(fd, "notes"),
    };
    let teamId = id;
    if (existing) await db.update(sportTeams).set(values).where(eq(sportTeams.id, existing.id));
    else teamId = (await db.insert(sportTeams).values({ ...values, familyId: viewer.family.id, memberId }).returning({ id: sportTeams.id }))[0]!.id;
    revalidateSports();
    if (!existing) redirect(`/sports/${teamId}`);
    return ok("Team saved.");
  });
}

export async function deleteTeam(fd: FormData) {
  const viewer = await requireModule("sports", "use");
  const t = await team(viewer, f.str(fd, "id"));
  await db.delete(sportTeams).where(eq(sportTeams.id, t.id));
  revalidateSports();
  redirect("/sports");
}

export async function savePractice(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("sports", "use");
    const t = await team(viewer, f.str(fd, "teamId"));
    const days = f.list(fd, "weekday").map(Number).filter((d) => d >= 0 && d <= 6);
    const startTime = time(fd, "startTime");
    if (!days.length) return fail("Pick the practice day(s).", "weekday");
    if (!startTime) return fail("What time does practice start?", "startTime");
    const base = { familyId: viewer.family.id, teamId: t.id, startTime, endTime: time(fd, "endTime"), location: f.str(fd, "location"), startsOn: f.date(fd, "startsOn"), endsOn: f.date(fd, "endsOn") };
    const id = f.str(fd, "id");
    if (id) {
      await db.update(sportPractices).set({ ...base, weekday: days[0]! }).where(and(eq(sportPractices.id, id), eq(sportPractices.teamId, t.id)));
    } else {
      await db.insert(sportPractices).values(days.map((weekday) => ({ ...base, weekday })));
    }
    revalidateSports();
    return ok("Practice saved.");
  });
}

export async function deletePractice(fd: FormData) {
  const viewer = await requireModule("sports", "use");
  const t = await team(viewer, f.str(fd, "teamId"));
  await db.delete(sportPractices).where(and(eq(sportPractices.id, String(fd.get("id"))), eq(sportPractices.teamId, t.id)));
  revalidateSports();
}

const KINDS = ["game", "tournament", "meet", "scrimmage", "tryout", "other"] as const;

export async function saveGame(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("sports", "use");
    const t = await team(viewer, f.str(fd, "teamId"));
    const date = f.date(fd, "date");
    if (!date) return fail("Pick the date.", "date");
    const kind = (KINDS as readonly string[]).includes(f.str(fd, "kind") ?? "") ? (f.str(fd, "kind") as (typeof KINDS)[number]) : "game";
    const ha = f.str(fd, "homeAway");
    const outcome = f.str(fd, "outcome");
    const values = {
      kind,
      opponent: f.str(fd, "opponent"),
      date,
      arriveTime: time(fd, "arriveTime"),
      startTime: time(fd, "startTime"),
      location: f.str(fd, "location"),
      homeAway: ha === "home" || ha === "away" || ha === "neutral" ? (ha as "home" | "away" | "neutral") : null,
      ourScore: f.int(fd, "ourScore"),
      theirScore: f.int(fd, "theirScore"),
      outcome: outcome && ["win", "loss", "tie"].includes(outcome) ? outcome : null,
      details: f.str(fd, "details"),
      notes: f.str(fd, "notes"),
    };
    const id = f.str(fd, "id");
    if (id) await db.update(sportGames).set(values).where(and(eq(sportGames.id, id), eq(sportGames.teamId, t.id)));
    else await db.insert(sportGames).values({ ...values, familyId: viewer.family.id, teamId: t.id });
    revalidateSports();
    return ok(id ? "Saved." : "Added to the schedule.");
  });
}

export async function deleteGame(fd: FormData) {
  const viewer = await requireModule("sports", "use");
  const t = await team(viewer, f.str(fd, "teamId"));
  await db.delete(sportGames).where(and(eq(sportGames.id, String(fd.get("id"))), eq(sportGames.teamId, t.id)));
  revalidateSports();
}

/** The athlete's stat line for one game. Times can be typed as 1:05.32. */
export async function saveStatLine(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("sports", "use");
    const t = await team(viewer, f.str(fd, "teamId"));
    const [g] = await db.select().from(sportGames).where(and(eq(sportGames.id, String(fd.get("gameId"))), eq(sportGames.teamId, t.id)));
    if (!g) throw new AuthorizationError("Game not found.");
    const stats: Record<string, number> = {};
    for (const d of teamStats(t.sport, t.customStats)) {
      const raw = String(fd.get(`stat:${d.key}`) ?? "").trim();
      if (!raw) continue;
      const v = d.kind === "time" ? parseTime(raw) : Number(raw);
      if (v === null || !Number.isFinite(v) || v < 0) return fail(`${d.label} should be a number${d.kind === "time" ? " or a time like 1:05.32" : ""}.`, `stat:${d.key}`);
      stats[d.key] = v;
    }
    const [line] = await db.select({ id: sportStatLines.id }).from(sportStatLines).where(and(eq(sportStatLines.gameId, g.id), eq(sportStatLines.memberId, t.memberId)));
    if (line) await db.update(sportStatLines).set({ stats, note: f.str(fd, "note") }).where(eq(sportStatLines.id, line.id));
    else await db.insert(sportStatLines).values({ familyId: viewer.family.id, gameId: g.id, memberId: t.memberId, stats, note: f.str(fd, "note") });
    revalidateSports();
    return ok("Stats saved.");
  });
}
