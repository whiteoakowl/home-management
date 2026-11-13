"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { inventoryItems, journalEntries, journalEntryFiles, listItems, petCareNotes, petMedicalRecords, petPhotos, petPreventatives, petSupplies, pets } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { mainShoppingListId } from "@/lib/automation";
import { AuthorizationError, requireModule } from "@/lib/dal";
import { addDays, todayIn } from "@/lib/dates";
import { recordExpense } from "@/lib/expenses";
import { logActivity } from "@/lib/family";
import { deleteFamilyFile, saveUpload } from "@/lib/files";
import { getPet, petRecordOwned, petSupplyOwned } from "@/lib/pets";
import { CARE_NOTE_FIELDS, PET_FIELDS, PET_RECORD_FIELDS, PREVENTATIVE_FIELDS, SUPPLY_FIELDS } from "@/lib/pets-config";
import { parseFields } from "@/lib/record-fields";
import { f, familyMemberIdOrNull, saveRecordAccess, visibilityFromForm } from "@/lib/records";

function revalidatePets(petId?: string | null) {
  revalidatePath("/pets", "layout");
  if (petId) revalidatePath(`/pets/${petId}`);
  revalidatePath("/");
}

async function ownPet(viewer: Awaited<ReturnType<typeof requireModule>>, id: string | null) {
  const p = id ? await getPet(viewer, id) : null;
  if (!p) throw new AuthorizationError("Pet not found.");
  return p;
}

// ─── Pets ────────────────────────────────────────────────────────────────────

export async function savePet(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("pets", "edit");
    const { values, errors } = parseFields(fd, PET_FIELDS);
    if (Object.keys(errors).length) return { ok: false, errors };
    const id = f.str(fd, "id");
    const old = id ? await ownPet(viewer, id) : null;
    const image = await saveUpload(viewer, fd.get("image"));
    const row = {
      ...(values as Record<string, unknown>),
      weight: values.weight === null ? null : String(values.weight),
      caretakerMemberId: await familyMemberIdOrNull(viewer.family.id, values.caretakerMemberId as string | null),
      familyId: viewer.family.id,
      ...(image ? { imageFileId: image } : fd.get("removeImage") === "1" ? { imageFileId: null } : {}),
    } as typeof pets.$inferInsert;
    let petId = id;
    if (old) await db.update(pets).set(row).where(eq(pets.id, old.id));
    else {
      const [p] = await db.insert(pets).values(row).returning({ id: pets.id });
      petId = p!.id;
      await logActivity(db, viewer.family.id, viewer.member.id, "pet.added", `added ${row.name} to Pets`, { module: "pets", entityId: petId });
    }
    if (old?.imageFileId && (image || fd.get("removeImage") === "1")) await deleteFamilyFile(viewer.family.id, old.imageFileId);
    revalidatePets(petId);
    if (!old) redirect(`/pets/${petId}`);
    return ok("Saved.");
  });
}

export async function deletePet(fd: FormData) {
  const viewer = await requireModule("pets", "edit");
  const p = await ownPet(viewer, f.str(fd, "id"));
  await db.delete(pets).where(eq(pets.id, p.id));
  if (p.imageFileId) await deleteFamilyFile(viewer.family.id, p.imageFileId);
  revalidatePets();
  redirect("/pets");
}

export async function addPetPhotos(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("pets", "edit");
    const p = await ownPet(viewer, f.str(fd, "petId"));
    const ids: string[] = [];
    for (const file of fd.getAll("photos").slice(0, 12)) {
      const id = await saveUpload(viewer, file);
      if (id) ids.push(id);
    }
    if (!ids.length) return fail("Choose at least one photo.", "photos");
    await db.insert(petPhotos).values(ids.map((fileId) => ({ petId: p.id, fileId, caption: f.str(fd, "caption") })));
    revalidatePets(p.id);
    return ok(`${ids.length} photo${ids.length === 1 ? "" : "s"} added.`);
  });
}

