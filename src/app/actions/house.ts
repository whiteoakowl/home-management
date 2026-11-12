"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { homeDocuments, homeProjects, householdInfo, rooms } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { requireModule } from "@/lib/dal";
import { logActivity } from "@/lib/family";
import { deleteFamilyFile, saveUpload } from "@/lib/files";
import { ownedCategoryId, ownedRoomId } from "@/lib/queries";
import { f, familyMemberIdOrNull, saveRecordAccess, visibilityFromForm } from "@/lib/records";

const PROJECT_STATUSES = ["idea", "planned", "in_progress", "on_hold", "done"];

export async function saveProject(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("house", "edit");
    const title = f.str(fd, "title");
    if (!title) return fail("Please name the project.", "title");
    const status = f.str(fd, "status") ?? "planned";
    const values = {
      familyId: viewer.family.id,
      title,
      description: f.str(fd, "description"),
      status: PROJECT_STATUSES.includes(status) ? status : "planned",
      roomId: await ownedRoomId(viewer, f.str(fd, "roomId")),
      budgetCents: f.cents(fd, "budget"),
      startDate: f.date(fd, "startDate"),
      targetDate: f.date(fd, "targetDate"),
      ownerMemberId: await familyMemberIdOrNull(viewer.family.id, f.str(fd, "ownerId")),
    };
    const id = f.str(fd, "id");
    if (id) {
      await db.update(homeProjects).set(values).where(and(eq(homeProjects.id, id), eq(homeProjects.familyId, viewer.family.id)));
    } else {
      await db.insert(homeProjects).values(values);
      await logActivity(db, viewer.family.id, viewer.member.id, "project.created", `started a home project: "${title}"`, { module: "house" });
    }
    revalidatePath("/house", "layout");
    return ok();
  });
}

export async function deleteProject(fd: FormData) {
  const viewer = await requireModule("house", "edit");
  await db.delete(homeProjects).where(and(eq(homeProjects.id, String(fd.get("id"))), eq(homeProjects.familyId, viewer.family.id)));
  revalidatePath("/house", "layout");
}

export async function saveDocument(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("house", "edit");
    const title = f.str(fd, "title");
    if (!title) return fail("Please give the document a title.", "title");
    const id = f.str(fd, "id");
    const { visibility, memberIds } = visibilityFromForm(fd);
    const fileId = await saveUpload(viewer, fd.get("file"), { allowDocs: true });
    if (!id && !fileId) return fail("Choose a file to upload.", "file");
    const values = {
      familyId: viewer.family.id,
      title,
      categoryId: await ownedCategoryId(viewer, "household", f.str(fd, "categoryId")),
      notes: f.str(fd, "notes"),
      expiresOn: f.date(fd, "expiresOn"),
      visibility,
      ...(fileId ? { fileId } : {}),
    };
    await db.transaction(async (tx) => {
      let docId = id;
      if (id) {
        const [old] = await tx.select().from(homeDocuments).where(and(eq(homeDocuments.id, id), eq(homeDocuments.familyId, viewer.family.id)));
        if (!old) return;
        await tx.update(homeDocuments).set(values).where(eq(homeDocuments.id, id));
        if (fileId && old.fileId) await deleteFamilyFile(viewer.family.id, old.fileId);
      } else {
        const [row] = await tx.insert(homeDocuments).values({ ...values, createdByMemberId: viewer.member.id }).returning({ id: homeDocuments.id });
        docId = row!.id;
      }
      await saveRecordAccess(tx, viewer.family.id, "document", docId!, memberIds);
    });
    revalidatePath("/house", "layout");
    return ok();
  });
}

export async function deleteDocument(fd: FormData) {
  const viewer = await requireModule("house", "edit");
  const [doc] = await db
    .delete(homeDocuments)
    .where(and(eq(homeDocuments.id, String(fd.get("id"))), eq(homeDocuments.familyId, viewer.family.id)))
    .returning();
  if (doc) await deleteFamilyFile(viewer.family.id, doc.fileId);
  revalidatePath("/house", "layout");
}

export async function saveInfo(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("house", "edit");
    const title = f.str(fd, "title");
    const body = f.str(fd, "body");
    if (!title) return fail("Please add a title.", "title");
    if (!body) return fail("Please add the details.", "body");
    const id = f.str(fd, "id");
    const { visibility, memberIds } = visibilityFromForm(fd);
    const values = { familyId: viewer.family.id, title, body, visibility, categoryId: await ownedCategoryId(viewer, "household", f.str(fd, "categoryId")) };
    await db.transaction(async (tx) => {
      let infoId = id;
      if (id) await tx.update(householdInfo).set(values).where(and(eq(householdInfo.id, id), eq(householdInfo.familyId, viewer.family.id)));
      else {
        const [row] = await tx.insert(householdInfo).values({ ...values, createdByMemberId: viewer.member.id }).returning({ id: householdInfo.id });
        infoId = row!.id;
      }
      await saveRecordAccess(tx, viewer.family.id, "household_info", infoId!, memberIds);
    });
    revalidatePath("/house", "layout");
    return ok();
  });
}

export async function deleteInfo(fd: FormData) {
  const viewer = await requireModule("house", "edit");
  await db.delete(householdInfo).where(and(eq(householdInfo.id, String(fd.get("id"))), eq(householdInfo.familyId, viewer.family.id)));
  revalidatePath("/house", "layout");
}

export async function saveRoom(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("house", "edit");
    const name = f.str(fd, "name");
    if (!name) return fail("Name the room.", "name");
    const id = f.str(fd, "id");
    if (id) await db.update(rooms).set({ name }).where(and(eq(rooms.id, id), eq(rooms.familyId, viewer.family.id)));
    else await db.insert(rooms).values({ familyId: viewer.family.id, name, sortOrder: 999 });
    revalidatePath("/house", "layout");
    return ok();
  });
}

export async function deleteRoom(fd: FormData) {
  const viewer = await requireModule("house", "edit");
  await db.delete(rooms).where(and(eq(rooms.id, String(fd.get("id"))), eq(rooms.familyId, viewer.family.id)));
  revalidatePath("/house", "layout");
}
