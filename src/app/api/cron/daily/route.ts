import { timingSafeEqual } from "node:crypto";
import { db } from "@/db";
import { isNull, lt, or } from "drizzle-orm";
import { calendarImports, families } from "@/db/schema";
import { refreshImport } from "@/lib/calendar-sync";
import { runDailyAutomation } from "@/lib/automation";
import { todayIn } from "@/lib/dates";

export const dynamic = "force-dynamic";

/**
 * Hourly (netlify/functions/daily-reminders.mts): runs each family's daily
 * reminders once their local morning starts (7am–8pm), so reminders reach
 * phones even if nobody opened the app that day. Protected by CRON_SECRET.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) return new Response("Not allowed", { status: 401 });

  const started = Date.now();
  const all = await db.select().from(families);
  let ran = 0,
    waiting = 0;
  for (const f of all) {
    if (Date.now() - started > 20000) {
      waiting++;
      continue; // next hour picks up the rest
    }
    const today = todayIn(f.timezone);
    if (f.settings?.lastAutomationOn === today) continue;
    const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: f.timezone, hour: "numeric", hourCycle: "h23" }).format(new Date()));
    if (hour < 7 || hour >= 20) continue;
    try {
      await runDailyAutomation(f);
      ran++;
    } catch (e) {
      console.error(`Daily run failed for family ${f.id}:`, e);
    }
  }
  // Keep calendars brought in from Google / Outlook / iCloud fresh (a few per hour).
  let synced = 0;
  if (Date.now() - started < 20000) {
    const stale = await db.select({ id: calendarImports.id }).from(calendarImports).where(or(isNull(calendarImports.fetchedAt), lt(calendarImports.fetchedAt, new Date(Date.now() - 3 * 3600000)))).limit(15);
    await Promise.all(stale.map((s) => refreshImport(s.id)));
    synced = stale.length;
  }
  return Response.json({ ok: true, ran, waiting, synced });
}
