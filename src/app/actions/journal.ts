"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { journalEntries, journalEntryFiles, journalEntryMembers } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { AuthorizationError, requireModule } from "@/lib/dal";
import { todayIn } from "@/lib/dates";
import { logActivity } from "@/lib/family";
import { deleteFamilyFile, saveUpload } from "@/lib/files";
import { f, familyMemberIds, saveRecordAccess, visibilityFromForm } from "@/lib/records";

const MOODS_SERVER = ["happy", "calm", "grateful", "excited", "tired", "sad", "frustrated", "sick"];

export async function saveJournalEntry(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("journal", "edit");
    const body = f.str(fd, "body");
    if (!body) return fail("Write something first.", "body");
    const id = f.str(fd, "id");
    const { visibility, memberIds } = visibilityFromForm(fd);
    const mood = f.str(fd, "mood");
    const values = {
      familyId: viewer.family.id,
      date: f.date(fd, "date") ?? todayIn(viewer.family.timezone),
      title: f.str(fd, "title"),
      body,
      mood: mood && MOODS_SERVER.includes(mood) ? mood : null,
      tags: f.split(fd, "tags").map((t) => t.toLowerCase().replace(/^#/, "")).slice(0, 20),
      visibility,
    };
    const people = await familyMemberIds(viewer.family.id, f.list(fd, "people"));
    // Up to 8 photos per save.
    const uploads: string[] = [];
    for (const file of fd.getAll("photos").slice(0, 8)) {
      const fileId = await saveUpload(viewer, file);
      if (fileId) uploads.push(fileId);
    }

    let entryId = id;
    await db.transaction(async (tx) => {
      if (id) {
        const [old] = await tx.select().from(journalEntries).where(and(eq(journalEntries.id, id), eq(journalEntries.familyId, viewer.family.id)));
        if (!old || old.authorMemberId !== viewer.member.id) throw new AuthorizationError("Only the author can edit this entry.");
        await tx.update(journalEntries).set(values).where(eq(journalEntries.id, id));
        await tx.delete(journalEntryMembers).where(eq(journalEntryMembers.entryId, id));
      } else {
        const [row] = await tx.insert(journalEntries).values({ ...values, authorMemberId: viewer.member.id }).returning({ id: journalEntries.id });
        entryId = row!.id;
      }
      if (people.length) await tx.insert(journalEntryMembers).values(people.map((memberId) => ({ entryId: entryId!, memberId })));
      if (uploads.length) await tx.insert(journalEntryFiles).values(uploads.map((fileId, i) => ({ entryId: entryId!, fileId, position: i })));
      await saveRecordAccess(tx, viewer.family.id, "journal_entry", entryId!, memberIds);
    });
    if (!id && visibility !== "private") {
      await logActivity(db, viewer.family.id, viewer.member.id, "journal.added", `wrote a journal entry${values.title ? `: "${values.title}"` : ""}`, { module: "journal" });
    }
    revalidatePath("/journal", "layout");
    revalidatePath("/");
    if (!id) redirect(`/journal/${entryId}`);
    return ok("Saved.");
  });
}

export async function deleteJournalEntry(fd: FormData) {
  const viewer = await requireModule("journal", "edit");
  const id = String(fd.get("id"));
  const [e] = await db.select().from(journalEntries).where(and(eq(journalEntries.id, id), eq(journalEntries.familyId, viewer.family.id)));
  if (!e || e.authorMemberId !== viewer.member.id) throw new AuthorizationError("Only the author can delete this entry.");
  const photos = await db.select().from(journalEntryFiles).where(eq(journalEntryFiles.entryId, id));
  await db.delete(journalEntries).where(eq(journalEntries.id, id));
  for (const p of photos) await deleteFamilyFile(viewer.family.id, p.fileId);
  revalidatePath("/journal", "layout");
  redirect("/journal");
}

export async function removeJournalPhoto(fd: FormData) {
  const viewer = await requireModule("journal", "edit");
  const entryId = String(fd.get("entryId"));
  const fileId = String(fd.get("fileId"));
  const [e] = await db.select().from(journalEntries).where(and(eq(journalEntries.id, entryId), eq(journalEntries.familyId, viewer.family.id)));
  if (!e || e.authorMemberId !== viewer.member.id) throw new AuthorizationError("Only the author can change this entry.");
  await db.delete(journalEntryFiles).where(and(eq(journalEntryFiles.entryId, entryId), eq(journalEntryFiles.fileId, fileId)));
  await deleteFamilyFile(viewer.family.id, fileId);
  revalidatePath(`/journal/${entryId}`);
}
