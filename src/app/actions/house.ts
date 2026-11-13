"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { householdInfo, rooms } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { requireModule } from "@/lib/dal";
import { ownedCategoryId } from "@/lib/queries";
import { f, saveRecordAccess, visibilityFromForm } from "@/lib/records";

// Projects & documents moved to Home Maintenance (src/app/actions/maintenance.ts).

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
