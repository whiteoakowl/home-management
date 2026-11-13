"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, max } from "drizzle-orm";
import { db } from "@/db";
import { choreOccurrences, chores, homeDocuments, homeItems, homePhotos, homeProjects, homeRepairs, listItems, lists, projectMaterials, projectStages, rooms, vendors } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { AuthorizationError, requireModule } from "@/lib/dal";
import { todayIn } from "@/lib/dates";
import { recordExpense } from "@/lib/expenses";
import { logActivity } from "@/lib/family";
import { deleteFamilyFile, saveUpload } from "@/lib/files";
import { getProject, getRepair } from "@/lib/maintenance";
import { DOC_FIELDS, ITEM_FIELDS, MATERIAL_FIELDS, PHOTO_KINDS, PROJECT_FIELDS, REPAIR_FIELDS, ROOM_FIELDS, VENDOR_FIELDS } from "@/lib/maintenance-config";
import { ownedId, ownedRoomId } from "@/lib/queries";
import { parseFields } from "@/lib/record-fields";
import { f, familyMemberIdOrNull, saveRecordAccess, visibilityFromForm } from "@/lib/records";

type V = Awaited<ReturnType<typeof requireModule>>;
const edit = () => requireModule("maintenance", "edit");
function revalidateHome() {
  revalidatePath("/maintenance", "layout");
  revalidatePath("/house", "layout");
  revalidatePath("/");
}

// ─── Rooms, areas & systems ──────────────────────────────────────────────────

export async function saveHomeRoom(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await edit();
    const { values, errors } = parseFields(fd, ROOM_FIELDS);
    if (Object.keys(errors).length) return { ok: false, errors };
    const id = f.str(fd, "id");
    const [old] = id ? await db.select().from(rooms).where(and(eq(rooms.id, id), eq(rooms.familyId, viewer.family.id))) : [];
    if (id && !old) throw new AuthorizationError("Not found.");
    const image = await saveUpload(viewer, fd.get("image"));
    const row = {
      familyId: viewer.family.id,
      name: values.name as string,
      kind: (values.kind as string) ?? "room",
      description: values.description as string | null,
      notes: values.notes as string | null,
      ...(image ? { imageFileId: image } : fd.get("removeImage") === "1" ? { imageFileId: null } : {}),
    };
    let roomId = id;
    if (old) await db.update(rooms).set(row).where(eq(rooms.id, old.id));
    else [{ id: roomId }] = (await db.insert(rooms).values(row).returning({ id: rooms.id })) as [{ id: string }];
    if (old?.imageFileId && (image || fd.get("removeImage") === "1")) await deleteFamilyFile(viewer.family.id, old.imageFileId);
    revalidateHome();
    if (!old) redirect(`/maintenance/rooms/${roomId}`);
    return ok("Saved.");
  });
}

export async function deleteHomeRoom(fd: FormData) {
  const viewer = await edit();
  const [r] = await db.delete(rooms).where(and(eq(rooms.id, String(fd.get("id"))), eq(rooms.familyId, viewer.family.id))).returning();
  if (r?.imageFileId) await deleteFamilyFile(viewer.family.id, r.imageFileId);
  revalidateHome();
  redirect("/maintenance/rooms");
}

// ─── Projects ────────────────────────────────────────────────────────────────

