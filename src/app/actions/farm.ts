"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { animalHealthRecords, animals, animalSex, animalStatus, farmPlans, feedLogs, productionKind, productionLogs, storageLocation } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { emptyLayout, LayoutSchema, type BlueprintLayout } from "@/lib/blueprint";
import { AuthorizationError, requireModule, type Viewer } from "@/lib/dal";
import { todayIn } from "@/lib/dates";
import { logActivity } from "@/lib/family";
import { deleteFamilyFile, saveUpload } from "@/lib/files";
import { addToInventory } from "@/lib/kitchen";
import { f } from "@/lib/records";

function revalidateFarm() {
  revalidatePath("/farm", "layout");
  revalidatePath("/kitchen");
  revalidatePath("/calendar");
  revalidatePath("/");
}

async function ownAnimal(viewer: Viewer, id: string) {
  const [a] = await db.select().from(animals).where(and(eq(animals.id, id), eq(animals.familyId, viewer.family.id)));
  if (!a) throw new AuthorizationError("Animal not found.");
  return a;
}

const SEX = animalSex.enumValues;
const STATUS = animalStatus.enumValues;

export async function saveAnimal(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("farm", "edit");
    const name = f.str(fd, "name");
    const species = f.str(fd, "species");
    if (!name) return fail("Give it a name (or a flock/herd name).", "name");
    if (!species) return fail("What kind of animal?", "species");
    const sex = f.str(fd, "sex") as (typeof SEX)[number];
    const status = f.str(fd, "status") as (typeof STATUS)[number];
    const id = f.str(fd, "id");
    const image = await saveUpload(viewer, fd.get("image"));
    const values = {
      familyId: viewer.family.id,
      name,
      species,
      breed: f.str(fd, "breed"),
      sex: SEX.includes(sex) ? sex : "unknown",
      groupName: f.str(fd, "groupName"),
      headCount: Math.max(1, f.int(fd, "headCount") ?? 1),
      birthDate: f.date(fd, "birthDate"),
      acquiredOn: f.date(fd, "acquiredOn"),
      feed: f.str(fd, "feed"),
      status: STATUS.includes(status) ? status : "active",
      notes: f.str(fd, "notes"),
      ...(image ? { imageFileId: image } : {}),
    };
    let animalId = id;
    if (id) {
      const old = await ownAnimal(viewer, id);
      await db.update(animals).set(f.bool(fd, "removeImage") && !image ? { ...values, imageFileId: null } : values).where(eq(animals.id, id));
      if ((image || f.bool(fd, "removeImage")) && old.imageFileId) await deleteFamilyFile(viewer.family.id, old.imageFileId);
    } else {
      const [row] = await db.insert(animals).values(values).returning({ id: animals.id });
      animalId = row!.id;
      await logActivity(db, viewer.family.id, viewer.member.id, "animal.added", `added ${values.headCount > 1 ? `${values.headCount} ${species.toLowerCase()}` : `${name} the ${species.toLowerCase()}`} to the farm`, { module: "farm" });
    }
    revalidateFarm();
    if (!id) redirect(`/farm/animals/${animalId}`);
    return ok("Saved.");
  });
}

export async function deleteAnimal(fd: FormData) {
  const viewer = await requireModule("farm", "edit");
  const a = await ownAnimal(viewer, String(fd.get("id")));
  await db.delete(animals).where(eq(animals.id, a.id));
  await deleteFamilyFile(viewer.family.id, a.imageFileId);
  revalidateFarm();
  redirect("/farm/animals");
}

export async function saveHealthRecord(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("farm", "edit");
    const a = await ownAnimal(viewer, String(fd.get("animalId")));
    const kind = f.str(fd, "kind");
    if (!kind) return fail("What kind of record?", "kind");
    await db.insert(animalHealthRecords).values({
      animalId: a.id,
      date: f.date(fd, "date") ?? todayIn(viewer.family.timezone),
      kind,
      description: f.str(fd, "description"),
      nextDueOn: f.date(fd, "nextDueOn"),
      costCents: f.cents(fd, "cost"),
    });
    revalidateFarm();
    return ok();
  });
}

export async function deleteHealthRecord(fd: FormData) {
  const viewer = await requireModule("farm", "edit");
  const [r] = await db
    .select({ id: animalHealthRecords.id })
    .from(animalHealthRecords)
    .innerJoin(animals, eq(animals.id, animalHealthRecords.animalId))
    .where(and(eq(animalHealthRecords.id, String(fd.get("id"))), eq(animals.familyId, viewer.family.id)));
  if (r) await db.delete(animalHealthRecords).where(eq(animalHealthRecords.id, r.id));
  revalidateFarm();
}

