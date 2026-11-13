"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { calendarEvents, eventAttendees, familyMembers } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { AuthorizationError, requireModule } from "@/lib/dal";
import { zonedToUtc } from "@/lib/dates";
import { deleteFamilyFile, saveUpload } from "@/lib/files";
import { MEDICAL_FIELDS, MEDICAL_KINDS, type MedicalKind } from "@/lib/medical-config";
import { MEDICAL_TABLES, getMedicalRecord, medTable } from "@/lib/medical";
import { parseFields } from "@/lib/record-fields";
import { f, familyMemberIdOrNull, familyMemberIds, saveRecordAccess, visibilityFromForm } from "@/lib/records";

function kindOf(fd: FormData): MedicalKind {
  const k = String(fd.get("kind") ?? "");
  if (!(MEDICAL_KINDS as readonly string[]).includes(k)) throw new AuthorizationError("Unknown record type.");
  return k as MedicalKind;
}

function revalidateMedical() {
  revalidatePath("/medical", "layout");
  revalidatePath("/recipes", "layout");
  revalidatePath("/meals", "layout");
  revalidatePath("/");
}

/** Create or update any medical record type (config-driven). */
export async function saveMedicalRecord(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("medical", "edit");
    const kind = kindOf(fd);
    const table = medTable(kind);
    const { values, errors } = parseFields(fd, MEDICAL_FIELDS[kind]);
    if (Object.keys(errors).length) return { ok: false, errors };
    const id = f.str(fd, "id");
    const { visibility, memberIds } = visibilityFromForm(fd);

    const existing = id ? await getMedicalRecord(viewer, kind, id) : null;
    if (id && !existing) throw new AuthorizationError("Record not found.");
    const memberId = existing ? existing.memberId : await familyMemberIdOrNull(viewer.family.id, f.str(fd, "memberId"));
    if (!memberId) return fail("Choose who this record is for.", "memberId");
    if (kind === "document" && !existing && !(fd.get("file") instanceof File && (fd.get("file") as File).size)) {
      return fail("Attach the document (PDF or image).", "file");
    }

    const fileId = MEDICAL_FIELDS[kind].some((d) => d.type === "file") ? await saveUpload(viewer, fd.get("file"), { allowDocs: true }) : null;
    const row: Record<string, unknown> = { ...values, visibility, familyId: viewer.family.id, memberId };
    if (fileId) row.fileId = fileId;

    let recordId = id;
    await db.transaction(async (tx) => {
      if (existing) {
        await tx.update(table).set(row).where(and(eq(table.id, existing.id), eq(table.familyId, viewer.family.id)));
      } else if (kind === "profile") {
        // One profile per member: upsert.
        const p = MEDICAL_TABLES.profile;
        const [r] = await tx
          .insert(p)
          .values({ ...row, createdByMemberId: viewer.member.id } as typeof p.$inferInsert)
          .onConflictDoUpdate({ target: p.memberId, set: row })
          .returning({ id: p.id });
        recordId = r!.id;
      } else {
        const [r] = await tx
          .insert(table)
          .values({ ...row, createdByMemberId: viewer.member.id } as typeof table.$inferInsert)
          .returning({ id: table.id });
        recordId = r!.id;
      }
      await saveRecordAccess(tx, viewer.family.id, "medical", recordId!, memberIds);
    });
    if (fileId && existing && "fileId" in existing && existing.fileId) await deleteFamilyFile(viewer.family.id, existing.fileId as string);
    revalidateMedical();
    return ok("Saved.");
  });
}

export async function deleteMedicalRecord(fd: FormData) {
  const viewer = await requireModule("medical", "edit");
  const kind = kindOf(fd);
  const table = medTable(kind);
  const existing = await getMedicalRecord(viewer, kind, String(fd.get("id")));
  if (!existing) throw new AuthorizationError("Record not found.");
  await db.delete(table).where(and(eq(table.id, existing.id), eq(table.familyId, viewer.family.id)));
  if ("fileId" in existing && existing.fileId) await deleteFamilyFile(viewer.family.id, existing.fileId as string);
  revalidateMedical();
}

/** Remove only the attached file of an allergy / document. */
export async function removeMedicalFile(fd: FormData) {
  const viewer = await requireModule("medical", "edit");
  const kind = kindOf(fd);
  if (kind !== "allergy" && kind !== "document") return;
  const table = medTable(kind);
  const existing = await getMedicalRecord(viewer, kind, String(fd.get("id")));
  if (!existing || !("fileId" in existing) || !existing.fileId) return;
  await db.update(table).set({ fileId: null }).where(eq(table.id, existing.id));
  await deleteFamilyFile(viewer.family.id, existing.fileId as string);
  revalidateMedical();
}

