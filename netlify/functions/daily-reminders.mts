/**
 * Netlify scheduled function: every hour, ask the app to run the families'
 * daily reminders (chores, events, medical, pets…) so they reach phones as
 * push notifications in the morning. Needs CRON_SECRET set on the site.
 */
async function dailyReminders() {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) return new Response("CRON_SECRET or URL missing", { status: 200 });
  const res = await fetch(`${base}/api/cron/daily`, { method: "POST", headers: { authorization: `Bearer ${secret}` } });
  return new Response(await res.text(), { status: res.status });
}

export default dailyReminders;

export const config = { schedule: "@hourly" };
