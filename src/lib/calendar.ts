import "server-only";
import { memberNameSql } from "./names";
import { and, asc, eq, gte, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  animalHealthRecords,
  homeDocuments,
  homeProjects,
  homeRepairs,
  petMedicalRecords,
  petPreventatives,
  pets,
  projectStages,
  sabbatSettings,
  familyDates,
  periodDays,
  animals,
  calendarEvents,
  categories,
  choreOccurrences,
  chores,
  eventAttendees,
  familyMembers,
  fitnessPlans,
  gardenPlantings,
  mealPlanEntries,
  plants,
  recipes,
  recurrenceRules,
  workouts,
  danceClasses,
  danceDaysOff,
  danceEvents,
  contacts,
  sportGames,
  sportPractices,
  sportTeams,
  planItems,
  vehicles,
} from "@/db/schema";
import { automationOn } from "./automation";
import { fitnessVisibleIds } from "./fitness";
import { personalSubjects } from "./privacy";
import { visibleTo, type Viewer } from "./dal";
import { addDays, daysBetween, todayIn, utcToZoned, zonedToUtc } from "./dates";
import { occurrencesBetween, type Rule } from "./recurrence";
import { classDates, fmtTime, minutesOf } from "./dance";
import { pointeSummary } from "./pointe";
import { nextBirthday } from "./hub";
import { workBetween } from "./work";
import { timeOffEmoji, timeOffLabel } from "./work-schedule";
import { listPlans } from "./trips";
import { listParties } from "./parties";
import { addMonths as vAddMonths, loanStatus } from "./vehicles";
import { vehicleOwnerIs, vehicleScope, vehicleSummary } from "./vehicle-data";
import { phasesBetween } from "./astro";
import { wheelForYear } from "./sabbats";
import { familyHolidays } from "./faith";
import { refreshStaleImports, visibleImports } from "./calendar-sync";
import { after } from "next/server";
import { familyFaiths } from "./faith-config";

export const LAYERS = ["events", "plans", "chores", "workouts", "dance", "sports", "work", "vehicles", "meals", "garden", "farm", "pets", "home", "moon", "christian", "catholic", "jewish", "hindu", "buddhist", "synced", "cycle"] as const;
export type Layer = (typeof LAYERS)[number];

export type CalendarItem = {
  key: string;
  id: string;
  layer: Layer;
  title: string;
  date: string; // local yyyy-mm-dd
  startMin: number | null; // minutes from midnight (local); null = all-day
  endMin: number | null;
  color: string; // member-colour key or hex
  location?: string | null;
  href: string;
  recurring?: boolean;
  people: string[]; // member ids
  done?: boolean;
  /** Calendar category (events only). */
  categoryId?: string | null;
  category?: string | null;
  /** Who can see it; items from other modules follow that module's access (shown as family). */
  visibility?: "family" | "private" | "selected" | "parents";
  /** Finer event type: "event", "medical", "celebration"… (events) or the layer name. */
  type?: string;
  description?: string | null;
};

const DEFAULT_CALENDAR_CATEGORIES = [
  ["School", "orchid"],
  ["Homeschool", "ocean"],
  ["Family", "rose"],
  ["Work", "slate"],
  ["Appointments", "wine"],
  ["Activities", "lilac"],
  ["Household", "mauve"],
  ["Farm", "olive"],
  ["Garden", "khaki"],
  ["Fitness", "plum"],
  ["Meals", "khaki"],
] as const;

