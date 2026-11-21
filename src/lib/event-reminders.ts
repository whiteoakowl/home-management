import "server-only";
import { and, eq, gte, inArray, isNotNull, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { calendarEvents, eventAttendees, eventRemindersSent, families, recurrenceRules } from "@/db/schema";
import { notify } from "./automation";
import { addDays, todayIn, utcToZoned, zonedToUtc } from "./dates";
import { occurrencesBetween } from "./recurrence";

const MAX_LEAD_MIN = 7 * 24 * 60; // reminders up to a week before
const CATCH_UP_MIN = 20; // the job runs every 15 minutes

const lead = (m: number) => (m >= 1440 && m % 1440 === 0 ? `${m / 1440} day${m === 1440 ? "" : "s"}` : m >= 60 && m % 60 === 0 ? `${m / 60} hour${m === 60 ? "" : "s"}` : `${m} minutes`);

/**
 * Timed event reminders ("remind me 1 hour before"), including every date of
 * repeating events. Goes to the event's people (or whoever made it), in the
 * app and as push. Each occurrence is reminded once.
 */
export async function sendEventReminders(now = new Date()) {
  const horizon = new Date(now.getTime() + (MAX_LEAD_MIN + 60) * 60000);
  const rows = await db
    .select({ e: calendarEvents, rule: recurrenceRules, tz: families.timezone })
    .from(calendarEvents)
    .innerJoin(families, eq(families.id, calendarEvents.familyId))
    .leftJoin(recurrenceRules, eq(recurrenceRules.id, calendarEvents.recurrenceRuleId))
    .where(
      and(
        isNotNull(calendarEvents.reminderMinutes),
        or(and(isNull(calendarEvents.recurrenceRuleId), gte(calendarEvents.startsAt, new Date(now.getTime() - 60 * 60000)), lte(calendarEvents.startsAt, horizon)), isNotNull(calendarEvents.recurrenceRuleId)),
      ),
    );

  type Due = { eventId: string; familyId: string; tz: string; title: string; location: string | null; start: Date; allDay: boolean; minutes: number; creator: string | null };
  const due: Due[] = [];
  for (const { e, rule, tz } of rows) {
    const minutes = e.reminderMinutes!;
    if (minutes < 0 || minutes > MAX_LEAD_MIN) continue;
    let starts: Date[] = [e.startsAt];
    if (rule) {
      if (!rule.enabled) continue;
      const today = todayIn(tz, now);
      const local = utcToZoned(e.startsAt, tz);
      starts = occurrencesBetween({ ...rule, byWeekday: rule.byWeekday, byMonthDay: rule.byMonthDay, byMonth: rule.byMonth }, addDays(today, -1), addDays(today, 8))
        .filter((d) => !(e.skippedDates ?? []).includes(d))
        .map((d) => zonedToUtc(d, e.allDay ? "00:00" : local.time, tz));
    }
    for (const start of starts) {
      const remindAt = start.getTime() - minutes * 60000;
      if (remindAt <= now.getTime() && remindAt > now.getTime() - CATCH_UP_MIN * 60000 && start.getTime() > now.getTime() - 5 * 60000)
        due.push({ eventId: e.id, familyId: e.familyId, tz, title: e.title, location: e.location, start, allDay: e.allDay, minutes, creator: e.createdByMemberId });
    }
  }
  if (!due.length) return { sent: 0 };

  const attendees = await db.select().from(eventAttendees).where(inArray(eventAttendees.eventId, [...new Set(due.map((d) => d.eventId))]));
  let sent = 0;
  for (const d of due) {
    // Claim it first so two overlapping runs never remind twice.
    const claimed = await db.insert(eventRemindersSent).values({ eventId: d.eventId, occursAt: d.start }).onConflictDoNothing().returning();
    if (!claimed.length) continue;
    const people = attendees.filter((a) => a.eventId === d.eventId).map((a) => a.memberId);
    const to = people.length ? people : d.creator ? [d.creator] : [];
    if (!to.length) continue;
    const z = utcToZoned(d.start, d.tz);
    const time = new Date(`2000-01-01T${z.time}:00Z`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
    const when = d.allDay ? (d.minutes >= 1440 ? `in ${lead(d.minutes)}` : "today") : d.minutes === 0 ? `now (${time})` : `at ${time}, in ${lead(d.minutes)}`;
    await notify(
      d.familyId,
      to,
      { kind: "event_reminder", title: `${d.title} ${when}`, body: d.location ?? undefined, href: `/calendar?date=${z.date}&view=day` },
      todayIn(d.tz, now),
      { urgent: true },
    );
    sent++;
  }
  return { sent };
}
