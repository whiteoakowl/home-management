import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { calendarFeeds, families, familyMembers, users } from "@/db/schema";
import { familyAccess } from "@/lib/billing";
import { getCalendarItems, LAYERS, type Layer } from "@/lib/calendar";
import { FEED_EXCLUDED } from "@/lib/calendar-sync";
import { resolveViewer } from "@/lib/dal";
import { addDays, todayIn } from "@/lib/dates";
import { buildIcs } from "@/lib/ics";
import { siteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

const ics = (body: string) =>
  new Response(body, { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "private, max-age=900", "content-disposition": 'inline; filename="family-calendar.ics"' } });

/**
 * A member's private calendar subscribe link (Google Calendar, Outlook, Apple
 * Calendar). Shows exactly what that member sees in the app, for 30 days back
 * and a year ahead. An unknown or reset link gets 404.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/calendar/feed/[token]">) {
  const token = (await ctx.params).token.replace(/\.ics$/i, "");
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return new Response("Not found", { status: 404 });
  const [row] = await db
    .select({ feed: calendarFeeds, member: familyMembers, family: families })
    .from(calendarFeeds)
    .innerJoin(familyMembers, eq(familyMembers.id, calendarFeeds.memberId))
    .innerJoin(families, eq(families.id, calendarFeeds.familyId))
    .where(and(eq(calendarFeeds.token, token), eq(familyMembers.isActive, true)));
  if (!row) return new Response("Not found", { status: 404 });
  const { feed, member, family } = row;
  const name = `${family.name} Family`;
  // Lapsed subscription: an empty calendar (subscriptions keep working once it's renewed).
  if (!(await familyAccess(family.id)).premium) return ics(buildIcs({ name, timezone: family.timezone, items: [] }));

  const [u] = member.userId ? await db.select({ id: users.id, email: users.email, name: users.name }).from(users).where(eq(users.id, member.userId)) : [];
  const viewer = await resolveViewer(u ?? { id: "", email: "", name: member.displayName }, member, family);
  const today = todayIn(family.timezone);
  const layers = feed.layers.filter((l): l is Layer => (LAYERS as readonly string[]).includes(l) && !FEED_EXCLUDED.includes(l));
  const items = await getCalendarItems(viewer, addDays(today, -30), addDays(today, 365), { layers, memberId: feed.onlyMine ? member.id : null });
  const base = await siteUrl();
  await db.update(calendarFeeds).set({ lastFetchedAt: new Date() }).where(eq(calendarFeeds.id, feed.id));
  return ics(
    buildIcs({
      name,
      timezone: family.timezone,
      items: items
        .filter((i) => i.layer !== "cycle" && i.layer !== "synced")
        .map((i) => ({ uid: `${i.key}@${new URL(base).hostname}`, title: i.done ? `✓ ${i.title}` : i.title, date: i.date, startMin: i.startMin, endMin: i.endMin, location: i.location, description: i.description, url: `${base}${i.href}` })),
    }),
  );
}