export async function saveHomeProject(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await edit();
    const { values, errors } = parseFields(fd, PROJECT_FIELDS);
    if (Object.keys(errors).length) return { ok: false, errors };
    const id = f.str(fd, "id");
    const old = id ? await getProject(viewer, id) : null;
    if (id && !old) throw new AuthorizationError("Not found.");
    const image = await saveUpload(viewer, fd.get("image"));
    const status = values.status as string;
    const row = {
      ...(values as Record<string, unknown>),
      familyId: viewer.family.id,
      roomId: await ownedRoomId(viewer, values.roomId as string | null),
      ownerMemberId: await familyMemberIdOrNull(viewer.family.id, values.ownerMemberId as string | null),
      completedOn: status === "completed" ? ((values.completedOn as string | null) ?? todayIn(viewer.family.timezone)) : (values.completedOn as string | null),
      ...(image ? { coverFileId: image } : fd.get("removeImage") === "1" ? { coverFileId: null } : {}),
    } as typeof homeProjects.$inferInsert;
    let pid = id;
    if (old) {
      await db.update(homeProjects).set(row).where(eq(homeProjects.id, old.id));
      if (old.status !== "completed" && status === "completed") await logActivity(db, viewer.family.id, viewer.member.id, "project.completed", `finished the "${row.title}" project 🎉`, { module: "maintenance", entityId: old.id });
    } else {
      const [p] = await db.insert(homeProjects).values(row).returning({ id: homeProjects.id });
      pid = p!.id;
      await logActivity(db, viewer.family.id, viewer.member.id, "project.created", `started a home project: "${row.title}"`, { module: "maintenance", entityId: pid });
    }
    if (old?.coverFileId && (image || fd.get("removeImage") === "1")) await deleteFamilyFile(viewer.family.id, old.coverFileId);
    revalidateHome();
    if (!old) redirect(`/maintenance/projects/${pid}`);
    return ok("Saved.");
  });
}

export async function setProjectStatus(fd: FormData) {
  const viewer = await edit();
  const p = await getProject(viewer, String(fd.get("id")));
  const status = String(fd.get("status"));
  if (!p || !["idea", "planning", "budgeting", "ready", "in_progress", "on_hold", "completed"].includes(status)) return;
  await db
    .update(homeProjects)
    .set({ status, completedOn: status === "completed" ? (p.completedOn ?? todayIn(viewer.family.timezone)) : p.completedOn })
    .where(eq(homeProjects.id, p.id));
  revalidateHome();
}

export async function deleteHomeProject(fd: FormData) {
  const viewer = await edit();
  const p = await getProject(viewer, String(fd.get("id")));
  if (!p) return;
  const photos = await db.select().from(homePhotos).where(eq(homePhotos.projectId, p.id));
  await db.delete(homeProjects).where(eq(homeProjects.id, p.id));
  for (const ph of photos) await deleteFamilyFile(viewer.family.id, ph.fileId);
  if (p.coverFileId) await deleteFamilyFile(viewer.family.id, p.coverFileId);
  revalidateHome();
  redirect("/maintenance/projects");
}

async function ownProject(viewer: V, id: string | null) {
  const p = id ? await getProject(viewer, id) : null;
  if (!p) throw new AuthorizationError("Project not found.");
  return p;
}

export async function saveStage(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await edit();
    const p = await ownProject(viewer, f.str(fd, "projectId"));
    const name = f.str(fd, "name");
    if (!name) return fail("Name the stage.", "name");
    const id = f.str(fd, "id");
    if (id) await db.update(projectStages).set({ name, dueOn: f.date(fd, "dueOn") }).where(and(eq(projectStages.id, id), eq(projectStages.projectId, p.id)));
    else {
      const [{ m } = { m: 0 }] = await db.select({ m: max(projectStages.position) }).from(projectStages).where(eq(projectStages.projectId, p.id));
      await db.insert(projectStages).values({ projectId: p.id, name, dueOn: f.date(fd, "dueOn"), position: (m ?? 0) + 1 });
    }
    revalidateHome();
    return ok("Saved.");
  });
}

export async function toggleStage(fd: FormData) {
  const viewer = await edit();
  const p = await ownProject(viewer, f.str(fd, "projectId"));
  await db.update(projectStages).set({ done: fd.get("done") === "true" }).where(and(eq(projectStages.id, String(fd.get("id"))), eq(projectStages.projectId, p.id)));
  revalidateHome();
}

