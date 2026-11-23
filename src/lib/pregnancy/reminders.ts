import "server-only";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { calendarEvents, families, pregnancies, pregnancyAppointments, pregnancyItems, recordAccess } from "@/db/schema";
import { notify } from "../automation";
import { addDays, todayIn, utcToZoned } from "../dates";
import { gestationOn } from "./dates";

/**
 * Pregnancy reminders (every 15 minutes from the cron job). Each one is on
 * or off in the pregnancy's Settings → Reminders; medicine reminders are set
 * per medicine; appointment reminders use the calendar's own reminder. They
 * go only to the pregnant person and people they've let edit, and carry no
 * health details in the text, just a nudge and a link.
 * reminder_state remembers what was sent so overlapping runs never repeat.
 */
export async function sendPregnancyReminders(now = new Date()) {
  let sent = 0;
  const rows = await db
    .select({ p: pregnancies, tz: families.timezone, enabled: families.enabledModules })
    .from(pregnancies)
    .innerJoin(families, eq(families.id, pregnancies.familyId))
    .where(eq(pregnancies.status, "active"));
  for (const { p, tz, enabled } of rows) {
    if (!enabled.includes("pregnancy")) continue;
    const today = todayIn(tz, now);
    const local = utcToZoned(now, tz).minutes;
    const r = p.reminders ?? {};
    const state = { ...(p.reminderState ?? {}) };
    const due: { key: string; value: string; title: string; body?: string; href: string }[] = [];
    const at = (t: string | null | undefined) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null);
    const inWindow = (m: number | null) => m !== null && local >= m && local <= m + 30;
    const g = p.dueDate ? gestationOn(p.dueDate, today) : null;
    const base = `/pregnancy/${p.id}`;

    if (r.weekly !== false && g && local >= 9 * 60 && state.week !== String(g.week)) due.push({ key: "week", value: String(g.week), title: `Week ${g.week}: see what's new`, href: `${base}/weeks?w=${g.week}` });
    if (inWindow(at(r.kicks)) && state.kicks !== today) due.push({ key: "kicks", value: today, title: "Time for a kick count", href: `${base}/kicks` });
    if (inWindow(at(r.journal)) && state.journal !== today) due.push({ key: "journal", value: today, title: "A moment for your pregnancy journal?", href: `${base}/journal` });
    if (r.hydration) {
      for (const [k, m] of [["water1", 11 * 60], ["water2", 15 * 60]] as const) if (inWindow(m) && state[k] !== today) due.push({ key: k, value: today, title: "Gentle reminder: a glass of water", href: base });
    }
    if (r.prep !== false && g) {
      for (const [k, wk, title] of [["prep28", 28, "Third trimester: time to start getting ready"], ["prep32", 32, "Week 32: a good time to pack the hospital bag"], ["prep36", 36, "Week 36: check your birth plan and bag"]] as const)
        if (g.week >= wk && !state[k] && local >= 10 * 60) due.push({ key: k, value: today, title, href: `${base}/prepare` });
    }
    // Medicines with a reminder time.
    const meds = await db.select().from(pregnancyItems).where(and(eq(pregnancyItems.pregnancyId, p.id), eq(pregnancyItems.kind, "medication"), eq(pregnancyItems.done, false)));
    for (const m of meds) {
      if (m.data.remind !== true || !Array.isArray(m.data.times)) continue;
      for (const t of m.data.times as string[]) {
        const k = `med:${m.id}:${t}`;
        if (inWindow(at(t)) && state[k] !== today) due.push({ key: k, value: today, title: `Reminder: ${m.title}`, href: `${base}/care` });
      }
    }
    // Open questions, the day before an appointment.
    if (r.questions !== false) {
      const tomorrow = addDays(today, 1);
      const appts = await db
        .select({ id: pregnancyAppointments.id, startsAt: calendarEvents.startsAt })
        .from(pregnancyAppointments)
        .innerJoin(calendarEvents, eq(calendarEvents.id, pregnancyAppointments.eventId))
        .where(and(eq(pregnancyAppointments.pregnancyId, p.id), gte(calendarEvents.startsAt, now), lte(calendarEvents.startsAt, new Date(now.getTime() + 48 * 3600_000))));
      const open = appts.length
        ? (await db.select({ n: sql<number>`count(*)::int` }).from(pregnancyItems).where(and(eq(pregnancyItems.pregnancyId, p.id), eq(pregnancyItems.kind, "question"), eq(pregnancyItems.done, false))))[0]!.n
        : 0;
      for (const a of appts) {
        const k = `q:${a.id}`;
        if (open > 0 && utcToZoned(a.startsAt, tz).date === tomorrow && local >= 17 * 60 && !state[k]) due.push({ key: k, value: today, title: `Appointment tomorrow: ${open} question${open === 1 ? "" : "s"} to bring`, href: `${base}/appointments#questions` });
      }
    }
    if (!due.length) continue;
    // Claim: only the run that updates from the state it read sends.
    for (const d of due) state[d.key] = d.value;
    const claimed = await db
      .update(pregnancies)
      .set({ reminderState: state })
      .where(and(eq(pregnancies.id, p.id), sql`${pregnancies.reminderState} = ${JSON.stringify(p.reminderState ?? {})}::jsonb`))
      .returning({ id: pregnancies.id });
    if (!claimed.length) continue;
    const editors = await db.select({ m: recordAccess.memberId }).from(recordAccess).where(and(eq(recordAccess.entityType, "pregnancy"), eq(recordAccess.entityId, p.id), eq(recordAccess.canEdit, true)));
    const to = [...new Set([p.memberId, ...(p.visibility === "selected" ? editors.map((e) => e.m) : [])])];
    for (const d of due.slice(0, 4)) {
      await notify(p.familyId, to, { kind: "pregnancy_reminder", title: d.title, body: d.body, href: d.href }, today, { urgent: !d.key.startsWith("week") && !d.key.startsWith("prep") });
      sent++;
    }
  }
  return sent;
}

/** For tests: which members a pregnancy's reminders go to. */
export const reminderTargets = (p: { memberId: string; visibility: string }, editors: string[]) => [...new Set([p.memberId, ...(p.visibility === "selected" ? editors : [])])];
