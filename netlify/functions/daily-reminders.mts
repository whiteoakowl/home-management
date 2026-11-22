/**
 * Netlify scheduled function: every 15 minutes, ask the app to send timed
 * event reminders ("1 hour before") and run the families' daily reminders
 * (chores, events, medical, pets…) in their morning. Needs CRON_SECRET.
 */
async function dailyReminders() {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) return new Response("CRON_SECRET or URL missing", { status: 200 });
  const res = await fetch(`${base}/api/cron/daily`, { method: "POST", headers: { authorization: `Bearer ${secret}` } });
  return new Response(await res.text(), { status: res.status });
}

export default dailyReminders;

export const config = { schedule: "*/15 * * * *" };