export async function deleteStage(fd: FormData) {
  const viewer = await edit();
  const p = await ownProject(viewer, f.str(fd, "projectId"));
  await db.delete(projectStages).where(and(eq(projectStages.id, String(fd.get("id"))), eq(projectStages.projectId, p.id)));
  revalidateHome();
}

export async function saveMaterial(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await edit();
    const p = await ownProject(viewer, f.str(fd, "projectId"));
    const { values, errors } = parseFields(fd, MATERIAL_FIELDS);
    if (Object.keys(errors).length) return { ok: false, errors };
    const row = { ...(values as Record<string, unknown>), quantity: values.quantity === null ? null : String(values.quantity), projectId: p.id } as typeof projectMaterials.$inferInsert;
    const id = f.str(fd, "id");
    if (id) await db.update(projectMaterials).set(row).where(and(eq(projectMaterials.id, id), eq(projectMaterials.projectId, p.id)));
    else await db.insert(projectMaterials).values(row);
    revalidateHome();
    return ok("Saved.");
  });
}

export async function toggleMaterial(fd: FormData) {
  const viewer = await edit();
  const p = await ownProject(viewer, f.str(fd, "projectId"));
  await db.update(projectMaterials).set({ purchased: fd.get("done") === "true" }).where(and(eq(projectMaterials.id, String(fd.get("id"))), eq(projectMaterials.projectId, p.id)));
  revalidateHome();
}

export async function deleteMaterial(fd: FormData) {
  const viewer = await edit();
  const p = await ownProject(viewer, f.str(fd, "projectId"));
  await db.delete(projectMaterials).where(and(eq(projectMaterials.id, String(fd.get("id"))), eq(projectMaterials.projectId, p.id)));
  revalidateHome();
}

/** Unpurchased materials → the project's own shopping list (created once). */
export async function materialsToShopping(fd: FormData) {
  const viewer = await edit();
  if (!viewer.can("shopping", "edit")) throw new AuthorizationError("You can't edit shopping lists.");
  const p = await ownProject(viewer, f.str(fd, "projectId"));
  let listId = p.shoppingListId;
  if (!listId) {
    const [l] = await db.insert(lists).values({ familyId: viewer.family.id, title: `${p.title} materials`, kind: "shopping", projectId: p.id, createdByMemberId: viewer.member.id }).returning({ id: lists.id });
    listId = l!.id;
    await db.update(homeProjects).set({ shoppingListId: listId }).where(eq(homeProjects.id, p.id));
  }
  const mats = await db.select().from(projectMaterials).where(and(eq(projectMaterials.projectId, p.id), eq(projectMaterials.purchased, false))).orderBy(asc(projectMaterials.name));
  const have = new Set((await db.select({ sourceId: listItems.sourceId }).from(listItems).where(eq(listItems.listId, listId))).map((r) => r.sourceId));
  const rows = mats.filter((m) => !have.has(m.id)).map((m, i) => ({ listId: listId!, text: m.name, quantity: m.quantity, unit: m.unit, store: m.store, sourceId: m.id, shoppingCategory: "household" as const, position: i }));
  if (rows.length) await db.insert(listItems).values(rows);
  revalidatePath("/shopping", "layout");
  redirect(`/shopping/${listId}`);
}

export async function recordProjectExpense(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await edit();
    if (!viewer.can("budget", "edit")) return fail("You can't edit the budget.");
    const p = await ownProject(viewer, f.str(fd, "projectId"));
    const cents = f.cents(fd, "amount");
    if (!cents || cents <= 0) return fail("Enter an amount.", "amount");
    await recordExpense(viewer, { name: `${p.title}: ${f.str(fd, "what") ?? "expense"}`, amountCents: cents, date: f.date(fd, "date") ?? todayIn(viewer.family.timezone), categoryName: "Home improvement", projectId: p.id });
    revalidateHome();
    revalidatePath("/budget", "layout");
    return ok("Expense recorded.");
  });
}

