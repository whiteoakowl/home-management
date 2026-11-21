"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { eventTemplates } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { saveEvent } from "./calendar";
import { cleanColor } from "@/lib/colors";
import { AuthorizationError, requireModule } from "@/lib/dal";
import { addDays, todayIn } from "@/lib/dates";
import { ownedCategoryId } from "@/lib/queries";
import { f, familyMemberIds } from "@/lib/records";

/**
 * Event templates (Calendar → Templates): save "Soccer practice, Tuesdays
 * 5:30, the park, Jack, remind 1 hour before" once, then create the
 * repeating event in one tap.
 */
const hhmm = (v: string | null) => (v && /^\d{2}:\d{2}$/.test(v) ? v : null);

export async function saveEventTemplate(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("calendar", "use");
    const name = f.str(fd, "name");
    if (!name) return fail("Name the template.", "name");
    const duration = f.int(fd, "durationMin");
    const reminder = f.int(fd, "reminderMinutes");
    const values = {
      name: name.slice(0, 80),
      title: (f.str(fd, "title") ?? name).slice(0, 120),
      location: f.str(fd, "location")?.slice(0, 200) ?? null,
      description: f.str(fd, "description")?.slice(0, 2000) ?? null,
      categoryId: await ownedCategoryId(viewer, "calendar", f.str(fd, "categoryId")),
      color: cleanColor(f.str(fd, "color")),
      startTime: f.bool(fd, "allDay") ? null : (hhmm(f.str(fd, "startTime")) ?? "17:00"),
      durationMin: duration && duration > 0 && duration <= 24 * 60 ? duration : 60,
      weekdays: [...new Set(f.list(fd, "weekday").map(Number).filter((n) => n >= 0 && n <= 6))].sort(),
      memberIds: await familyMemberIds(viewer.family.id, f.list(fd, "attendees")),
      reminderMinutes: reminder !== null && reminder >= 0 && reminder <= 10080 ? reminder : null,
    };
    const id = f.str(fd, "id");
    if (id) {
      const [row] = await db.select().from(eventTemplates).where(and(eq(eventTemplates.id, id), eq(eventTemplates.familyId, viewer.family.id)));
      if (!row) throw new AuthorizationError("Not found.");
      if (!viewer.isParent && row.createdByMemberId !== viewer.member.id) throw new AuthorizationError("Only the person who made this template (or a parent) can change it.");
      await db.update(eventTemplates).set(values).where(eq(eventTemplates.id, id));
    } else await db.insert(eventTemplates).values({ ...values, familyId: viewer.family.id, createdByMemberId: viewer.member.id });
    revalidatePath("/calendar/templates");
    return ok("Template saved.");
  });
}

export async function deleteEventTemplate(fd: FormData) {
  const viewer = await requireModule("calendar", "use");
  const id = f.str(fd, "id") ?? "";
  const [row] = await db.select().from(eventTemplates).where(and(eq(eventTemplates.id, id), eq(eventTemplates.familyId, viewer.family.id)));
  if (!row) return;
  if (!viewer.isParent && row.createdByMemberId !== viewer.member.id) throw new AuthorizationError("Only the person who made this template (or a parent) can delete it.");
  await db.delete(eventTemplates).where(eq(eventTemplates.id, id));
  revalidatePath("/calendar/templates");
}

/** Create the calendar event from a template, starting on the chosen date (optionally ending on another). */
export async function useEventTemplate(state: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("calendar", "use");
    const [t] = await db.select().from(eventTemplates).where(and(eq(eventTemplates.id, f.str(fd, "id") ?? ""), eq(eventTemplates.familyId, viewer.family.id)));
    if (!t) return fail("That template is gone.");
    const from = f.date(fd, "startDate") ?? todayIn(viewer.family.timezone);
    const until = f.date(fd, "until");
    if (until && until < from) return fail("The end date is before the start date.", "until");
    // First date on or after the start that falls on one of the template's days.
    let first = from;
    if (t.weekdays.length) for (let i = 0; i < 7 && !t.weekdays.includes(new Date(`${first}T12:00:00Z`).getUTCDay()); i++) first = addDays(first, 1);
    const ev = new FormData();
    ev.set("title", t.title);
    ev.set("date", first);
    if (t.startTime) {
      ev.set("startTime", t.startTime);
      const [h, m] = t.startTime.split(":").map(Number) as [number, number];
      const end = h * 60 + m + t.durationMin;
      if (end < 24 * 60) ev.set("endTime", `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`);
    } else ev.set("allDay", "on");
    if (t.location) ev.set("location", t.location);
    if (t.description) ev.set("description", t.description);
    if (t.categoryId) ev.set("categoryId", t.categoryId);
    if (t.color) ev.set("color", t.color);
    if (t.reminderMinutes !== null) ev.set("reminderMinutes", String(t.reminderMinutes));
    for (const m of t.memberIds) ev.append("attendees", m);
    ev.set("visibility", "family");
    if (t.weekdays.length) {
      ev.set("repeat", "weekly");
      ev.set("interval", "1");
      for (const d of t.weekdays) ev.append("weekday", String(d));
      if (until) ev.set("until", until);
    }
    const res = await saveEvent(state, ev);
    if (!res?.ok) return res;
    revalidatePath("/calendar", "layout");
    return ok(`Added "${t.title}" to the calendar${t.weekdays.length ? `, repeating weekly${until ? ` until ${until}` : ""}` : ""}.`);
  });
}