export async function deletePetPhoto(fd: FormData) {
  const viewer = await requireModule("pets", "edit");
  const r = await petRecordOwned(viewer, "photo", String(fd.get("id")));
  if (!r) return;
  await db.delete(petPhotos).where(eq(petPhotos.id, r.r.id));
  await deleteFamilyFile(viewer.family.id, r.r.fileId);
  revalidatePets(r.pet.id);
}

// ─── Health records, preventatives, care notes ──────────────────────────────

export async function savePetRecord(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("pets", "edit");
    const p = await ownPet(viewer, f.str(fd, "petId"));
    const { values, errors } = parseFields(fd, PET_RECORD_FIELDS);
    if (Object.keys(errors).length) return { ok: false, errors };
    const id = f.str(fd, "id");
    const old = id ? await petRecordOwned(viewer, "medical", id) : null;
    if (id && !old) throw new AuthorizationError("Record not found.");
    const fileId = await saveUpload(viewer, fd.get("file"), { allowDocs: true });
    const row = { ...(values as Record<string, unknown>), petId: p.id, ...(fileId ? { fileId } : {}) } as typeof petMedicalRecords.$inferInsert;
    if (old) {
      await db.update(petMedicalRecords).set(row).where(eq(petMedicalRecords.id, old.r.id));
      const prev = old.r.fileId;
      if (fileId && prev) await deleteFamilyFile(viewer.family.id, prev);
    } else {
      await db.insert(petMedicalRecords).values(row);
      if (f.bool(fd, "addToBudget") && row.costCents) {
        await recordExpense(viewer, { name: `${p.name}: ${row.title}`, amountCents: row.costCents, date: row.date, categoryName: "Pets" });
      }
    }
    revalidatePets(p.id);
    revalidatePath("/budget", "layout");
    return ok("Saved.");
  });
}

export async function savePreventative(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("pets", "edit");
    const p = await ownPet(viewer, f.str(fd, "petId"));
    const { values, errors } = parseFields(fd, PREVENTATIVE_FIELDS);
    if (Object.keys(errors).length) return { ok: false, errors };
    const interval = Math.min(730, Math.max(1, (values.intervalDays as number | null) ?? 30));
    const last = values.lastGivenOn as string | null;
    const row = {
      ...(values as Record<string, unknown>),
      petId: p.id,
      intervalDays: interval,
      nextDueOn: (values.nextDueOn as string | null) ?? (last ? addDays(last, interval) : todayIn(viewer.family.timezone)),
      assigneeId: await familyMemberIdOrNull(viewer.family.id, values.assigneeId as string | null),
    } as typeof petPreventatives.$inferInsert;
    const id = f.str(fd, "id");
    if (id) {
      const old = await petRecordOwned(viewer, "preventative", id);
      if (!old) throw new AuthorizationError("Not found.");
      await db.update(petPreventatives).set(row).where(eq(petPreventatives.id, id));
    } else await db.insert(petPreventatives).values(row);
    revalidatePets(p.id);
    return ok("Saved.");
  });
}

/** "Given today": logs it to health history and moves the next due date. */
export async function markPreventativeGiven(fd: FormData) {
  const viewer = await requireModule("pets", "edit");
  const r = await petRecordOwned(viewer, "preventative", String(fd.get("id")));
  if (!r) return;
  const pv = r.r;
  const today = todayIn(viewer.family.timezone);
  await db.update(petPreventatives).set({ lastGivenOn: today, nextDueOn: addDays(today, pv.intervalDays) }).where(eq(petPreventatives.id, pv.id));
  await db.insert(petMedicalRecords).values({ petId: r.pet.id, kind: pv.kind === "vaccination" ? "vaccination" : "medication", title: `${pv.productName} given`, date: today, notes: pv.brand });
  await logActivity(db, viewer.family.id, viewer.member.id, "pet.care", `gave ${r.pet.name} ${pv.productName}`, { module: "pets", entityId: r.pet.id });
  revalidatePets(r.pet.id);
}