// ─── Photos (before / after / receipt / inspiration / progress / plan) ───────

export async function addHomePhotos(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await edit();
    const kind = f.str(fd, "kind") ?? "progress";
    if (!PHOTO_KINDS.some((k) => k.value === kind)) return fail("Choose a photo type.", "kind");
    const projectId = f.str(fd, "projectId") ? (await ownProject(viewer, f.str(fd, "projectId"))).id : null;
    const repairId = f.str(fd, "repairId") ? (await getRepair(viewer, f.str(fd, "repairId")!))?.id : null;
    const roomId = await ownedRoomId(viewer, f.str(fd, "roomId"));
    if (!projectId && !repairId && !roomId) return fail("Nothing to attach the photos to.");
    const ids: string[] = [];
    for (const file of fd.getAll("photos").slice(0, 12)) {
      const id = await saveUpload(viewer, file, { allowDocs: kind === "receipt" || kind === "plan" });
      if (id) ids.push(id);
    }
    if (!ids.length) return fail("Choose at least one photo.", "photos");
    await db.insert(homePhotos).values(ids.map((fileId) => ({ familyId: viewer.family.id, projectId, repairId, roomId: projectId || repairId ? null : roomId, fileId, kind, caption: f.str(fd, "caption") })));
    revalidateHome();
    return ok(`${ids.length} added.`);
  });
}

export async function deleteHomePhoto(fd: FormData) {
  const viewer = await edit();
  const [ph] = await db.delete(homePhotos).where(and(eq(homePhotos.id, String(fd.get("id"))), eq(homePhotos.familyId, viewer.family.id))).returning();
  if (ph) await deleteFamilyFile(viewer.family.id, ph.fileId);
  revalidateHome();
}

// ─── Repairs ─────────────────────────────────────────────────────────────────

export async function saveRepair(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await edit();
    const { values, errors } = parseFields(fd, REPAIR_FIELDS);
    if (Object.keys(errors).length) return { ok: false, errors };
    const id = f.str(fd, "id");
    const old = id ? await getRepair(viewer, id) : null;
    if (id && !old) throw new AuthorizationError("Not found.");
    const status = values.status as string;
    const row = {
      ...(values as Record<string, unknown>),
      familyId: viewer.family.id,
      roomId: await ownedRoomId(viewer, values.roomId as string | null),
      vendorId: await ownedId(viewer, vendors, values.vendorId as string | null),
      completedOn: status === "completed" ? ((values.completedOn as string | null) ?? todayIn(viewer.family.timezone)) : (values.completedOn as string | null),
    } as typeof homeRepairs.$inferInsert;
    let rid = id;
    if (old) await db.update(homeRepairs).set(row).where(eq(homeRepairs.id, old.id));
    else {
      const [r] = await db.insert(homeRepairs).values({ ...row, reportedByMemberId: viewer.member.id }).returning({ id: homeRepairs.id });
      rid = r!.id;
    }
    // Record the cost once, the first time it's entered (checkbox).
    if (f.bool(fd, "addToBudget") && row.costCents && !old?.costCents) {
      await recordExpense(viewer, { name: `Repair: ${row.title}`, amountCents: row.costCents, date: row.completedOn ?? row.reportedOn, categoryName: "Home repairs", repairId: rid! });
      revalidatePath("/budget", "layout");
    }
    if (status === "completed" && old?.status !== "completed") await logActivity(db, viewer.family.id, viewer.member.id, "repair.completed", `logged a repair: "${row.title}"`, { module: "maintenance", entityId: rid! });
    revalidateHome();
    if (!old) redirect(`/maintenance/repairs/${rid}`);
    return ok("Saved.");
  });
}