/** Mark a refill as picked up: decrements refills and moves the next refill date. */
export async function recordRefill(fd: FormData) {
  const viewer = await requireModule("medical", "edit");
  const m = await getMedicalRecord(viewer, "medication", String(fd.get("id")));
  if (!m) throw new AuthorizationError("Medication not found.");
  const days = Math.min(365, Math.max(1, f.int(fd, "days") ?? 30));
  const next = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  await db
    .update(MEDICAL_TABLES.medication)
    .set({ nextRefillOn: next, refillsRemaining: m.refillsRemaining === null ? null : Math.max(0, m.refillsRemaining - 1) })
    .where(eq(MEDICAL_TABLES.medication.id, m.id));
  revalidateMedical();
}

/**
 * Medical appointments live on the shared calendar (source 'medical') so there
 * is one calendar, not two. They are private to the patient + parents unless
 * shared with selected people.
 */
export async function saveMedicalAppointment(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("medical", "edit");
    const tz = viewer.family.timezone;
    const title = f.str(fd, "title");
    const date = f.date(fd, "date");
    const memberId = await familyMemberIdOrNull(viewer.family.id, f.str(fd, "memberId"));
    if (!title) return fail("What is the appointment?", "title");
    if (!date) return fail("Pick a date.", "date");
    if (!memberId) return fail("Who is the appointment for?", "memberId");
    const time = f.str(fd, "time") ?? "09:00";
    const startsAt = zonedToUtc(date, time, tz);
    const minutes = Math.min(600, Math.max(5, f.int(fd, "duration") ?? 60));
    const shareWith = await familyMemberIds(viewer.family.id, f.list(fd, "visibleTo"));
    const { visibility } = visibilityFromForm(fd);
    const values = {
      familyId: viewer.family.id,
      title,
      description: f.str(fd, "description"),
      location: f.str(fd, "location"),
      startsAt,
      endsAt: new Date(startsAt.getTime() + minutes * 60000),
      allDay: false,
      reminderMinutes: f.int(fd, "reminderMinutes") ?? 1440,
      notes: f.str(fd, "notes"),
      // "Private" here means the patient + parents, so store it as selected.
      visibility: visibility === "family" ? ("family" as const) : ("selected" as const),
      source: "medical" as const,
      sourceId: memberId,
    };
    const id = f.str(fd, "id");
    let eventId = id;
    await db.transaction(async (tx) => {
      if (id) {
        const [old] = await tx.select().from(calendarEvents).where(and(eq(calendarEvents.id, id), eq(calendarEvents.familyId, viewer.family.id), eq(calendarEvents.source, "medical")));
        if (!old) throw new AuthorizationError("Appointment not found.");
        if (!viewer.isParent && old.createdByMemberId !== viewer.member.id && old.sourceId !== viewer.member.id) throw new AuthorizationError("Only a parent or the patient can change this appointment.");
        await tx.update(calendarEvents).set(values).where(eq(calendarEvents.id, id));
        await tx.delete(eventAttendees).where(eq(eventAttendees.eventId, id));
      } else {
        const [row] = await tx.insert(calendarEvents).values({ ...values, createdByMemberId: viewer.member.id }).returning({ id: calendarEvents.id });
        eventId = row!.id;
      }
      await tx.insert(eventAttendees).values({ eventId: eventId!, memberId });
      const access = new Set([memberId, viewer.member.id, ...(visibility === "selected" ? shareWith : [])]);
      await saveRecordAccess(tx, viewer.family.id, "event", eventId!, [...access]);
    });
    revalidatePath("/medical", "layout");
    revalidatePath("/calendar", "layout");
    revalidatePath("/");
    return ok("Appointment saved.");
  });
}

export async function deleteMedicalAppointment(fd: FormData) {
  const viewer = await requireModule("medical", "edit");
  const id = String(fd.get("id"));
  const [old] = await db.select().from(calendarEvents).where(and(eq(calendarEvents.id, id), eq(calendarEvents.familyId, viewer.family.id), eq(calendarEvents.source, "medical")));
  if (!old) return;
  if (!viewer.isParent && old.createdByMemberId !== viewer.member.id && old.sourceId !== viewer.member.id) throw new AuthorizationError("Only a parent or the patient can delete this appointment.");
  await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
  revalidatePath("/medical", "layout");
  revalidatePath("/calendar", "layout");
}

/** Profile photo for a family member (used on medical, family and avatar cards). Parents or the member themself. */
export async function saveMemberPhoto(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("medical", "view");
    const memberId = await familyMemberIdOrNull(viewer.family.id, f.str(fd, "memberId"));
    if (!memberId) return fail("Unknown family member.");
    if (!viewer.isParent && memberId !== viewer.member.id) throw new AuthorizationError("Only parents can change someone else's photo.");
    const [m] = await db.select({ old: familyMembers.avatarFileId }).from(familyMembers).where(eq(familyMembers.id, memberId));
    const remove = fd.get("removeImage") === "1";
    const fileId = await saveUpload(viewer, fd.get("image"));
    if (!fileId && !remove) return fail("Choose a photo.", "image");
    await db.update(familyMembers).set({ avatarFileId: fileId }).where(eq(familyMembers.id, memberId));
    if (m?.old) await deleteFamilyFile(viewer.family.id, m.old);
    revalidatePath("/", "layout");
    return ok("Photo saved.");
  });
}
