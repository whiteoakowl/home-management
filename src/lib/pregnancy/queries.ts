import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { calendarEvents, pregnancyAppointments, pregnancyEntries, pregnancyItems, pregnancyLogs, type PregnancyLogKind } from "@/db/schema";

/**
 * Reads for one pregnancy. Callers must already have loaded the pregnancy
 * with getPregnancy (which checks family and visibility); every query here is
 * also scoped by pregnancyId. Lists are capped so old history is never
 * loaded all at once.
 */
export type PLog = typeof pregnancyLogs.$inferSelect;
export type PItem = typeof pregnancyItems.$inferSelect;
export type PEntry = typeof pregnancyEntries.$inferSelect;

export function logsOf(pregnancyId: string, kinds: PregnancyLogKind[], opts: { since?: Date; before?: Date; limit?: number } = {}) {
  const where: SQL[] = [eq(pregnancyLogs.pregnancyId, pregnancyId), inArray(pregnancyLogs.kind, kinds)];
  if (opts.since) where.push(gte(pregnancyLogs.startedAt, opts.since));
  if (opts.before) where.push(lt(pregnancyLogs.startedAt, opts.before));
  return db
    .select()
    .from(pregnancyLogs)
    .where(and(...where))
    .orderBy(desc(pregnancyLogs.startedAt))
    .limit(Math.min(opts.limit ?? 200, 1000));
}

export function itemsOf(pregnancyId: string, kind: PItem["kind"], list?: string) {
  return db
    .select()
    .from(pregnancyItems)
    .where(and(eq(pregnancyItems.pregnancyId, pregnancyId), eq(pregnancyItems.kind, kind), list ? eq(pregnancyItems.list, list) : undefined))
    .orderBy(asc(pregnancyItems.done), asc(pregnancyItems.position), asc(pregnancyItems.createdAt))
    .limit(500);
}

export type PAppointment = Awaited<ReturnType<typeof appointmentsOf>>[number];

export function appointmentsOf(pregnancyId: string, opts: { from?: Date; to?: Date; limit?: number; order?: "asc" | "desc" } = {}) {
  return db
    .select({
      id: pregnancyAppointments.id,
      kind: pregnancyAppointments.kind,
      provider: pregnancyAppointments.provider,
      tests: pregnancyAppointments.tests,
      results: pregnancyAppointments.results,
      followUpOn: pregnancyAppointments.followUpOn,
      eventId: calendarEvents.id,
      title: calendarEvents.title,
      location: calendarEvents.location,
      startsAt: calendarEvents.startsAt,
      endsAt: calendarEvents.endsAt,
      reminderMinutes: calendarEvents.reminderMinutes,
      questions: calendarEvents.description,
      notes: calendarEvents.notes,
    })
    .from(pregnancyAppointments)
    .innerJoin(calendarEvents, eq(calendarEvents.id, pregnancyAppointments.eventId))
    .where(and(eq(pregnancyAppointments.pregnancyId, pregnancyId), opts.from ? gte(calendarEvents.startsAt, opts.from) : undefined, opts.to ? lt(calendarEvents.startsAt, opts.to) : undefined))
    .orderBy(opts.order === "desc" ? desc(calendarEvents.startsAt) : asc(calendarEvents.startsAt))
    .limit(opts.limit ?? 200);
}

export function entriesOf(pregnancyId: string, kinds: PEntry["kind"][], opts: { q?: string | null; category?: string | null; week?: number | null; limit?: number; offset?: number } = {}) {
  const q = opts.q?.trim().slice(0, 80);
  return db
    .select()
    .from(pregnancyEntries)
    .where(
      and(
        eq(pregnancyEntries.pregnancyId, pregnancyId),
        inArray(pregnancyEntries.kind, kinds),
        opts.category ? eq(pregnancyEntries.category, opts.category) : undefined,
        opts.week ? eq(pregnancyEntries.week, opts.week) : undefined,
        q ? or(ilike(pregnancyEntries.title, `%${q.replace(/[%_\\]/g, "\\$&")}%`), ilike(pregnancyEntries.body, `%${q.replace(/[%_\\]/g, "\\$&")}%`)) : undefined,
      ),
    )
    .orderBy(desc(pregnancyEntries.date), desc(pregnancyEntries.createdAt))
    .limit(Math.min(opts.limit ?? 30, 200))
    .offset(Math.max(0, opts.offset ?? 0));
}

/** Counts for the tab badges and dashboard. */
export async function pregnancyCounts(pregnancyId: string) {
  const [r] = await db
    .select({
      openQuestions: sql<number>`(select count(*)::int from ${pregnancyItems} where ${pregnancyItems.pregnancyId} = ${pregnancyId} and ${pregnancyItems.kind} = 'question' and not ${pregnancyItems.done})`,
      names: sql<number>`(select count(*)::int from ${pregnancyItems} where ${pregnancyItems.pregnancyId} = ${pregnancyId} and ${pregnancyItems.kind} = 'name')`,
      checklistOpen: sql<number>`(select count(*)::int from ${pregnancyItems} where ${pregnancyItems.pregnancyId} = ${pregnancyId} and ${pregnancyItems.kind} = 'checklist' and not ${pregnancyItems.done})`,
      checklistAll: sql<number>`(select count(*)::int from ${pregnancyItems} where ${pregnancyItems.pregnancyId} = ${pregnancyId} and ${pregnancyItems.kind} = 'checklist')`,
    })
    .from(sql`(select 1) as one`);
  return r!;
}

/** Search across everything in a pregnancy (for Timeline & search). */
export async function searchPregnancy(pregnancyId: string, q: string) {
  const term = `%${q.trim().slice(0, 80).replace(/[%_\\]/g, "\\$&")}%`;
  const [entries, items, logs, appts] = await Promise.all([
    db.select().from(pregnancyEntries).where(and(eq(pregnancyEntries.pregnancyId, pregnancyId), or(ilike(pregnancyEntries.title, term), ilike(pregnancyEntries.body, term), ilike(pregnancyEntries.category, term)))).orderBy(desc(pregnancyEntries.date)).limit(40),
    db.select().from(pregnancyItems).where(and(eq(pregnancyItems.pregnancyId, pregnancyId), or(ilike(pregnancyItems.title, term), ilike(pregnancyItems.notes, term)))).limit(40),
    db.select().from(pregnancyLogs).where(and(eq(pregnancyLogs.pregnancyId, pregnancyId), or(ilike(pregnancyLogs.notes, term), sql`${pregnancyLogs.data}::text ilike ${term}`))).orderBy(desc(pregnancyLogs.startedAt)).limit(40),
    appointmentsOf(pregnancyId, { order: "desc", limit: 200 }).then((rows) => rows.filter((a) => [a.title, a.provider, a.notes, a.questions, a.tests, a.results, a.location].some((s) => s && s.toLowerCase().includes(q.trim().toLowerCase())))),
  ]);
  return { entries, items, logs, appts };
}
