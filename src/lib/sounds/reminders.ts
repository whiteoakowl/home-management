import "server-only";
import { and, eq, isNotNull, or, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { families, familyMembers, soundPreferences } from "@/db/schema";
import { notify } from "../automation";
import { todayIn, utcToZoned, weekday } from "../dates";

const TITLES: Record<string, string> = {
  bedtime: "Time to get ready for bed 🌙",
  relax: "Time for a relaxation break",
  meditation: "Time to meditate",
  routine: "Time to start your sleep routine",
};

/**
 * Optional Sleep Sounds reminders (only for members who set a time). Runs
 * every 15 minutes from the cron job and sends each reminder at most once a
 * day, in the family's time zone.
 */
export async function sendSoundReminders(now = new Date()) {
  const rows = await db
    .select({ p: soundPreferences, tz: families.timezone, enabled: families.enabledModules })
    .from(soundPreferences)
    .innerJoin(families, eq(families.id, soundPreferences.familyId))
    .innerJoin(familyMembers, eq(familyMembers.id, soundPreferences.memberId))
    .where(and(isNotNull(soundPreferences.reminderTime), eq(familyMembers.isActive, true)));
  let sent = 0;
  for (const { p, tz, enabled } of rows) {
    if (!enabled.includes("sounds") || !p.reminderTime) continue;
    const today = todayIn(tz, now);
    if (p.lastReminderOn === today) continue;
    if (p.reminderDays.length && !p.reminderDays.includes(weekday(today))) continue;
    const local = utcToZoned(now, tz).minutes;
    const at = Number(p.reminderTime.slice(0, 2)) * 60 + Number(p.reminderTime.slice(3, 5));
    if (local < at || local > at + 30) continue;
    // Claim it first so two overlapping runs never send twice.
    const claimed = await db
      .update(soundPreferences)
      .set({ lastReminderOn: today })
      .where(and(eq(soundPreferences.memberId, p.memberId), or(isNull(soundPreferences.lastReminderOn), ne(soundPreferences.lastReminderOn, today))))
      .returning({ m: soundPreferences.memberId });
    if (!claimed.length) continue;
    await notify(p.familyId, [p.memberId], { kind: "sound_reminder", title: TITLES[p.reminderKind ?? "bedtime"] ?? TITLES.bedtime!, body: "Your Sleep Sounds are ready when you are.", href: "/sounds" }, today, { urgent: true });
    sent++;
  }
  return { sent };
}