export async function saveCareNote(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("pets", "edit");
    const p = await ownPet(viewer, f.str(fd, "petId"));
    const { values, errors } = parseFields(fd, CARE_NOTE_FIELDS);
    if (Object.keys(errors).length) return { ok: false, errors };
    const id = f.str(fd, "id");
    const row = { petId: p.id, kind: values.kind as string, body: values.body as string };
    if (id) {
      if (!(await petRecordOwned(viewer, "care", id))) throw new AuthorizationError("Not found.");
      await db.update(petCareNotes).set(row).where(eq(petCareNotes.id, id));
    } else await db.insert(petCareNotes).values(row);
    revalidatePets(p.id);
    return ok("Saved.");
  });
}

const TABLES = { medical: petMedicalRecords, preventative: petPreventatives, care: petCareNotes } as const;

export async function deletePetRecord(fd: FormData) {
  const viewer = await requireModule("pets", "edit");
  const kind = String(fd.get("kind")) as keyof typeof TABLES;
  if (!(kind in TABLES)) return;
  const r = await petRecordOwned(viewer, kind, String(fd.get("id")));
  if (!r) return;
  const t = TABLES[kind] as typeof petCareNotes;
  await db.delete(t).where(eq(t.id, r.r.id));
  const fileId = (r.r as { fileId?: string | null }).fileId;
  if (fileId) await deleteFamilyFile(viewer.family.id, fileId);
  revalidatePets(r.pet.id);
}

// ─── Food & supplies (quantities live on the shared inventory) ──────────────

export async function savePetSupply(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("pets", "edit");
    const { values, errors } = parseFields(fd, SUPPLY_FIELDS);
    if (Object.keys(errors).length) return { ok: false, errors };
    const petIdRaw = f.str(fd, "petId");
    const petId = petIdRaw ? (await ownPet(viewer, petIdRaw)).id : null;
    const item = {
      familyId: viewer.family.id,
      name: values.name as string,
      quantity: String((values.quantity as number | null) ?? 0),
      unit: values.unit as string | null,
      lowStockThreshold: values.lowStockThreshold === null ? null : String(values.lowStockThreshold),
      location: "pets" as const,
    };
    const supply = {
      petId,
      kind: values.kind as string,
      brand: values.brand as string | null,
      foodType: values.foodType as string | null,
      flavor: values.flavor as string | null,
      feedingInstructions: values.feedingInstructions as string | null,
      feedingSchedule: values.feedingSchedule as string | null,
      dietaryNotes: values.dietaryNotes as string | null,
    };
    const id = f.str(fd, "id");
    if (id) {
      const old = await petSupplyOwned(viewer, id);
      if (!old) throw new AuthorizationError("Not found.");
      await db.update(inventoryItems).set(item).where(eq(inventoryItems.id, old.item.id));
      await db.update(petSupplies).set(supply).where(eq(petSupplies.id, old.s.id));
    } else {
      await db.transaction(async (tx) => {
        const [inv] = await tx.insert(inventoryItems).values(item).returning({ id: inventoryItems.id });
        await tx.insert(petSupplies).values({ ...supply, inventoryItemId: inv!.id });
      });
    }
    revalidatePets(petId);
    revalidatePath("/kitchen", "layout");
    return ok("Saved.");
  });
}

/** Quick +/- on hand (e.g. opened a new bag). */
export async function adjustPetSupply(fd: FormData) {
  const viewer = await requireModule("pets", "edit");
  const r = await petSupplyOwned(viewer, String(fd.get("id")));
  if (!r) return;
  const delta = Number(fd.get("delta")) || 0;
  const q = Math.max(0, Number(r.item.quantity) + delta);
  await db.update(inventoryItems).set({ quantity: String(q) }).where(eq(inventoryItems.id, r.item.id));
  revalidatePets(r.s.petId);
  revalidatePath("/kitchen", "layout");
}

