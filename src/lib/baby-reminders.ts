import "server-only";
import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { babies, babyLogs, babyReminders, families } from "@/db/schema";
import { notify, viewersOf } from "./automation";
import { monthsOld, napWindow } from "./baby-kinds";
import { todayIn, utcToZoned, weekday } from "./dates";

const RELATED: Record<string, string[]> = { feed: ["nursing", "bottle", "solids"], diaper: ["diaper"], pumping: ["pump"], potty: ["potty"], medicine: ["medicine", "vitamin"] };

/**
 * Baby tracker reminders (every 15 minutes from the cron job):
 *  - interval: N minutes since the last related log (sent once per gap)
 *  - time: at a local time on chosen days (once a day)
 *  - once: at a moment (appointments)
 *  - wake: the age-based wake window has run out since the baby last woke
 * Plus automatic reminders the day before and an hour before appointments.
 */
export async function sendBabyReminders(now = new Date()) {
  let sent = 0;
  const rows = await db
    .select({ r: babyReminders, baby: babies, tz: families.timezone, enabled: families.enabledModules })
    .from(babyReminders)
    .innerJoin(babies, eq(babies.id, babyReminders.babyId))
    .innerJoin(families, eq(families.id, babyReminders.familyId))
    .where(and(eq(babyReminders.enabled, true), isNull(babies.archivedAt)));
  for (const { r, baby, tz, enabled } of rows) {
    if (!enabled.includes("baby")) continue;
    const today = todayIn(tz, now);
    let fire = false;
    let body: string | undefined;
    if (r.mode === "interval" && r.intervalMinutes) {
      const kinds = RELATED[r.kind] ?? [];
      if (!kinds.length) continue;
      const [last] = await db.select().from(babyLogs).where(and(eq(babyLogs.babyId, baby.id), inArray(babyLogs.kind, kinds as never[]))).orderBy(desc(babyLogs.startedAt)).limit(1);
      if (!last) continue;
      const since = (now.getTime() - last.startedAt.getTime()) / 60_000;
      fire = since >= r.intervalMinutes && (!r.lastSentAt || r.lastSentAt < last.startedAt);
      body = `It's been ${Math.round(since / 60 * 10) / 10} hours.`;
    } else if (r.mode === "time" && r.time) {
      const local = utcToZoned(now, tz).minutes;
      const at = Number(r.time.slice(0, 2)) * 60 + Number(r.time.slice(3, 5));
      const sentToday = r.lastSentAt && todayIn(tz, r.lastSentAt) === today;
      fire = local >= at && local <= at + 30 && !sentToday && (!r.days.length || r.days.includes(weekday(today)));
    } else if (r.mode === "once" && r.at) {
      fire = r.at <= now && !r.lastSentAt && now.getTime() - r.at.getTime() < 6 * 3600_000;
    } else if (r.mode === "wake") {
      const [lastSleep] = await db.select().from(babyLogs).where(and(eq(babyLogs.babyId, baby.id), eq(babyLogs.kind, "sleep"))).orderBy(desc(babyLogs.startedAt)).limit(1);
      if (!lastSleep?.endedAt) continue; // asleep, or no sleep logged
      const w = napWindow(lastSleep.endedAt, monthsOld(baby.birthDate, today));
      fire = !!w && now >= w.to && now.getTime() - w.to.getTime() < 2 * 3600_000 && (!r.lastSentAt || r.lastSentAt < lastSleep.endedAt);
      body = "The usual awake time for their age is up. Watch for sleepy cues.";
    }
    if (!fire) continue;
    // Claim it so overlapping runs never double-send.
    const claimed = await db
      .update(babyReminders)
      .set({ lastSentAt: now, ...(r.mode === "once" ? { enabled: false } : {}) })
      .where(and(eq(babyReminders.id, r.id), r.lastSentAt ? eq(babyReminders.lastSentAt, r.lastSentAt) : isNull(babyReminders.lastSentAt)))
      .returning({ id: babyReminders.id });
    if (!claimed.length) continue;
    const to = r.memberIds.length ? r.memberIds : await viewersOf(r.familyId, "baby");
    await notify(r.familyId, to, { kind: "baby_reminder", title: `${baby.name}: ${r.title} (${utcToZoned(now, tz).time})`, body, href: `/baby/${baby.id}` }, today, { urgent: true });
    sent++;
  }

  // Appointments logged ahead: a reminder the day before and an hour before.
  const soon = await db
    .select({ l: babyLogs, baby: babies, tz: families.timezone })
    .from(babyLogs)
    .innerJoin(babies, eq(babies.id, babyLogs.babyId))
    .innerJoin(families, eq(families.id, babyLogs.familyId))
    .where(and(inArray(babyLogs.kind, ["appointment", "doctor", "vaccine"]), gte(babyLogs.startedAt, now), lte(babyLogs.startedAt, new Date(now.getTime() + 26 * 3600_000))));
  for (const { l, baby, tz } of soon) {
    const hrs = (l.startedAt.getTime() - now.getTime()) / 3600_000;
    const key = hrs <= 1.25 ? "remindedHour" : hrs <= 25 ? "remindedDay" : null;
    if (!key || l.data[key]) continue;
    const claimed = await db
      .update(babyLogs)
      .set({ data: sql`${babyLogs.data} || ${JSON.stringify({ [key]: true })}::jsonb` })
      .where(and(eq(babyLogs.id, l.id), sql`not (${babyLogs.data} ? ${key})`))
      .returning({ id: babyLogs.id });
    if (!claimed.length) continue;
    const z = utcToZoned(l.startedAt, tz);
    const to = await viewersOf(l.familyId, "baby");
    await notify(l.familyId, to, { kind: "baby_reminder", title: `${baby.name}: ${String(l.data.title ?? "Appointment")} ${key === "remindedHour" ? "in about an hour" : "tomorrow"} (${z.time})`, body: l.data.where ? String(l.data.where) : undefined, href: `/baby/${baby.id}/health` }, todayIn(tz, now), { urgent: true });
    sent++;
  }
  return { sent };
}