export async function deleteRepair(fd: FormData) {
  const viewer = await edit();
  const r = await getRepair(viewer, String(fd.get("id")));
  if (!r) return;
  const photos = await db.select().from(homePhotos).where(eq(homePhotos.repairId, r.id));
  await db.delete(homeRepairs).where(eq(homeRepairs.id, r.id));
  for (const ph of photos) await deleteFamilyFile(viewer.family.id, ph.fileId);
  revalidateHome();
  redirect("/maintenance/repairs");
}

// ─── Documents & warranties ─────────────────────────────────────────────────

export async function saveHomeDocument(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await edit();
    const { values, errors } = parseFields(fd, DOC_FIELDS);
    if (Object.keys(errors).length) return { ok: false, errors };
    const id = f.str(fd, "id");
    const [old] = id ? await db.select().from(homeDocuments).where(and(eq(homeDocuments.id, id), eq(homeDocuments.familyId, viewer.family.id))) : [];
    if (id && !old) throw new AuthorizationError("Not found.");
    const fileId = await saveUpload(viewer, fd.get("file"), { allowDocs: true });
    if (!old && !fileId && values.docType !== "paint") return fail("Attach the file (PDF or image).", "file");
    const { visibility, memberIds } = visibilityFromForm(fd);
    const row = {
      familyId: viewer.family.id,
      title: values.title as string,
      docType: values.docType as string,
      applianceName: values.applianceName as string | null,
      roomId: await ownedRoomId(viewer, values.roomId as string | null),
      projectId: await ownedId(viewer, homeProjects, values.projectId as string | null),
      expiresOn: values.expiresOn as string | null,
      notes: values.notes as string | null,
      visibility,
      ...(fileId ? { fileId } : {}),
    };
    await db.transaction(async (tx) => {
      let did = id;
      if (old) await tx.update(homeDocuments).set(row).where(eq(homeDocuments.id, old.id));
      else [{ id: did }] = (await tx.insert(homeDocuments).values({ ...row, createdByMemberId: viewer.member.id }).returning({ id: homeDocuments.id })) as [{ id: string }];
      await saveRecordAccess(tx, viewer.family.id, "document", did!, memberIds);
    });
    if (fileId && old?.fileId) await deleteFamilyFile(viewer.family.id, old.fileId);
    revalidateHome();
    return ok("Saved.");
  });
}

export async function deleteHomeDocument(fd: FormData) {
  const viewer = await edit();
  const [d] = await db.delete(homeDocuments).where(and(eq(homeDocuments.id, String(fd.get("id"))), eq(homeDocuments.familyId, viewer.family.id))).returning();
  if (d?.fileId) await deleteFamilyFile(viewer.family.id, d.fileId);
  revalidateHome();
}

// ─── Maintenance costs & to-do lists ────────────────────────────────────────

export async function logMaintenanceCost(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await edit();
    const [o] = await db
      .select({ o: choreOccurrences, title: chores.title })
      .from(choreOccurrences)
      .innerJoin(chores, eq(chores.id, choreOccurrences.choreId))
      .where(and(eq(choreOccurrences.id, String(fd.get("id"))), eq(choreOccurrences.familyId, viewer.family.id), eq(chores.kind, "maintenance")));
    if (!o) return fail("Not found.");
    const cents = f.cents(fd, "cost");
    await db.update(choreOccurrences).set({ actualCostCents: cents }).where(eq(choreOccurrences.id, o.o.id));
    if (f.bool(fd, "addToBudget") && cents && !o.o.actualCostCents) {
      await recordExpense(viewer, { name: `Maintenance: ${o.title}`, amountCents: cents, date: o.o.dueDate, categoryName: "Home maintenance" });
      revalidatePath("/budget", "layout");
    }
    revalidateHome();
    return ok("Cost saved.");
  });
}