/** Seed the suggested calendar categories once per family. */
export async function ensureCalendarCategories(viewer: Viewer) {
  const [{ n } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(categories)
    .where(and(eq(categories.familyId, viewer.family.id), eq(categories.domain, "calendar")));
  if (n === 0 && viewer.isParent) {
    await db.insert(categories).values(
      DEFAULT_CALENDAR_CATEGORIES.map(([name, color], i) => ({ familyId: viewer.family.id, domain: "calendar" as const, name, color, sortOrder: i })),
    );
  }
}

export async function getCalendarItems(
  viewer: Viewer,
  from: string,
  to: string,
  opts: { layers: Layer[]; memberId?: string | null },
): Promise<CalendarItem[]> {
  const tz = viewer.family.timezone;
  const fid = viewer.family.id;
  const out: CalendarItem[] = [];
  const want = (l: Layer) => opts.layers.includes(l);
  const subject = opts.memberId ?? null;

  if (want("events") && viewer.can("calendar")) {
    const fromUtc = zonedToUtc(from, "00:00", tz);
    const toUtc = zonedToUtc(addDays(to, 1), "00:00", tz);
    const rows = await db
      .select({ e: calendarEvents, rule: recurrenceRules, catColor: categories.color, catName: categories.name })
      .from(calendarEvents)
      .leftJoin(recurrenceRules, eq(recurrenceRules.id, calendarEvents.recurrenceRuleId))
      .leftJoin(categories, eq(categories.id, calendarEvents.categoryId))
      .where(
        and(
          eq(calendarEvents.familyId, fid),
          visibleTo(viewer, { id: calendarEvents.id, visibility: calendarEvents.visibility, author: calendarEvents.createdByMemberId }, "event"),
          or(
            and(isNull(calendarEvents.recurrenceRuleId), gte(calendarEvents.startsAt, fromUtc), sql`${calendarEvents.startsAt} < ${toUtc}`),
            and(isNotNull(calendarEvents.recurrenceRuleId), sql`${calendarEvents.startsAt} < ${toUtc}`),
          ),
        ),
      );
    const att = rows.length
      ? await db.select().from(eventAttendees).where(inArray(eventAttendees.eventId, rows.map((r) => r.e.id)))
      : [];
    const people = Map.groupBy(att, (a) => a.eventId);
    const colorOf = await memberColorMap(fid);

    for (const { e, rule, catColor, catName } of rows) {
      const ids = (people.get(e.id) ?? []).map((a) => a.memberId);
      if (subject && !ids.includes(subject)) continue;
      const color = e.color ?? catColor ?? (ids[0] ? colorOf.get(ids[0]) : null) ?? "plum";
      const start = utcToZoned(e.startsAt, tz);
      const durMin = e.endsAt ? Math.max(15, Math.round((e.endsAt.getTime() - e.startsAt.getTime()) / 60000)) : 60;
      const skipped = new Set(e.skippedDates ?? []);
      const dates = rule ? occurrencesBetween({ ...(rule as unknown as Rule), startsOn: start.date }, from, to).filter((d) => !skipped.has(d)) : [start.date];
      for (const date of dates) {
        out.push({
          key: `e:${e.id}:${date}`,
          id: e.id,
          layer: "events",
          title: e.title,
          date,
          startMin: e.allDay ? null : start.minutes,
          endMin: e.allDay ? null : Math.min(24 * 60, start.minutes + durMin),
          color,
          location: e.location,
          href: e.source === "pregnancy" && e.sourceId ? `/pregnancy/${e.sourceId}/appointments` : `/calendar/event/${e.id}${rule ? `?on=${date}` : ""}`,
          recurring: !!rule,
          people: ids,
          categoryId: e.categoryId,
          category: catName,
          visibility: e.visibility,
          type: e.source === "manual" ? "event" : e.source,
          description: e.description,
        });
      }
    }
  }

  if (want("chores") && (viewer.can("chores") || viewer.can("cleaning") || viewer.can("maintenance"))) {
    const a = alias(familyMembers, "a");
    const rows = await db
      .select({ id: choreOccurrences.id, choreId: chores.id, title: chores.title, date: choreOccurrences.dueDate, status: choreOccurrences.status, assigneeId: choreOccurrences.assigneeId, assigneeIds: choreOccurrences.assigneeIds, color: a.color })
      .from(choreOccurrences)
      .innerJoin(chores, eq(chores.id, choreOccurrences.choreId))
      .leftJoin(a, eq(a.id, choreOccurrences.assigneeId))
      .where(
        and(
          eq(choreOccurrences.familyId, fid),
          gte(choreOccurrences.dueDate, from),
          lte(choreOccurrences.dueDate, to),
          inArray(choreOccurrences.status, ["pending", "done"]),
          subject ? or(eq(choreOccurrences.assigneeId, subject), sql`${subject}::uuid = any(${choreOccurrences.assigneeIds})`) : undefined,
        ),
      );
    for (const r of rows) {
      out.push({ key: `c:${r.id}`, id: r.id, layer: "chores", title: r.title, date: r.date, startMin: null, endMin: null, color: r.color ?? "slate", href: `/house/chores/${r.choreId}`, people: r.assigneeIds.length ? r.assigneeIds : r.assigneeId ? [r.assigneeId] : [], done: r.status === "done" });
    }
  }

  if (want("workouts") && viewer.can("fitness") && automationOn(viewer.family, "workoutCalendar")) {
    const rows = await db
      .select({ w: workouts, rule: recurrenceRules, memberId: fitnessPlans.memberId, color: familyMembers.color, name: memberNameSql(viewer, familyMembers) })
      .from(workouts)
      .innerJoin(fitnessPlans, eq(fitnessPlans.id, workouts.planId))
      .innerJoin(recurrenceRules, eq(recurrenceRules.id, workouts.recurrenceRuleId))
      .innerJoin(familyMembers, eq(familyMembers.id, fitnessPlans.memberId))
      .where(and(eq(fitnessPlans.familyId, fid), subject ? eq(fitnessPlans.memberId, subject) : undefined, inArray(fitnessPlans.memberId, await fitnessVisibleIds(viewer))));
    for (const r of rows) {
      for (const date of occurrencesBetween(r.rule as unknown as Rule, from, to)) {
        out.push({ key: `w:${r.w.id}:${date}`, id: r.w.id, layer: "workouts", title: `${r.name.split(" ")[0]}: ${r.w.name}`, date, startMin: null, endMin: null, color: r.color, href: "/fitness", recurring: true, people: [r.memberId] });
      }
    }
  }

  // Dance: weekly classes (skipping days off) and performances.
  if (want("dance") && viewer.can("dance")) {
    const [classes, offs, evs] = await Promise.all([
      db.select().from(danceClasses).where(and(eq(danceClasses.familyId, fid), subject ? eq(danceClasses.memberId, subject) : undefined)),
      db.select().from(danceDaysOff).where(and(eq(danceDaysOff.familyId, fid), gte(danceDaysOff.endDate, from), lte(danceDaysOff.startDate, to))),
      db.select().from(danceEvents).where(and(eq(danceEvents.familyId, fid), lte(danceEvents.date, to), or(gte(danceEvents.date, from), gte(danceEvents.endDate, from)))),
    ]);
    const colorOf = await memberColorMap(fid);
    const offRules = offs.map((o) => ({ memberId: o.memberId, startDate: o.startDate, endDate: o.endDate, title: o.title }));
    for (const c of classes) {
      for (const date of classDates({ memberId: c.memberId, weekday: c.weekday, startsOn: c.startsOn, endsOn: c.endsOn }, from, to, offRules)) {
        const start = minutesOf(c.startTime)!;
        out.push({ key: `dc:${c.id}:${date}`, id: c.id, layer: "dance", title: `${c.title}`, date, startMin: start, endMin: minutesOf(c.endTime) ?? start + 60, color: colorOf.get(c.memberId) ?? "plum", location: c.location, href: `/dance?member=${c.memberId}&week=${date}`, recurring: true, people: [c.memberId], type: "dance" });
      }
    }
    for (const e of evs) {
      if (subject && !e.memberIds.includes(subject)) continue;
      const last = e.endDate && e.endDate > e.date ? e.endDate : e.date;
      for (let d = e.date; d <= last; d = addDays(d, 1)) {
        if (d < from || d > to) continue;
        const start = minutesOf(e.callTime ?? e.startTime);
        out.push({ key: `de:${e.id}:${d}`, id: e.id, layer: "dance", title: `${e.kind === "audition" ? "🎭" : e.kind === "photos" ? "📸" : "🏆"} ${e.title}${e.callTime ? ` (call ${fmtTime(e.callTime)})` : ""}`, date: d, startMin: start, endMin: minutesOf(e.endTime) ?? (start !== null ? start + 120 : null), color: colorOf.get(e.memberIds[0] ?? "") ?? "plum", location: e.location, href: "/dance", people: e.memberIds, type: "dance", description: e.details });
      }
    }
    if (!subject) for (const o of offs.filter((x) => x.memberId === null)) for (let d = o.startDate; d <= o.endDate; d = addDays(d, 1)) if (d >= from && d <= to) out.push({ key: `do:${o.id}:${d}`, id: o.id, layer: "dance", title: `No dance: ${o.title}`, date: d, startMin: null, endMin: null, color: "cornflower", href: "/dance", people: [], type: "dance" });
    // Pointe shoes: the day to order each dancer's next pair.
    for (const p of await pointeSummary(viewer, subject ? [subject] : null, todayIn(viewer.family.timezone))) {
      if (p.due.status !== "ordered" && p.due.date && p.due.date >= from && p.due.date <= to)
        out.push({ key: `pt:${p.memberId}`, id: p.memberId, layer: "dance", title: "🩰 Order pointe shoes", date: p.due.date, startMin: null, endMin: null, color: colorOf.get(p.memberId) ?? "plum", href: `/dance/pointe?member=${p.memberId}`, people: [p.memberId], type: "dance" });
    }
  }

  // Family members' birthdays and the family's anniversaries / yearly dates (Memories → Birthdays & anniversaries).
  if (want("events") && !subject) {
    const [kin, dates] = await Promise.all([
      db.select({ id: familyMembers.id, name: familyMembers.displayName, birthday: familyMembers.birthday }).from(familyMembers).where(and(eq(familyMembers.familyId, fid), eq(familyMembers.isActive, true), isNotNull(familyMembers.birthday))),
      db.select().from(familyDates).where(eq(familyDates.familyId, fid)),
    ]);
    for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
      for (const k of kin) {
        const date = nextBirthday(k.birthday!, `${y}-01-01`);
        const age = y - Number(k.birthday!.slice(0, 4));
        if (date >= from && date <= to && date.slice(0, 4) === String(y)) out.push({ key: `mb:${k.id}:${date}`, id: k.id, layer: "events", title: `🎂 ${k.name.split(" ")[0]}'s birthday${age > 0 && age < 120 ? ` (${age})` : ""}`, date, startMin: null, endMin: null, color: "rose", href: "/memories/dates", people: [k.id], type: "birthday" });
      }
      for (const d of dates) {
        const day = d.month === 2 && d.day === 29 && !(y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 28 : d.day;
        const date = `${y}-${String(d.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const n = d.year ? y - d.year : 0;
        if (date >= from && date <= to) out.push({ key: `fd:${d.id}:${date}`, id: d.id, layer: "events", title: `${d.kind === "anniversary" ? "💍" : d.kind === "birthday" ? "🎂" : "📅"} ${d.title}${n > 0 ? ` (${n})` : ""}`, date, startMin: null, endMin: null, color: "rose", href: "/memories/dates", people: d.memberIds, type: d.kind === "birthday" ? "birthday" : "anniversary" });
      }
    }
  }

  // Contacts' birthdays (shared contacts, plus your own private ones).
  if (want("events") && viewer.can("contacts") && !subject) {
    const people = await db
      .select({ id: contacts.id, name: contacts.name, birthday: contacts.birthday })
      .from(contacts)
      .where(and(eq(contacts.familyId, fid), isNotNull(contacts.birthday), or(eq(contacts.private, false), eq(contacts.createdByMemberId, viewer.member.id))));
    for (const c of people) {
      for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
        const date = nextBirthday(c.birthday!, `${y}-01-01`);
        if (date >= from && date <= to) out.push({ key: `cb:${c.id}:${date}`, id: c.id, layer: "events", title: `🎂 ${c.name}'s birthday`, date, startMin: null, endMin: null, color: "rose", href: "/contacts", people: [], type: "birthday" });
      }
    }
  }

  // Sports: weekly practices for active teams, plus games and events.
  if (want("sports") && viewer.can("sports")) {
    const teams = await db.select().from(sportTeams).where(and(eq(sportTeams.familyId, fid), subject ? eq(sportTeams.memberId, subject) : undefined));
    if (teams.length) {
      const ids = teams.map((t) => t.id);
      const [practices, games] = await Promise.all([
        db.select().from(sportPractices).where(inArray(sportPractices.teamId, ids)),
        db.select().from(sportGames).where(and(inArray(sportGames.teamId, ids), gte(sportGames.date, from), lte(sportGames.date, to))),
      ]);
      const colorOf = await memberColorMap(fid);
      const teamOf = new Map(teams.map((t) => [t.id, t]));
      for (const p of practices) {
        const t = teamOf.get(p.teamId)!;
        if (!t.active) continue;
        for (const date of classDates({ memberId: t.memberId, weekday: p.weekday, startsOn: p.startsOn, endsOn: p.endsOn }, from, to, [])) {
          const start = minutesOf(p.startTime)!;
          out.push({ key: `sp:${p.id}:${date}`, id: p.id, layer: "sports", title: `${t.name} practice`, date, startMin: start, endMin: minutesOf(p.endTime) ?? start + 90, color: colorOf.get(t.memberId) ?? "olive", location: p.location, href: `/sports/${t.id}`, recurring: true, people: [t.memberId], type: "sports" });
        }
      }
      for (const g of games) {
        const t = teamOf.get(g.teamId)!;
        const start = minutesOf(g.arriveTime ?? g.startTime);
        const label = g.opponent ? `${t.name} ${g.homeAway === "away" ? "@" : "vs"} ${g.opponent}` : t.name;
        out.push({ key: `sg:${g.id}`, id: g.id, layer: "sports", title: `🏆 ${label}${g.arriveTime ? ` (arrive ${fmtTime(g.arriveTime)})` : ""}`, date: g.date, startMin: start, endMin: start !== null ? start + 120 : null, color: colorOf.get(t.memberId) ?? "olive", location: g.location, href: `/sports/${t.id}`, people: [t.memberId], type: "sports", description: g.details });
      }
    }
  }

  // Plans: each day of a trip, plus its flights.
  if (want("plans") && viewer.can("plans")) {
    const rows = (await listPlans(viewer)).filter((r) => r.p.startDate && r.p.startDate <= to && (r.p.endDate ?? r.p.startDate) >= from && (!subject || r.p.memberIds.includes(subject) || r.p.createdByMemberId === subject));
    const colorOf = await memberColorMap(fid);
    for (const { p } of rows) {
      for (let d = p.startDate!; d <= (p.endDate ?? p.startDate!); d = addDays(d, 1)) {
        if (d >= from && d <= to) out.push({ key: `pl:${p.id}:${d}`, id: p.id, layer: "plans", title: `✈️ ${p.title}`, date: d, startMin: null, endMin: null, color: colorOf.get(p.createdByMemberId ?? "") ?? "cornflower", location: p.destination, href: `/plans/${p.id}`, people: p.memberIds, type: "plans", description: p.description });
      }
    }
    if (rows.length) {
      // Flights, reservations and itinerary stops with a date (Disney trip: park days, dinner reservations…).
      const flights = await db.select().from(planItems).where(and(inArray(planItems.planId, rows.map((r) => r.p.id)), inArray(planItems.kind, ["flight", "reservation", "itinerary"]), gte(planItems.date, from), lte(planItems.date, to)));
      for (const fl of flights) {
        const plan = rows.find((r) => r.p.id === fl.planId)!.p;
        const start = minutesOf(fl.startTime);
        const end = minutesOf(fl.endTime);
        const icon = fl.kind === "flight" ? "🛫" : fl.kind === "reservation" ? "🎟️" : "📍";
        out.push({ key: `pf:${fl.id}`, id: fl.id, layer: "plans", title: `${icon} ${fl.title}${fl.provider && fl.kind === "flight" ? ` (${fl.provider})` : ""}`, date: fl.date!, startMin: start, endMin: start !== null ? (end !== null && end > start && (!fl.endDate || fl.endDate === fl.date) ? end : start + (fl.kind === "flight" ? 90 : 60)) : null, color: colorOf.get(plan.createdByMemberId ?? "") ?? "cornflower", location: fl.location, href: `/plans/${plan.id}`, people: plan.memberIds, type: "plans", description: fl.confirmation ? `Confirmation ${fl.confirmation}${fl.notes ? `\n${fl.notes}` : ""}` : fl.notes });
      }
    }
  }

  // Parties (shown with trips).
  if (want("plans") && viewer.can("parties")) {
    const rows = (await listParties(viewer)).filter((r) => r.p.date && r.p.date >= from && r.p.date <= to && (!subject || r.p.honoreeMemberId === subject || r.p.createdByMemberId === subject));
    const colorOf = rows.length ? await memberColorMap(fid) : new Map<string, string>();
    for (const { p } of rows) {
      const start = minutesOf(p.startTime);
      const end = minutesOf(p.endTime);
      out.push({ key: `pa:${p.id}`, id: p.id, layer: "plans", title: `🎉 ${p.title}`, date: p.date!, startMin: start, endMin: start !== null ? (end !== null && end > start ? end : start + 120) : null, color: colorOf.get(p.honoreeMemberId ?? p.createdByMemberId ?? "") ?? "rose", location: [p.venue, p.address].filter(Boolean).join(", ") || null, href: `/parties/${p.id}`, people: p.honoreeMemberId ? [p.honoreeMemberId] : [], type: "plans", description: p.description });
    }
  }

  // Work shifts.
  if (want("work") && viewer.can("work")) {
    // One-off shifts plus regular weekly schedules, skipping days off.
    const { shifts, timeOff } = await workBetween(viewer, from, to, subject);
    const colorOf = await memberColorMap(fid);
    const names = new Map((await db.select({ id: familyMembers.id, name: memberNameSql(viewer, familyMembers) }).from(familyMembers).where(eq(familyMembers.familyId, fid))).map((m) => [m.id, m.name.split(" ")[0]!]));
    for (const s of shifts) {
      const start = minutesOf(s.startTime)!;
      const end = minutesOf(s.endTime)!;
      out.push({ key: `ws:${s.id}`, id: s.patternId ?? s.id, layer: "work", title: `${names.get(s.memberId) ?? ""} works${s.job ? `: ${s.job}` : ""}`, date: s.date, startMin: start, endMin: end > start ? end : 24 * 60, color: colorOf.get(s.memberId) ?? "slate", href: `/work?week=${s.date}`, people: [s.memberId], type: "work", description: s.notes, recurring: !!s.patternId });
    }
    for (const o of timeOff)
      for (let d = o.startDate > from ? o.startDate : from; d <= o.endDate && d <= to; d = addDays(d, 1))
        out.push({ key: `wo:${o.id}:${d}`, id: o.id, layer: "work", title: `${timeOffEmoji(o.kind)} ${names.get(o.memberId) ?? ""} off: ${timeOffLabel(o)}`, date: d, startMin: null, endMin: null, color: colorOf.get(o.memberId) ?? "slate", href: `/work?week=${d}`, people: [o.memberId], type: "work", description: o.notes });
  }

  // Vehicles: paperwork deadlines, loan payments and (estimated) maintenance due dates.
  const carScope = vehicleScope(viewer);
  if (want("vehicles") && carScope && !subject) {
    // Parents: the family's cars. A member with My Vehicles: only their own (never shown to anyone else).
    const cars = await db.select().from(vehicles).where(and(eq(vehicles.familyId, fid), eq(vehicles.active, true), vehicleOwnerIs(carScope.owner)));
    for (const v of cars) {
      const href = `/vehicles/${v.id}`;
      const add = (key: string, title: string, date: string | null) => {
        if (date && date >= from && date <= to) out.push({ key: `vh:${v.id}:${key}:${date}`, id: v.id, layer: "vehicles", title: `${v.nickname}: ${title}`, date, startMin: null, endMin: null, color: "slate", href, people: v.driverMemberId ? [v.driverMemberId] : [], type: "vehicles" });
      };
      add("reg", "registration expires", v.registrationExpiresOn);
      add("ins", "insurance renews", v.insuranceRenewsOn);
      add("insp", "inspection due", v.inspectionDueOn);
      if (v.loanStartDate && v.loanTermMonths && v.loanAmountCents && v.loanPaymentCents) {
        const loan = loanStatus({ amountCents: v.loanAmountCents, aprPercent: v.loanApr ?? 0, paymentCents: v.loanPaymentCents, startDate: v.loanStartDate, termMonths: v.loanTermMonths }, from);
        for (let i = 0, d = loan.nextPaymentDate; d && d <= to && d <= loan.payoffDate && i < 24; i++, d = vAddMonths(loan.nextPaymentDate!, i)) add("loan", "car payment", d);
      }
    }
    if (cars.length) {
      const today = todayIn(tz);
      for (const v of cars) {
        const { due } = await vehicleSummary(viewer, v, today);
        for (const { s, d } of due) if (d.dueDate && d.status !== "unknown") add2(v, s.title, d.dueDate);
      }
    }
    function add2(v: (typeof vehicles.$inferSelect), title: string, date: string) {
      if (date >= from && date <= to) out.push({ key: `vm:${v.id}:${title}`, id: v.id, layer: "vehicles", title: `${v.nickname}: ${title} due`, date, startMin: null, endMin: null, color: "slate", href: `/vehicles/${v.id}`, people: v.driverMemberId ? [v.driverMemberId] : [], type: "vehicles" });
    }
  }

  if (want("meals") && viewer.can("meals") && !subject) {
    const rows = await db
      .select({ id: mealPlanEntries.id, date: mealPlanEntries.date, slot: mealPlanEntries.slot, title: mealPlanEntries.title, recipe: recipes.name })
      .from(mealPlanEntries)
      .leftJoin(recipes, eq(recipes.id, mealPlanEntries.recipeId))
      .where(and(eq(mealPlanEntries.familyId, fid), or(isNull(mealPlanEntries.ownerMemberId), eq(mealPlanEntries.ownerMemberId, viewer.member.id)), gte(mealPlanEntries.date, from), lte(mealPlanEntries.date, to), eq(mealPlanEntries.slot, "dinner")))
      .orderBy(asc(mealPlanEntries.date));
    for (const r of rows) {
      out.push({ key: `m:${r.id}`, id: r.id, layer: "meals", title: `Dinner: ${r.recipe ?? r.title}`, date: r.date, startMin: null, endMin: null, color: "khaki", href: `/meals?week=${r.date}`, people: [] });
    }
  }

  if (want("garden") && viewer.can("garden") && !subject) {
    const rows = await db
      .select({ id: gardenPlantings.id, date: gardenPlantings.expectedHarvestOn, name: plants.name })
      .from(gardenPlantings)
      .innerJoin(plants, eq(plants.id, gardenPlantings.plantId))
      .where(and(eq(gardenPlantings.familyId, fid), gte(gardenPlantings.expectedHarvestOn, from), lte(gardenPlantings.expectedHarvestOn, to)));
    for (const r of rows) {
      out.push({ key: `g:${r.id}`, id: r.id, layer: "garden", title: `Harvest: ${r.name}`, date: r.date!, startMin: null, endMin: null, color: "olive", href: "/garden", people: [] });
    }
  }

  if (want("farm") && viewer.can("farm") && !subject) {
    const rows = await db
      .select({ id: animalHealthRecords.id, date: animalHealthRecords.nextDueOn, kind: animalHealthRecords.kind, name: animals.name, animalId: animals.id })
      .from(animalHealthRecords)
      .innerJoin(animals, eq(animals.id, animalHealthRecords.animalId))
      .where(and(eq(animals.familyId, fid), gte(animalHealthRecords.nextDueOn, from), lte(animalHealthRecords.nextDueOn, to)));
    for (const r of rows) {
      out.push({ key: `f:${r.id}`, id: r.id, layer: "farm", title: `${r.name}: ${r.kind}`, date: r.date!, startMin: null, endMin: null, color: "olive", href: `/farm/animals/${r.animalId}`, people: [] });
    }
  }

  if (want("pets") && viewer.can("pets")) {
    const prev = await db
      .select({ id: petPreventatives.id, date: petPreventatives.nextDueOn, product: petPreventatives.productName, pet: pets.name, petId: pets.id, assigneeId: petPreventatives.assigneeId })
      .from(petPreventatives)
      .innerJoin(pets, eq(pets.id, petPreventatives.petId))
      .where(and(eq(pets.familyId, fid), eq(pets.status, "active"), gte(petPreventatives.nextDueOn, from), lte(petPreventatives.nextDueOn, to), subject ? eq(petPreventatives.assigneeId, subject) : undefined));
    for (const r of prev) out.push({ key: `pp:${r.id}`, id: r.id, layer: "pets", title: `${r.pet}: ${r.product}`, date: r.date!, startMin: null, endMin: null, color: "mauve", href: `/pets/${r.petId}`, people: r.assigneeId ? [r.assigneeId] : [] });
    if (!subject) {
      const vet = await db
        .select({ id: petMedicalRecords.id, date: petMedicalRecords.nextDueOn, title: petMedicalRecords.title, pet: pets.name, petId: pets.id })
        .from(petMedicalRecords)
        .innerJoin(pets, eq(pets.id, petMedicalRecords.petId))
        .where(and(eq(pets.familyId, fid), gte(petMedicalRecords.nextDueOn, from), lte(petMedicalRecords.nextDueOn, to)));
      for (const r of vet) out.push({ key: `pv:${r.id}`, id: r.id, layer: "pets", title: `${r.pet}: ${r.title} due`, date: r.date!, startMin: null, endMin: null, color: "mauve", href: `/pets/${r.petId}`, people: [] });
    }
  }

  if (want("home") && viewer.can("maintenance") && !subject) {
    const [reps, stages, docs] = await Promise.all([
      db.select().from(homeRepairs).where(and(eq(homeRepairs.familyId, fid), gte(homeRepairs.scheduledOn, from), lte(homeRepairs.scheduledOn, to))),
      db
        .select({ s: projectStages, title: homeProjects.title })
        .from(projectStages)
        .innerJoin(homeProjects, eq(homeProjects.id, projectStages.projectId))
        .where(and(eq(homeProjects.familyId, fid), isNull(homeProjects.privateOwnerId), gte(projectStages.dueOn, from), lte(projectStages.dueOn, to))),
      db.select().from(homeDocuments).where(and(eq(homeDocuments.familyId, fid), gte(homeDocuments.expiresOn, from), lte(homeDocuments.expiresOn, to))),
    ]);
    for (const r of reps) out.push({ key: `hr:${r.id}`, id: r.id, layer: "home", title: `Repair: ${r.title}`, date: r.scheduledOn!, startMin: null, endMin: null, color: "wine", href: `/maintenance/repairs/${r.id}`, people: [], done: r.status === "completed" });
    for (const r of stages) out.push({ key: `hs:${r.s.id}`, id: r.s.id, layer: "home", title: `${r.title}: ${r.s.name}`, date: r.s.dueOn!, startMin: null, endMin: null, color: "wine", href: `/maintenance/projects/${r.s.projectId}`, people: [], done: r.s.done });
    for (const r of docs) out.push({ key: `hd:${r.id}`, id: r.id, layer: "home", title: `Expires: ${r.title}`, date: r.expiresOn!, startMin: null, endMin: null, color: "wine", href: "/maintenance/documents", people: [] });
  }

  if (want("moon") && viewer.can("witchcraft") && !subject) {
    const tz = viewer.family.timezone;
    const NAMES = { new: "🌑 New Moon", first_quarter: "🌓 First Quarter", full: "🌕 Full Moon", last_quarter: "🌗 Last Quarter" } as const;
    for (const e of phasesBetween(zonedToUtc(from, "00:00", tz), zonedToUtc(addDays(to, 1), "00:00", tz))) {
      const z = utcToZoned(e.at, tz);
      out.push({ key: `mo:${e.at.toISOString()}`, id: e.at.toISOString(), layer: "moon", title: NAMES[e.phase], date: z.date, startMin: z.minutes, endMin: null, color: "lilac", href: `/spiritual/moon?month=${z.date.slice(0, 7)}`, people: [] });
    }
    const overrides = Object.fromEntries((await db.select().from(sabbatSettings).where(eq(sabbatSettings.familyId, fid))).map((r) => [r.key, r.monthDay]));
    for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
      for (const x of wheelForYear(y, { tz, southern: (viewer.family.latitude ?? 1) < 0, overrides })) {
        if (x.date >= from && x.date <= to) out.push({ key: `sb:${x.key}:${y}`, id: x.key, layer: "moon", title: `${x.s.emoji} ${x.s.name}`, date: x.date, startMin: null, endMin: null, color: "orchid", href: `/spiritual/wheel/${x.key}`, people: [] });
      }
    }
  }

  // Religious holidays (built-in plus the family's own days and date changes), per religion the viewer turned on.
  const famFaiths = familyFaiths(viewer.family);
  const faithLayers = (["christian", "catholic", "jewish", "hindu", "buddhist"] as const).filter((l) => want(l) && famFaiths.includes(l));
  if (faithLayers.length && !subject) {
    const COLOR = { christian: "cornflower", catholic: "heather", jewish: "ocean", hindu: "tangerine", buddhist: "sunflower" } as const;
    const list = await familyHolidays(fid, [...faithLayers], from, to);
    // Christian and Catholic share many days: show each once (the Catholic one) when both are on.
    const SAME: Record<string, string> = { maundy_thursday: "holy_thursday", candlemas: "presentation" };
    const catholic = new Set(list.filter((h) => h.faith === "catholic").map((h) => `${h.key}:${h.date}`));
    for (const h of list) {
      if (h.faith === "christian" && catholic.has(`${SAME[h.key] ?? h.key}:${h.date}`)) continue;
      const f = h.faith as (typeof faithLayers)[number];
      for (let d = h.date; d <= (h.endDate ?? h.date); d = addDays(d, 1))
        if (d >= from && d <= to)
          out.push({ key: `fh:${f}:${h.key}:${d}`, id: h.key, layer: f, title: `${h.emoji} ${h.name}${h.endDate ? ` (day ${daysBetween(h.date, d) + 1})` : ""}`, date: d, startMin: null, endMin: null, color: COLOR[f], href: `/spiritual/faith/${f}/holidays?year=${d.slice(0, 4)}`, people: [], type: "holiday", description: h.eve && d === h.date ? `${h.about} Begins at sundown the evening before.` : h.about });
    }
  }

  // Calendars brought in from Google / Outlook / iCloud (Calendar → Sync). Refreshed in the background.
  if (want("synced") && !subject) {
    const imports = await visibleImports(viewer);
    if (imports.length) {
      try {
        after(() => refreshStaleImports(imports));
      } catch {
        /* outside a request: skip the refresh */
      }
    }
    for (const im of imports) {
      for (const ev of im.events) {
        if (ev.allDay) {
          const last = ev.end ? addDays(ev.end, -1) : ev.start;
          for (let d = ev.start; d <= last && d <= to; d = addDays(d, 1))
            if (d >= from) out.push({ key: `im:${im.id}:${ev.uid}:${d}`, id: im.id, layer: "synced", title: ev.title, date: d, startMin: null, endMin: null, color: im.color, location: ev.location, href: "/calendar/sync", people: [], type: "synced", description: `${im.name}${ev.description ? `\n${ev.description}` : ""}` });
        } else {
          const s = utcToZoned(new Date(ev.start), tz);
          if (s.date < from || s.date > to) continue;
          const e = ev.end ? utcToZoned(new Date(ev.end), tz) : null;
          const endMin = e ? (e.date === s.date ? e.minutes : 24 * 60) : s.minutes + 60;
          out.push({ key: `im:${im.id}:${ev.uid}`, id: im.id, layer: "synced", title: ev.title, date: s.date, startMin: s.minutes, endMin, color: im.color, location: ev.location, href: "/calendar/sync", people: [], type: "synced", description: `${im.name}${ev.description ? `\n${ev.description}` : ""}` });
        }
      }
    }
  }

  // Period days: only for people who chose "Show on the calendar", and only to them and the people they share with.
  if (want("cycle")) {
    const owners = (await personalSubjects(viewer, "period")).filter((s) => s.setting.options.showOnCalendar && !s.hiddenAreas.includes("period") && (!subject || s.id === subject));
    if (owners.length) {
      const rows = await db
        .select({ memberId: periodDays.memberId, date: periodDays.date, flow: periodDays.flow })
        .from(periodDays)
        .where(and(inArray(periodDays.memberId, owners.map((o) => o.id)), gte(periodDays.date, from), lte(periodDays.date, to), inArray(periodDays.flow, ["spotting", "light", "medium", "heavy"])));
      for (const r of rows) {
        const o = owners.find((x) => x.id === r.memberId)!;
        const mine = o.id === viewer.member.id;
        out.push({ key: `cy:${r.memberId}:${r.date}`, id: `${r.memberId}:${r.date}`, layer: "cycle", title: `${mine ? "" : `${o.displayName.split(" ")[0]}: `}${r.flow === "spotting" ? "Spotting" : "Period"}`, date: r.date, startMin: null, endMin: null, color: "wine", href: mine ? `/health/period?month=${r.date.slice(0, 7)}` : `/health/period?member=${o.id}&month=${r.date.slice(0, 7)}`, people: [o.id], visibility: mine ? "private" : "selected", type: "cycle" });
      }
    }
  }

  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.startMin ?? -1) - (b.startMin ?? -1) || a.title.localeCompare(b.title));
}

async function memberColorMap(familyId: string) {
  const rows = await db.select({ id: familyMembers.id, color: familyMembers.color }).from(familyMembers).where(eq(familyMembers.familyId, familyId));
  return new Map(rows.map((r) => [r.id, r.color]));
}
