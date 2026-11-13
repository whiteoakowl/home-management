import Link from "next/link";
import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { HeartPulse, Moon, PawPrint, Trophy, Wrench } from "lucide-react";
import { MoonDisc } from "@/components/craft/moon-card";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, EmptyState, ProgressBar } from "@/components/ui/display";
import { db } from "@/db";
import { homeRepairs, petPreventatives, pets } from "@/db/schema";
import { listOccurrences } from "@/lib/chores";
import { familyUpcomingSabbats, moonFor } from "@/lib/craft";
import type { Scope } from "@/lib/dashboard-data";
import { addDays, daysBetween, formatShortDate, todayIn, zonedToUtc } from "@/lib/dates";
import { listMedical, medicalAppointments } from "@/lib/medical";
import { pointBalances, rewardsFor } from "@/lib/rewards";

const ic = "size-4";

export async function MoonWidget({ scope }: { scope: Scope }) {
  const moon = moonFor(scope.viewer, scope.today);
  const [next] = await familyUpcomingSabbats(scope.viewer, scope.today, 1);
  return (
    <Card>
      <CardHeader title="Moon & Wheel" icon={<Moon className={ic} />} href="/witchcraft" />
      <div className="flex items-center gap-4">
        <MoonDisc moon={moon} size={64} />
        <div>
          <p className="font-semibold">{moon.label}</p>
          <p className="text-sm text-muted">
            {Math.round(moon.illumination * 100)}% · Moon in {moon.sign}
          </p>
          {next && (
            <Link href={`/witchcraft/wheel/${next.key}`} className="mt-1 block text-sm text-primary-700 hover:underline">
              {next.s.emoji} {next.s.name} {daysBetween(scope.today, next.date) === 0 ? "today" : `in ${daysBetween(scope.today, next.date)} days`}
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}

export async function PetsWidget({ scope }: { scope: Scope }) {
  const rows = await db
    .select({ id: petPreventatives.id, product: petPreventatives.productName, due: petPreventatives.nextDueOn, pet: pets.name, petId: pets.id })
    .from(petPreventatives)
    .innerJoin(pets, eq(pets.id, petPreventatives.petId))
    .where(and(eq(pets.familyId, scope.viewer.family.id), eq(pets.status, "active"), lte(petPreventatives.nextDueOn, addDays(scope.today, 7)), scope.subjectId ? eq(petPreventatives.assigneeId, scope.subjectId) : undefined))
    .orderBy(asc(petPreventatives.nextDueOn))
    .limit(5);
  const count = await db.$count(pets, and(eq(pets.familyId, scope.viewer.family.id), eq(pets.status, "active")));
  return (
    <Card>
      <CardHeader title="Pets" icon={<PawPrint className={ic} />} href="/pets" />
      {count === 0 ? (
        <EmptyState compact icon={<PawPrint />} title="No pets yet" description="Add your companions to track their care." />
      ) : rows.length ? (
        <ul className="flex flex-col gap-1.5 text-sm">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/pets/${r.petId}`} className="flex justify-between gap-2 hover:text-primary-700">
                <span>
                  <strong>{r.pet}</strong>: {r.product}
                </span>
                <Badge tone={r.due! < scope.today ? "wine" : "olive"}>{r.due! < scope.today ? "Overdue" : formatShortDate(r.due!)}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No preventatives due this week. 🐾</p>
      )}
    </Card>
  );
}

export async function HomeUpkeepWidget({ scope }: { scope: Scope }) {
  const [due, repairs] = await Promise.all([
    listOccurrences(scope.viewer, { kinds: ["maintenance"], to: addDays(scope.today, 14), statuses: ["pending"], assigneeId: scope.subjectId, limit: 5 }),
    scope.subjectId ? Promise.resolve([]) : db.select().from(homeRepairs).where(and(eq(homeRepairs.familyId, scope.viewer.family.id), inArray(homeRepairs.status, ["open", "scheduled"]))).orderBy(asc(homeRepairs.reportedOn)).limit(3),
  ]);
  return (
    <Card>
      <CardHeader title="Home upkeep" icon={<Wrench className={ic} />} href="/maintenance" />
      {!due.length && !repairs.length ? (
        <p className="text-sm text-muted">No maintenance due in the next two weeks.</p>
      ) : (
        <ul className="flex flex-col gap-1.5 text-sm">
          {due.map((o) => (
            <li key={o.id}>
              <Link href={`/house/chores/${o.choreId}`} className="flex justify-between gap-2 hover:text-primary-700">
                <span>{o.title}</span>
                <Badge tone={o.dueDate < scope.today ? "wine" : "neutral"}>{formatShortDate(o.dueDate)}</Badge>
              </Link>
            </li>
          ))}
          {repairs.map((r) => (
            <li key={r.id}>
              <Link href={`/maintenance/repairs/${r.id}`} className="flex justify-between gap-2 hover:text-primary-700">
                <span>Repair: {r.title}</span>
                <Badge tone="olive">{r.status}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Health reminders the viewer may see (their own + shared; parents see all). */
export async function HealthWidget({ scope }: { scope: Scope }) {
  const v = scope.viewer;
  const tz = v.family.timezone;
  const today = todayIn(tz);
  const [appts, meds] = await Promise.all([medicalAppointments(v, { from: zonedToUtc(today, "00:00", tz), memberId: scope.subjectId }), listMedical(v, "medication", scope.subjectId)]);
  const horizon = zonedToUtc(addDays(today, 14), "23:59", tz);
  const soon = appts.filter((a) => a.startsAt < horizon).slice(0, 3);
  const refills = meds.filter(({ r }) => r.active && r.nextRefillOn && r.nextRefillOn <= addDays(today, 7)).slice(0, 3);
  return (
    <Card>
      <CardHeader title="Health" icon={<HeartPulse className={ic} />} href="/medical" />
      {!soon.length && !refills.length ? (
        <p className="text-sm text-muted">No appointments or refills in the next two weeks.</p>
      ) : (
        <ul className="flex flex-col gap-1.5 text-sm">
          {soon.map((a) => (
            <li key={a.id}>
              <Link href="/medical/calendar" className="flex justify-between gap-2 hover:text-primary-700">
                <span>{a.title}</span>
                <span className="text-muted">{a.startsAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: tz })}</span>
              </Link>
            </li>
          ))}
          {refills.map(({ r, memberName }) => (
            <li key={r.id}>
              <Link href="/medical/medications" className="flex justify-between gap-2 hover:text-primary-700">
                <span>
                  Refill {r.name} <span className="text-muted">· {memberName}</span>
                </span>
                <Badge tone={r.nextRefillOn! < today ? "wine" : "olive"}>{formatShortDate(r.nextRefillOn!)}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}


export async function PointsWidget({ scope }: { scope: Scope }) {
  const who = scope.subjectId ?? scope.viewer.member.id;
  const [balances, catalog] = await Promise.all([pointBalances(scope.viewer.family.id), rewardsFor(scope.viewer)]);
  const bal = balances.get(who)?.balance ?? 0;
  const next = catalog.filter((r) => r.active && (!r.forMemberIds.length || r.forMemberIds.includes(who)) && r.cost > bal).sort((a, b) => a.cost - b.cost)[0];
  return (
    <Card>
      <CardHeader title="Points" icon={<Trophy className={ic} />} href="/house/rewards" />
      <p className="font-display text-4xl font-semibold">
        {bal} <span className="text-base font-normal text-muted">points</span>
      </p>
      {next ? (
        <div className="mt-2">
          <p className="text-sm text-ink-soft">
            {next.emoji ?? "🎁"} {next.title}: {next.cost - bal} to go
          </p>
          <ProgressBar value={bal} max={next.cost} tone="olive" />
        </div>
      ) : (
        <p className="mt-1 text-sm text-muted">Finish chores to earn points for rewards.</p>
      )}
    </Card>
  );
}
