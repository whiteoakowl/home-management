"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { calendarEvents, eventAttachments, eventAttendees } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { AuthorizationError, requireModule } from "@/lib/dal";
import { zonedToUtc } from "@/lib/dates";
import { logActivity } from "@/lib/family";
import { saveUpload } from "@/lib/files";
import { MEMBER_COLOR_KEYS } from "@/lib/colors";
import { ownedCategoryId } from "@/lib/queries";
import { f, familyMemberIds, saveRecordAccess, upsertRule, visibilityFromForm } from "@/lib/records";
import { ruleFromForm } from "@/lib/recurrence";

export async function saveEvent(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("calendar", "edit");
    const tz = viewer.family.timezone;
    const title = f.str(fd, "title");
    const date = f.date(fd, "date");
    if (!title) return fail("Give the event a name.", "title");
    if (!date) return fail("Pick a date.", "date");
    const allDay = f.bool(fd, "allDay");
    const startTime = f.str(fd, "startTime") ?? "09:00";
    const endTime = f.str(fd, "endTime");
    const endDate = f.date(fd, "endDate") ?? date;
    const startsAt = allDay ? zonedToUtc(date, "00:00", tz) : zonedToUtc(date, startTime, tz);
    const endsAt = allDay
      ? endDate > date
        ? zonedToUtc(endDate, "23:59", tz)
        : null
      : endTime
        ? zonedToUtc(endDate, endTime, tz)
        : null;
    if (endsAt && endsAt < startsAt) return fail("The event can't end before it starts.", "endTime");

    const color = f.str(fd, "color");
    const { visibility, memberIds } = visibilityFromForm(fd);
    const attendees = await familyMemberIds(viewer.family.id, f.list(fd, "attendees"));
    const rule = ruleFromForm(fd, date);
    const id = f.str(fd, "id");
    const attachment = await saveUpload(viewer, fd.get("attachment"), { allowDocs: true });

    const values = {
      familyId: viewer.family.id,
      title,
      description: f.str(fd, "description"),
      location: f.str(fd, "location"),
      startsAt,
      endsAt,
      allDay,
      categoryId: await ownedCategoryId(viewer, "calendar", f.str(fd, "categoryId")),
      color: color && (MEMBER_COLOR_KEYS as string[]).includes(color) ? color : null,
      reminderMinutes: f.int(fd, "reminderMinutes"),
      notes: f.str(fd, "notes"),
      visibility,
    };

    let eventId = id;
    await db.transaction(async (tx) => {
      if (id) {
        const [old] = await tx.select().from(calendarEvents).where(and(eq(calendarEvents.id, id), eq(calendarEvents.familyId, viewer.family.id)));
        if (!old) throw new AuthorizationError("Event not found.");
        if (!viewer.isParent && old.createdByMemberId !== viewer.member.id) throw new AuthorizationError("Only the person who created this event (or a parent) can change it.");
        const ruleId = await upsertRule(tx, viewer.family.id, rule, old.recurrenceRuleId);
        await tx.update(calendarEvents).set({ ...values, recurrenceRuleId: ruleId }).where(eq(calendarEvents.id, id));
        await tx.delete(eventAttendees).where(eq(eventAttendees.eventId, id));
      } else {
        const ruleId = await upsertRule(tx, viewer.family.id, rule);
        const [row] = await tx.insert(calendarEvents).values({ ...values, recurrenceRuleId: ruleId, createdByMemberId: viewer.member.id }).returning({ id: calendarEvents.id });
        eventId = row!.id;
      }
      if (attendees.length) await tx.insert(eventAttendees).values(attendees.map((memberId) => ({ eventId: eventId!, memberId })));
      if (attachment) await tx.insert(eventAttachments).values({ eventId: eventId!, fileId: attachment });
      await saveRecordAccess(tx, viewer.family.id, "event", eventId!, memberIds);
    });
    if (!id) await logActivity(db, viewer.family.id, viewer.member.id, "event.created", `added "${title}" to the calendar`, { module: "calendar", entityId: eventId! });
    revalidatePath("/calendar", "layout");
    revalidatePath("/");
    return ok("Saved.");
  });
}

export async function deleteEvent(fd: FormData) {
  const viewer = await requireModule("calendar", "edit");
  const id = String(fd.get("id"));
  const [old] = await db.select().from(calendarEvents).where(and(eq(calendarEvents.id, id), eq(calendarEvents.familyId, viewer.family.id)));
  if (!old) return;
  if (!viewer.isParent && old.createdByMemberId !== viewer.member.id) throw new AuthorizationError("Only the creator or a parent can delete this.");
  await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
  revalidatePath("/calendar", "layout");
  revalidatePath("/");
  redirect("/calendar");
}
