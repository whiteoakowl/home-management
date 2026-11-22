"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { calendarFeeds, calendarImports } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { LAYERS } from "@/lib/calendar";
import { cleanCalendarUrl, FEED_EXCLUDED, feedFor, loadImportedEvents, refreshImport, resetFeedToken } from "@/lib/calendar-sync";
import { MEMBER_COLOR_KEYS } from "@/lib/colors";
import { AuthorizationError, requireModule, requirePremium } from "@/lib/dal";
import { rateLimit } from "@/lib/rate-limit";
import { f } from "@/lib/records";

/**
 * Calendar sync (Calendar → Sync): a private subscribe link for Google /
 * Outlook / Apple, and outside calendars brought in by their iCal link.
 */
const refresh = () => {
  revalidatePath("/calendar/sync");
  revalidatePath("/calendar");
};

export async function saveFeedSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("calendar", "view");
    requirePremium(viewer);
    const feed = await feedFor(viewer);
    const layers = f.list(fd, "layers").filter((l) => (LAYERS as readonly string[]).includes(l) && !FEED_EXCLUDED.includes(l));
    if (!layers.length) return fail("Pick at least one thing to include.");
    await db.update(calendarFeeds).set({ layers, onlyMine: f.bool(fd, "onlyMine") }).where(eq(calendarFeeds.id, feed.id));
    refresh();
    return ok("Saved. Phone calendars pick up changes the next time they refresh.");
  });
}

/** New link; the old one stops working (use it if a link was shared by mistake). */
export async function resetFeed() {
  const viewer = await requireModule("calendar", "view");
  requirePremium(viewer);
  await resetFeedToken(viewer);
  refresh();
}

export async function addCalendarImport(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("calendar", "view");
    requirePremium(viewer);
    const url = cleanCalendarUrl(f.str(fd, "url") ?? "");
    if (!url) return fail("Paste the calendar's iCal link (it starts with https:// or webcal://).", "url");
    const name = f.str(fd, "name")?.slice(0, 60) || "My calendar";
    const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(calendarImports).where(eq(calendarImports.familyId, viewer.family.id));
    if (n >= 30) return fail("Your family already has 30 synced calendars. Remove one first.");
    if (!(await rateLimit(`cal-import:${viewer.member.id}`, 15, 3600))) return fail("Too many tries. Please wait a few minutes.");
    let events;
    try {
      events = await loadImportedEvents(url);
    } catch (e) {
      return fail((e as Error).message || "That calendar link didn't work.", "url");
    }
    const color = f.str(fd, "color");
    await db.insert(calendarImports).values({
      familyId: viewer.family.id,
      memberId: viewer.member.id,
      name,
      url,
      color: color && (MEMBER_COLOR_KEYS as readonly string[]).includes(color) ? color : viewer.member.color,
      shared: fd.get("shared") !== "private",
      events,
      fetchedAt: new Date(),
    });
    refresh();
    return ok(`Added "${name}" with ${events.length} event${events.length === 1 ? "" : "s"}. It stays in sync automatically.`);
  });
}

async function myImport(id: string | null) {
  const viewer = await requireModule("calendar", "view");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new AuthorizationError("Not found.");
  const [row] = await db.select().from(calendarImports).where(and(eq(calendarImports.id, id), eq(calendarImports.familyId, viewer.family.id)));
  if (!row) throw new AuthorizationError("Not found.");
  if (row.memberId !== viewer.member.id && !viewer.isParent) throw new AuthorizationError("Only the person who added this calendar (or a parent) can change it.");
  return row;
}

export async function removeCalendarImport(fd: FormData) {
  const row = await myImport(f.str(fd, "id"));
  await db.delete(calendarImports).where(eq(calendarImports.id, row.id));
  refresh();
}

export async function refreshCalendarImport(fd: FormData) {
  requirePremium(await requireModule("calendar", "view"));
  const row = await myImport(f.str(fd, "id"));
  await refreshImport(row.id);
  refresh();
}

export async function toggleImportShared(fd: FormData) {
  requirePremium(await requireModule("calendar", "view"));
  const row = await myImport(f.str(fd, "id"));
  await db.update(calendarImports).set({ shared: !row.shared }).where(eq(calendarImports.id, row.id));
  refresh();
}
