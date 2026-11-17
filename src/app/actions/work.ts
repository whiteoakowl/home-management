"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { familyMembers, workShifts } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { AuthorizationError, requireModule, type Viewer } from "@/lib/dal";
import { addDays } from "@/lib/dates";
import { f, saveRecordAccess, visibilityFromForm } from "@/lib/records";

/**
 * Work schedules. Everyone with Work "Use" keeps their own shifts; "Add & edit"
 * (parents by default) can change anyone's.
 */
function revalidateWork() {
  revalidatePath("/work", "layout");
  revalidatePath("/calendar", "layout");
  revalidatePath("/");
}

async function worker(viewer: Viewer, id: string | null) {
  const memberId = id && /^[0-9a-f-]{36}$/i.test(id) ? id : viewer.member.id;
  const [m] = await db.select({ id: familyMembers.id }).from(familyMembers).where(and(eq(familyMembers.id, memberId), eq(familyMembers.familyId, viewer.family.id)));
  if (!m) throw new AuthorizationError("Family member not found.");
  if (m.id !== viewer.member.id && !viewer.can("work", "edit")) throw new AuthorizationError("You can only change your own work schedule.");
  return m.id;
}

const time = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "");
  return /^\d{2}:\d{2}/.test(v) ? v.slice(0, 5) : null;
};

/** Add shifts on one or more days (same times), or edit one shift. */
export async function saveShift(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("work", "use");
    const memberId = await worker(viewer, f.str(fd, "memberId"));
    const startTime = time(fd, "startTime");
    const endTime = time(fd, "endTime");
    if (!startTime || !endTime) return fail("Add the start and end time.", "startTime");
    const job = f.str(fd, "job")?.slice(0, 60) ?? null;
    const notes = f.str(fd, "notes");
    const id = f.str(fd, "id");
    if (id) {
      const [old] = await db.select().from(workShifts).where(and(eq(workShifts.id, id), eq(workShifts.familyId, viewer.family.id)));
      if (!old) throw new AuthorizationError("Not found.");
      await worker(viewer, old.memberId);
      const date = f.date(fd, "date") ?? old.date;
      await db.update(workShifts).set({ memberId, date, startTime, endTime, job, notes }).where(eq(workShifts.id, old.id));
    } else {
      const dates = [...new Set(fd.getAll("dates").map(String).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))];
      if (!dates.length) return fail("Choose the day(s).", "dates");
      await db.insert(workShifts).values(dates.map((date) => ({ familyId: viewer.family.id, memberId, date, startTime, endTime, job, notes })));
    }
    revalidateWork();
    return ok("Saved.");
  });
}

export async function deleteShift(fd: FormData) {
  const viewer = await requireModule("work", "use");
  const [old] = await db.select().from(workShifts).where(and(eq(workShifts.id, String(fd.get("id"))), eq(workShifts.familyId, viewer.family.id)));
  if (!old) return;
  await worker(viewer, old.memberId);
  await db.delete(workShifts).where(eq(workShifts.id, old.id));
  revalidateWork();
}

/** Copy last week's shifts into this week (skips any shift that's already there). */
export async function copyLastWeek(fd: FormData) {
  const viewer = await requireModule("work", "use");
  const memberId = await worker(viewer, String(fd.get("memberId") ?? ""));
  const week = String(fd.get("week") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return;
  const prev = await db.select().from(workShifts).where(and(eq(workShifts.familyId, viewer.family.id), eq(workShifts.memberId, memberId), gte(workShifts.date, addDays(week, -7)), lte(workShifts.date, addDays(week, -1))));
  const here = await db.select().from(workShifts).where(and(eq(workShifts.familyId, viewer.family.id), eq(workShifts.memberId, memberId), gte(workShifts.date, week), lte(workShifts.date, addDays(week, 6))));
  const have = new Set(here.map((s) => `${s.date}|${s.startTime.slice(0, 5)}`));
  const rows = prev.map((s) => ({ familyId: viewer.family.id, memberId, date: addDays(s.date, 7), startTime: s.startTime, endTime: s.endTime, job: s.job, notes: s.notes })).filter((r) => !have.has(`${r.date}|${r.startTime.slice(0, 5)}`));
  if (rows.length) await db.insert(workShifts).values(rows);
  revalidateWork();
}

/** Who sees my work schedule: the whole family, selected people, Parents & me, or only me. */
export async function saveWorkSharing(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("work", "use");
    const { visibility, memberIds } = visibilityFromForm(fd);
    await db.transaction(async (tx) => {
      await tx.update(familyMembers).set({ workVisibility: visibility }).where(eq(familyMembers.id, viewer.member.id));
      await saveRecordAccess(tx, viewer.family.id, "work_schedule", viewer.member.id, memberIds.filter((id) => id !== viewer.member.id));
    });
    revalidateWork();
    return ok("Saved.");
  });
}
