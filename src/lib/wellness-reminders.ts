import "server-only";
import { and, eq, isNotNull, isNull, or, ne } from "drizzle-orm";
import { db } from "@/db";
import { families, familyMembers, personalHealthProfiles, wellnessGoals } from "@/db/schema";
import { notify } from "./automation";
import { todayIn, utcToZoned } from "./dates";
import { goalsWithProgress } from "./wellness-data";

/** Within the 30 minutes after `time` (HH:MM) in the family's time zone? */
const due = (time: string, tz: string, now: Date) => {
  const local = utcToZoned(now, tz).minutes;
  const at = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  return local >= at && local <= at + 30;
};

/**
 * Timed Mental Wellness reminders people chose for themselves: bedtime (sleep
 * journal) and goal/habit reminders, at most once a day each, and a goal's
 * reminder is skipped when it's already done for the day (daily) or the week
 * (weekly). Runs every 15 minutes from the cron job.
 */
export async function sendWellnessTimedReminders(now = new Date()) {
  let sent = 0;
  const bed = await db
    .select({ p: personalHealthProfiles, tz: families.timezone, hidden: familyMembers.hiddenAreas })
    .from(personalHealthProfiles)
    .innerJoin(families, eq(families.id, personalHealthProfiles.familyId))
    .innerJoin(familyMembers, eq(familyMembers.id, personalHealthProfiles.memberId))
    .where(and(isNotNull(personalHealthProfiles.bedtimeReminder), eq(familyMembers.isActive, true)));
  for (const { p, tz, hidden } of bed) {
    if (hidden.includes("wellness") || !p.bedtimeReminder || !due(p.bedtimeReminder, tz, now)) continue;
    const today = todayIn(tz, now);
    const claimed = await db
      .update(personalHealthProfiles)
      .set({ bedtimeReminderOn: today })
      .where(and(eq(personalHealthProfiles.memberId, p.memberId), or(isNull(personalHealthProfiles.bedtimeReminderOn), ne(personalHealthProfiles.bedtimeReminderOn, today))))
      .returning({ m: personalHealthProfiles.memberId });
    if (!claimed.length) continue;
    await notify(p.familyId, [p.memberId], { kind: "wellness_reminder", title: "Time to start winding down 🌙", body: "Screens off soon. Calm sounds and a slow breath can help.", href: "/wellness/sleep" }, today, { urgent: true });
    sent++;
  }

  const goals = await db
    .select({ g: wellnessGoals, tz: families.timezone, hidden: familyMembers.hiddenAreas })
    .from(wellnessGoals)
    .innerJoin(families, eq(families.id, wellnessGoals.familyId))
    .innerJoin(familyMembers, eq(familyMembers.id, wellnessGoals.memberId))
    .where(and(isNotNull(wellnessGoals.reminderTime), isNull(wellnessGoals.archivedAt), eq(familyMembers.isActive, true)));
  for (const { g, tz, hidden } of goals) {
    if (hidden.includes("wellness") || !g.reminderTime || !due(g.reminderTime, tz, now)) continue;
    const today = todayIn(tz, now);
    if (g.lastReminderOn === today) continue;
    // Already done? Stay quiet.
    const viewer = { family: { id: g.familyId }, member: { id: g.memberId } } as Parameters<typeof goalsWithProgress>[0];
    const [prog] = (await goalsWithProgress(viewer, g.memberId, "self", today)).filter((x) => x.id === g.id);
    if (prog && (g.cadence === "daily" ? prog.doneToday : prog.done >= g.timesPerWeek)) continue;
    const claimed = await db
      .update(wellnessGoals)
      .set({ lastReminderOn: today })
      .where(and(eq(wellnessGoals.id, g.id), or(isNull(wellnessGoals.lastReminderOn), ne(wellnessGoals.lastReminderOn, today))))
      .returning({ id: wellnessGoals.id });
    if (!claimed.length) continue;
    await notify(g.familyId, [g.memberId], { kind: "wellness_reminder", title: `A gentle nudge: ${g.title}`, body: g.cadence === "daily" ? "Whenever suits you today." : `${prog?.done ?? 0} of ${g.timesPerWeek} so far this week.`, href: "/wellness/habits" }, today, { urgent: true });
    sent++;
  }
  return { sent };
}
