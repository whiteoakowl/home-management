"use server";

import { BINDER, binderBody, isBinderKind } from "@/lib/binder";
import { parseFields } from "@/lib/record-fields";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { householdInfo, rooms } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { assertCanChange, AuthorizationError, getViewer, isOthersPrivate, requireModule } from "@/lib/dal";
import { ownedCategoryId } from "@/lib/queries";
import { f, saveRecordAccess, visibilityFromForm } from "@/lib/records";

// Projects & documents moved to Home Maintenance (src/app/actions/maintenance.ts).

/**
 * Important Info: the family's (Important Info access), or a member's own private
 * "My Important Info" (space=mine), which only that member ever sees, never parents.
 */
async function infoActor(fd: FormData) {
  if (fd.get("space") === "mine") {
    const viewer = await getViewer();
    if (viewer.isParent || !viewer.member.privateInfo) throw new AuthorizationError("Your private Important Info isn't turned on.");
    return { viewer, privateOwner: viewer.member.id as string | null };
  }
  return { viewer: await requireModule("info", "edit"), privateOwner: null as string | null };
}
const infoOwnerIs = (owner: string | null) => (owner ? eq(householdInfo.privateOwnerId, owner) : isNull(householdInfo.privateOwnerId));

export async function saveInfo(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const { viewer, privateOwner } = await infoActor(fd);
    // Family Binder: each section has its own fields (src/lib/binder.ts).
    const rawKind = f.str(fd, "kind");
    const kind = isBinderKind(rawKind) ? rawKind : "note";
    const meta = BINDER[kind];
    const parsed = parseFields(fd, meta.fields);
    if (Object.keys(parsed.errors).length) return { ok: false, errors: parsed.errors };
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed.values)) if (v !== null && v !== "" && !Array.isArray(v)) fields[k] = String(v);
    const title = fields[meta.titleField]?.slice(0, 200);
    if (!title) return fail(`Please add the ${meta.fields.find((x) => x.name === meta.titleField)?.label.toLowerCase() ?? "title"}.`, meta.titleField);
    const body = (kind === "note" ? fields.body : binderBody(kind, fields)) || title;
    const id = f.str(fd, "id");
    const { visibility, memberIds } = privateOwner ? { visibility: "private" as const, memberIds: [] } : visibilityFromForm(fd);
    const values = { familyId: viewer.family.id, title, body, kind, fields, visibility, privateOwnerId: privateOwner, categoryId: privateOwner ? null : await ownedCategoryId(viewer, "household", f.str(fd, "categoryId")) };
    if (id) {
      const [old] = await db.select().from(householdInfo).where(and(eq(householdInfo.id, id), eq(householdInfo.familyId, viewer.family.id), infoOwnerIs(privateOwner)));
      if (!old || isOthersPrivate(viewer, { visibility: old.visibility, author: old.createdByMemberId })) throw new AuthorizationError("Not found.");
      assertCanChange(viewer, old.createdByMemberId, "this info");
    }
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
  const { viewer, privateOwner } = await infoActor(fd);
  const [old] = await db.select().from(householdInfo).where(and(eq(householdInfo.id, String(fd.get("id"))), eq(householdInfo.familyId, viewer.family.id), infoOwnerIs(privateOwner)));
  if (!old || isOthersPrivate(viewer, { visibility: old.visibility, author: old.createdByMemberId })) return;
  assertCanChange(viewer, old.createdByMemberId, "this info");
  await db.delete(householdInfo).where(eq(householdInfo.id, old.id));
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
