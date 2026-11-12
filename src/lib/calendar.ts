import "server-only";
import { and, asc, eq, gte, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  animalHealthRecords,
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
} from "@/db/schema";
import { automationOn } from "./automation";
import { visibleTo, type Viewer } from "./dal";
import { addDays, utcToZoned, zonedToUtc } from "./dates";
import { occurrencesBetween, type Rule } from "./recurrence";

export const LAYERS = ["events", "chores", "workouts", "meals", "garden", "farm"] as const;
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
};

const DEFAULT_CALENDAR_CATEGORIES = [
  ["School", "orchid"],
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
      .select({ e: calendarEvents, rule: recurrenceRules, catColor: categories.color })
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

    for (const { e, rule, catColor } of rows) {
      const ids = (people.get(e.id) ?? []).map((a) => a.memberId);
      if (subject && !ids.includes(subject)) continue;
      const color = e.color ?? catColor ?? (ids[0] ? colorOf.get(ids[0]) : null) ?? "plum";
      const start = utcToZoned(e.startsAt, tz);
      const durMin = e.endsAt ? Math.max(15, Math.round((e.endsAt.getTime() - e.startsAt.getTime()) / 60000)) : 60;
      const dates = rule ? occurrencesBetween({ ...(rule as unknown as Rule), startsOn: start.date }, from, to) : [start.date];
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
          href: `/calendar/event/${e.id}${rule ? `?on=${date}` : ""}`,
          recurring: !!rule,
          people: ids,
        });
      }
    }
  }

  if (want("chores") && (viewer.can("chores") || viewer.can("house"))) {
    const a = alias(familyMembers, "a");
    const rows = await db
      .select({ id: choreOccurrences.id, choreId: chores.id, title: chores.title, date: choreOccurrences.dueDate, status: choreOccurrences.status, assigneeId: choreOccurrences.assigneeId, color: a.color })
      .from(choreOccurrences)
      .innerJoin(chores, eq(chores.id, choreOccurrences.choreId))
      .leftJoin(a, eq(a.id, choreOccurrences.assigneeId))
      .where(
        and(
          eq(choreOccurrences.familyId, fid),
          gte(choreOccurrences.dueDate, from),
          lte(choreOccurrences.dueDate, to),
          inArray(choreOccurrences.status, ["pending", "done"]),
          subject ? eq(choreOccurrences.assigneeId, subject) : undefined,
        ),
      );
    for (const r of rows) {
      out.push({ key: `c:${r.id}`, id: r.id, layer: "chores", title: r.title, date: r.date, startMin: null, endMin: null, color: r.color ?? "slate", href: `/house/chores/${r.choreId}`, people: r.assigneeId ? [r.assigneeId] : [], done: r.status === "done" });
    }
  }

  if (want("workouts") && viewer.can("fitness") && automationOn(viewer.family, "workoutCalendar")) {
    const rows = await db
      .select({ w: workouts, rule: recurrenceRules, memberId: fitnessPlans.memberId, color: familyMembers.color, name: familyMembers.displayName })
      .from(workouts)
      .innerJoin(fitnessPlans, eq(fitnessPlans.id, workouts.planId))
      .innerJoin(recurrenceRules, eq(recurrenceRules.id, workouts.recurrenceRuleId))
      .innerJoin(familyMembers, eq(familyMembers.id, fitnessPlans.memberId))
      .where(and(eq(fitnessPlans.familyId, fid), subject ? eq(fitnessPlans.memberId, subject) : undefined));
    for (const r of rows) {
      for (const date of occurrencesBetween(r.rule as unknown as Rule, from, to)) {
        out.push({ key: `w:${r.w.id}:${date}`, id: r.w.id, layer: "workouts", title: `${r.name.split(" ")[0]}: ${r.w.name}`, date, startMin: null, endMin: null, color: r.color, href: "/fitness", recurring: true, people: [r.memberId] });
      }
    }
  }

  if (want("meals") && viewer.can("meals") && !subject) {
    const rows = await db
      .select({ id: mealPlanEntries.id, date: mealPlanEntries.date, slot: mealPlanEntries.slot, title: mealPlanEntries.title, recipe: recipes.name })
      .from(mealPlanEntries)
      .leftJoin(recipes, eq(recipes.id, mealPlanEntries.recipeId))
      .where(and(eq(mealPlanEntries.familyId, fid), gte(mealPlanEntries.date, from), lte(mealPlanEntries.date, to), eq(mealPlanEntries.slot, "dinner")))
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

  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.startMin ?? -1) - (b.startMin ?? -1) || a.title.localeCompare(b.title));
}

async function memberColorMap(familyId: string) {
  const rows = await db.select({ id: familyMembers.id, color: familyMembers.color }).from(familyMembers).where(eq(familyMembers.familyId, familyId));
  return new Map(rows.map((r) => [r.id, r.color]));
}