export async function logFeed(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("farm", "edit");
    const feed = f.str(fd, "feed");
    const quantity = f.num(fd, "quantity");
    if (!feed) return fail("What feed?", "feed");
    if (!quantity || quantity <= 0) return fail("How much?", "quantity");
    const animalId = f.str(fd, "animalId");
    if (animalId) await ownAnimal(viewer, animalId);
    await db.insert(feedLogs).values({
      familyId: viewer.family.id,
      animalId,
      groupName: f.str(fd, "groupName"),
      date: f.date(fd, "date") ?? todayIn(viewer.family.timezone),
      feed,
      quantity: String(quantity),
      unit: f.str(fd, "unit") ?? "lb",
      costCents: f.cents(fd, "cost"),
    });
    revalidateFarm();
    return ok("Feed logged.");
  });
}

const KINDS = productionKind.enumValues;
const LOCATIONS = storageLocation.enumValues;
const KITCHEN_NAME: Record<string, string> = { eggs: "Eggs", milk: "Milk", honey: "Honey", meat: "Meat", wool: "Wool", produce: "Farm produce", other: "Farm product" };

/** Record production (eggs, milk…) and optionally add it to the kitchen. */
export async function logProduction(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("farm", "edit");
    const kind = f.str(fd, "kind") as (typeof KINDS)[number];
    if (!KINDS.includes(kind)) return fail("What was produced?", "kind");
    const quantity = f.num(fd, "quantity");
    if (!quantity || quantity <= 0) return fail("How much?", "quantity");
    const unit = f.str(fd, "unit") ?? (kind === "eggs" ? "each" : kind === "milk" ? "gal" : "lb");
    const date = f.date(fd, "date") ?? todayIn(viewer.family.timezone);
    const animalId = f.str(fd, "animalId");
    let animalName: string | null = null;
    if (animalId) animalName = (await ownAnimal(viewer, animalId)).name;
    let inventoryItemId: string | null = null;
    if (f.bool(fd, "addToKitchen") && viewer.can("kitchen", "edit") && kind !== "wool") {
      const loc = f.str(fd, "location") as (typeof LOCATIONS)[number];
      inventoryItemId = await addToInventory(
        viewer.family.id,
        { name: f.str(fd, "kitchenName") ?? KITCHEN_NAME[kind]!, quantity, unit, location: LOCATIONS.includes(loc) ? loc : kind === "honey" ? "pantry" : "fridge", today: date },
        { source: "farm_production", sourceId: null, memberId: viewer.member.id },
      );
    }
    await db.insert(productionLogs).values({
      familyId: viewer.family.id,
      animalId,
      groupName: f.str(fd, "groupName"),
      kind,
      date,
      quantity: String(quantity),
      unit,
      notes: f.str(fd, "notes"),
      inventoryItemId,
      memberId: viewer.member.id,
    });
    await logActivity(
      db,
      viewer.family.id,
      viewer.member.id,
      "farm.production",
      `collected ${quantity} ${unit === "each" ? "" : `${unit} `}${kind}${animalName ? ` from ${animalName}` : ""}${inventoryItemId ? " (added to the kitchen)" : ""}`.replace(/\s+/g, " "),
      { module: "farm" },
    );
    revalidateFarm();
    return ok("Recorded.");
  });
}

export async function deleteProduction(fd: FormData) {
  const viewer = await requireModule("farm", "edit");
  await db.delete(productionLogs).where(and(eq(productionLogs.id, String(fd.get("id"))), eq(productionLogs.familyId, viewer.family.id)));
  revalidateFarm();
}

// ─── Farm plans ──────────────────────────────────────────────────────────────

export async function createFarmPlan(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("farm", "edit");
    const name = f.str(fd, "name");
    if (!name) return fail("Name your farm map.", "name");
    const [row] = await db
      .insert(farmPlans)
      .values({ familyId: viewer.family.id, name, layout: emptyLayout("farm", f.num(fd, "width") ?? undefined, f.num(fd, "height") ?? undefined), notes: f.str(fd, "notes") })
      .returning({ id: farmPlans.id });
    revalidateFarm();
    redirect(`/farm/plans/${row!.id}`);
  });
}

export async function saveFarmLayout(planId: string, layout: BlueprintLayout) {
  const viewer = await requireModule("farm", "edit");
  const [p] = await db.select({ id: farmPlans.id }).from(farmPlans).where(and(eq(farmPlans.id, planId), eq(farmPlans.familyId, viewer.family.id)));
  if (!p) return { ok: false, message: "Plan not found." };
  const parsed = LayoutSchema.safeParse(layout);
  if (!parsed.success) return { ok: false, message: "That layout couldn't be saved." };
  await db.update(farmPlans).set({ layout: parsed.data }).where(eq(farmPlans.id, planId));
  revalidatePath(`/farm/plans/${planId}`);
  return { ok: true };
}

export async function deleteFarmPlan(fd: FormData) {
  const viewer = await requireModule("farm", "edit");
  await db.delete(farmPlans).where(and(eq(farmPlans.id, String(fd.get("id"))), eq(farmPlans.familyId, viewer.family.id)));
  revalidateFarm();
  redirect("/farm");
}