export async function createHomeTodoList(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await edit();
    if (!viewer.can("lists", "edit")) return fail("You can't create lists.");
    const title = f.str(fd, "title");
    if (!title) return fail("Name the list.", "title");
    const roomId = await ownedRoomId(viewer, f.str(fd, "roomId"));
    const projectId = await ownedId(viewer, homeProjects, f.str(fd, "projectId"));
    if (!roomId && !projectId) return fail("Choose a room or project for the list.", "roomId");
    const [l] = await db.insert(lists).values({ familyId: viewer.family.id, title, kind: "todo", roomId, projectId, createdByMemberId: viewer.member.id }).returning({ id: lists.id });
    revalidateHome();
    revalidatePath("/lists", "layout");
    redirect(`/lists/${l!.id}`);
  });
}

// ─── Home inventory (belongings) ─────────────────────────────────────────────

export async function saveHomeItem(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await edit();
    const { values, errors } = parseFields(fd, ITEM_FIELDS);
    if (Object.keys(errors).length) return { ok: false, errors };
    const id = f.str(fd, "id");
    const [old] = id ? await db.select().from(homeItems).where(and(eq(homeItems.id, id), eq(homeItems.familyId, viewer.family.id))) : [];
    if (id && !old) throw new AuthorizationError("Not found.");
    const image = await saveUpload(viewer, fd.get("image"));
    const receipt = await saveUpload(viewer, fd.get("receipt"), { allowDocs: true });
    const row = {
      ...(values as Record<string, unknown>),
      familyId: viewer.family.id,
      roomId: await ownedRoomId(viewer, values.roomId as string | null),
      quantity: Math.max(1, Math.round((values.quantity as number | null) ?? 1)),
      ...(image ? { imageFileId: image } : fd.get("removeImage") === "1" ? { imageFileId: null } : {}),
      ...(receipt ? { receiptFileId: receipt } : {}),
    } as typeof homeItems.$inferInsert;
    if (old) await db.update(homeItems).set(row).where(eq(homeItems.id, old.id));
    else await db.insert(homeItems).values(row);
    if (old?.imageFileId && (image || fd.get("removeImage") === "1")) await deleteFamilyFile(viewer.family.id, old.imageFileId);
    if (old?.receiptFileId && receipt) await deleteFamilyFile(viewer.family.id, old.receiptFileId);
    revalidateHome();
    return ok("Saved.");
  });
}

export async function deleteHomeItem(fd: FormData) {
  const viewer = await edit();
  const [it] = await db.delete(homeItems).where(and(eq(homeItems.id, String(fd.get("id"))), eq(homeItems.familyId, viewer.family.id))).returning();
  if (it?.imageFileId) await deleteFamilyFile(viewer.family.id, it.imageFileId);
  if (it?.receiptFileId) await deleteFamilyFile(viewer.family.id, it.receiptFileId);
  revalidateHome();
}

// ─── Service providers ───────────────────────────────────────────────────────

export async function saveVendor(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await edit();
    const { values, errors } = parseFields(fd, VENDOR_FIELDS);
    if (Object.keys(errors).length) return { ok: false, errors };
    const row = { ...(values as Record<string, unknown>), rating: values.rating ? Number(values.rating) : null, familyId: viewer.family.id } as typeof vendors.$inferInsert;
    const id = f.str(fd, "id");
    if (id) await db.update(vendors).set(row).where(and(eq(vendors.id, id), eq(vendors.familyId, viewer.family.id)));
    else await db.insert(vendors).values(row);
    revalidateHome();
    return ok("Saved.");
  });
}

export async function toggleVendorFavorite(fd: FormData) {
  const viewer = await edit();
  const [v] = await db.select().from(vendors).where(and(eq(vendors.id, String(fd.get("id"))), eq(vendors.familyId, viewer.family.id)));
  if (!v) return;
  await db.update(vendors).set({ isFavorite: !v.isFavorite }).where(eq(vendors.id, v.id));
  revalidateHome();
}

export async function deleteVendor(fd: FormData) {
  const viewer = await edit();
  await db.delete(vendors).where(and(eq(vendors.id, String(fd.get("id"))), eq(vendors.familyId, viewer.family.id)));
  revalidateHome();
}