export async function deletePetSupply(fd: FormData) {
  const viewer = await requireModule("pets", "edit");
  const r = await petSupplyOwned(viewer, String(fd.get("id")));
  if (!r) return;
  await db.delete(inventoryItems).where(eq(inventoryItems.id, r.item.id)); // cascades the pet_supplies link
  revalidatePets(r.s.petId);
  revalidatePath("/kitchen", "layout");
}

export async function shopForPetSupply(fd: FormData) {
  const viewer = await requireModule("pets", "edit");
  if (!viewer.can("shopping", "edit")) throw new AuthorizationError("You can't edit the shopping list.");
  const r = await petSupplyOwned(viewer, String(fd.get("id")));
  if (!r) return;
  const listId = await mainShoppingListId(viewer.family.id);
  const [dupe] = await db
    .select({ id: listItems.id })
    .from(listItems)
    .where(and(eq(listItems.listId, listId), eq(listItems.sourceId, r.item.id), eq(listItems.checked, false)));
  if (!dupe) {
    const label = [r.s.brand, r.item.name].filter(Boolean).join(" ");
    await db.insert(listItems).values({ listId, text: label, unit: r.item.unit, source: "low_stock", sourceId: r.item.id, shoppingCategory: "household", position: 900 });
  }
  revalidatePath("/shopping", "layout");
  revalidatePets(r.s.petId);
}

// ─── Memories (journal entries in the 'pet' book) ───────────────────────────

export async function savePetMemory(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("pets", "edit");
    const p = await ownPet(viewer, f.str(fd, "petId"));
    const body = f.str(fd, "body");
    if (!body) return fail("Write a few words about the memory.", "body");
    const { visibility, memberIds } = visibilityFromForm(fd);
    const uploads: string[] = [];
    for (const file of fd.getAll("photos").slice(0, 8)) {
      const id = await saveUpload(viewer, file);
      if (id) uploads.push(id);
    }
    const values = {
      familyId: viewer.family.id,
      date: f.date(fd, "date") ?? todayIn(viewer.family.timezone),
      title: f.str(fd, "title"),
      body,
      tags: f.split(fd, "tags").slice(0, 20),
      category: f.str(fd, "category"),
      book: "pet",
      linkedId: p.id,
      visibility,
    };
    const id = f.str(fd, "id");
    await db.transaction(async (tx) => {
      let entryId = id;
      if (id) {
        const [old] = await tx.select().from(journalEntries).where(and(eq(journalEntries.id, id), eq(journalEntries.familyId, viewer.family.id)));
        if (!old || old.authorMemberId !== viewer.member.id) throw new AuthorizationError("Only the author can edit this memory.");
        await tx.update(journalEntries).set(values).where(eq(journalEntries.id, id));
      } else {
        const [row] = await tx.insert(journalEntries).values({ ...values, authorMemberId: viewer.member.id }).returning({ id: journalEntries.id });
        entryId = row!.id;
      }
      if (uploads.length) await tx.insert(journalEntryFiles).values(uploads.map((fileId, i) => ({ entryId: entryId!, fileId, position: 100 + i })));
      await saveRecordAccess(tx, viewer.family.id, "journal_entry", entryId!, memberIds);
    });
    revalidatePets(p.id);
    revalidatePath("/journal", "layout");
    return ok("Memory saved.");
  });
}

export async function deletePetMemory(fd: FormData) {
  const viewer = await requireModule("pets", "edit");
  const id = String(fd.get("id"));
  const [e] = await db.select().from(journalEntries).where(and(eq(journalEntries.id, id), eq(journalEntries.familyId, viewer.family.id), eq(journalEntries.book, "pet")));
  if (!e || e.authorMemberId !== viewer.member.id) throw new AuthorizationError("Only the author can delete this memory.");
  const photos = await db.select().from(journalEntryFiles).where(eq(journalEntryFiles.entryId, id));
  await db.delete(journalEntries).where(eq(journalEntries.id, id));
  for (const ph of photos) await deleteFamilyFile(viewer.family.id, ph.fileId);
  revalidatePets(e.linkedId);
}
