import "server-only";
import { randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { cleanCalendarUrl, isPrivateAddress } from "./calendar-url";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { calendarFeeds, calendarImports, type ImportedEvent } from "@/db/schema";
import type { Viewer } from "./dal";
import { parseIcs } from "./ics";

export { cleanCalendarUrl };

/** What a new subscribe link includes. */
export const DEFAULT_FEED_LAYERS = ["events", "plans", "chores", "sports", "dance", "work"];
/** Never in a feed: private health (cycle) and other people's synced calendars. */
export const FEED_EXCLUDED = ["cycle", "synced"];

const newToken = () => randomBytes(24).toString("base64url");

export async function feedFor(viewer: Viewer) {
  const [row] = await db.select().from(calendarFeeds).where(eq(calendarFeeds.memberId, viewer.member.id));
  if (row) return row;
  const [made] = await db
    .insert(calendarFeeds)
    .values({ familyId: viewer.family.id, memberId: viewer.member.id, token: newToken(), layers: DEFAULT_FEED_LAYERS })
    .onConflictDoNothing()
    .returning();
  return made ?? (await db.select().from(calendarFeeds).where(eq(calendarFeeds.memberId, viewer.member.id)))[0]!;
}

export async function resetFeedToken(viewer: Viewer) {
  await feedFor(viewer);
  await db.update(calendarFeeds).set({ token: newToken() }).where(eq(calendarFeeds.memberId, viewer.member.id));
}

// ─── Bringing in outside calendars ───────────────────────────────────────────

async function assertPublicHost(url: URL) {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("That address isn't a public calendar link.");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new Error("That address isn't a public calendar link.");
}

/** Download an .ics file safely: https only, public hosts only, 8 seconds, 5 MB. */
export async function fetchCalendarText(rawUrl: string): Promise<string> {
  let url = new URL(rawUrl);
  for (let hop = 0; hop < 4; hop++) {
    if (url.protocol !== "https:") throw new Error("Calendar links must start with https.");
    await assertPublicHost(url);
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(8000), headers: { accept: "text/calendar, */*;q=0.5", "user-agent": "FamilyCalendarSync/1.0" } });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    if (res.status === 401 || res.status === 403 || res.status === 404) throw new Error("That calendar link didn't work. Copy the private (secret) iCal address again.");
    if (!res.ok || !res.body) throw new Error(`The calendar service answered ${res.status}. Try again later.`);
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 5 * 1024 * 1024) {
        await reader.cancel();
        throw new Error("That calendar is too large to bring in (over 5 MB).");
      }
      chunks.push(value);
    }
    const text = new TextDecoder().decode(Buffer.concat(chunks));
    if (!text.includes("BEGIN:VCALENDAR")) throw new Error("That link isn't a calendar (.ics) address.");
    return text;
  }
  throw new Error("That calendar link redirects too many times.");
}

/** The window we keep from outside calendars: 2 months back, 13 months ahead. */
const windowNow = () => {
  const now = Date.now();
  return { from: new Date(now - 62 * 86400000), to: new Date(now + 400 * 86400000) };
};

export async function loadImportedEvents(url: string): Promise<ImportedEvent[]> {
  const text = await fetchCalendarText(url);
  const { from, to } = windowNow();
  try {
    return parseIcs(text, from, to);
  } catch {
    throw new Error("That calendar file couldn't be read.");
  }
}

/** Refresh one imported calendar; keeps the old events if the service is down. */
export async function refreshImport(id: string) {
  const [row] = await db.select().from(calendarImports).where(eq(calendarImports.id, id));
  if (!row) return;
  try {
    const events = await loadImportedEvents(row.url);
    await db.update(calendarImports).set({ events, fetchedAt: new Date(), lastError: null }).where(eq(calendarImports.id, id));
  } catch (e) {
    await db.update(calendarImports).set({ fetchedAt: new Date(), lastError: (e as Error).message.slice(0, 300) }).where(eq(calendarImports.id, id));
  }
}

/** Imported calendars this viewer may see: shared ones, plus their own private ones. */
export async function visibleImports(viewer: Viewer) {
  return db
    .select()
    .from(calendarImports)
    .where(and(eq(calendarImports.familyId, viewer.family.id), or(eq(calendarImports.shared, true), eq(calendarImports.memberId, viewer.member.id))));
}

/** Refresh calendars older than 30 minutes (a few at a time, in the background). */
export async function refreshStaleImports(rows: { id: string; fetchedAt: Date | null }[]) {
  const stale = rows.filter((r) => !r.fetchedAt || Date.now() - r.fetchedAt.getTime() > 30 * 60000).slice(0, 4);
  await Promise.all(stale.map((r) => refreshImport(r.id)));
}
