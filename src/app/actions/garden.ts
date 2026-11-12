"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { gardenLogKind, gardenLogs, gardenPlans, gardenPlantings, plants, seedInventory, storageLocation, sunRequirement } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { emptyLayout, LayoutSchema, type BlueprintLayout } from "@/lib/blueprint";
import { AuthorizationError, requireModule, type Viewer } from "@/lib/dal";
import { addDays, todayIn } from "@/lib/dates";
import { logActivity } from "@/lib/family";
import { deleteFamilyFile, saveUpload } from "@/lib/files";
import { addToInventory } from "@/lib/kitchen";
import { f } from "@/lib/records";

function revalidateGarden() {
  revalidatePath("/garden", "layout");
  revalidatePath("/calendar");
  revalidatePath("/kitchen");
  revalidatePath("/");
}

async function ownPlan(viewer: Viewer, id: string) {
  const [p] = await db.select().from(gardenPlans).where(and(eq(gardenPlans.id, id), eq(gardenPlans.familyId, viewer.family.id)));
  if (!p) throw new AuthorizationError("Plan not found.");
  return p;
}

/** Plants visible to a family: built-in + their own. */
async function visiblePlant(viewer: Viewer, id: string) {
  const [p] = await db.select().from(plants).where(and(eq(plants.id, id), or(isNull(plants.familyId), eq(plants.familyId, viewer.family.id))));
  if (!p) throw new AuthorizationError("Plant not found.");
  return p;
}

/** First number in "70–85 days" → 70. */
const firstNumber = (s: string | null) => {
  const m = s?.match(/\d+/);
  return m ? Number(m[0]) : null;
};

// ─── Plans & blueprint ───────────────────────────────────────────────────────

export async function createGardenPlan(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("garden", "edit");
    const name = f.str(fd, "name");
    if (!name) return fail("Name your plan.", "name");
    const [row] = await db
      .insert(gardenPlans)
      .values({
        familyId: viewer.family.id,
        name,
        year: f.int(fd, "year"),
        layout: emptyLayout("garden", f.num(fd, "width") ?? undefined, f.num(fd, "height") ?? undefined),
        notes: f.str(fd, "notes"),
      })
      .returning({ id: gardenPlans.id });
    revalidateGarden();
    redirect(`/garden/plans/${row!.id}`);
  });
}

export async function saveGardenLayout(planId: string, layout: BlueprintLayout) {
  const viewer = await requireModule("garden", "edit");
  await ownPlan(viewer, planId);
  const parsed = LayoutSchema.safeParse(layout);
  if (!parsed.success) return { ok: false, message: "That layout couldn't be saved." };
  await db.update(gardenPlans).set({ layout: parsed.data }).where(eq(gardenPlans.id, planId));
  // Plantings in beds that were deleted from the plan lose their bed.
  const keys = new Set(parsed.data.objects.map((o) => o.key));
  const plantings = await db.select({ id: gardenPlantings.id, bedKey: gardenPlantings.bedKey }).from(gardenPlantings).where(eq(gardenPlantings.planId, planId));
  for (const p of plantings) if (p.bedKey && !keys.has(p.bedKey)) await db.update(gardenPlantings).set({ bedKey: null }).where(eq(gardenPlantings.id, p.id));
  revalidatePath(`/garden/plans/${planId}`);
  return { ok: true };
}

export async function updateGardenPlan(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("garden", "edit");
    const plan = await ownPlan(viewer, String(fd.get("id")));
    const name = f.str(fd, "name");
    if (!name) return fail("Name your plan.", "name");
    await db.update(gardenPlans).set({ name, year: f.int(fd, "year"), notes: f.str(fd, "notes") }).where(eq(gardenPlans.id, plan.id));
    revalidateGarden();
    return ok();
  });
}

export async function deleteGardenPlan(fd: FormData) {
  const viewer = await requireModule("garden", "edit");
  const plan = await ownPlan(viewer, String(fd.get("id")));
  await db.delete(gardenPlans).where(eq(gardenPlans.id, plan.id));
  revalidateGarden();
  redirect("/garden");
}

// ─── Plantings ───────────────────────────────────────────────────────────────

export async function addPlanting(planId: string, bedKey: string, plantId: string, quantity: number) {
  const viewer = await requireModule("garden", "edit");
  const plan = await ownPlan(viewer, planId);
  const plant = await visiblePlant(viewer, plantId);
  if (!plan.layout.objects.some((o) => o.key === bedKey)) throw new AuthorizationError("Bed not found.");
  // Same plant in the same bed → bump quantity.
  const [existing] = await db
    .select()
    .from(gardenPlantings)
    .where(and(eq(gardenPlantings.planId, planId), eq(gardenPlantings.bedKey, bedKey), eq(gardenPlantings.plantId, plantId)));
  if (existing) await db.update(gardenPlantings).set({ quantity: existing.quantity + Math.max(1, quantity) }).where(eq(gardenPlantings.id, existing.id));
  else await db.insert(gardenPlantings).values({ familyId: viewer.family.id, planId, bedKey, plantId: plant.id, quantity: Math.max(1, Math.min(999, quantity)), plannedOn: todayIn(viewer.family.timezone) });
  revalidatePath(`/garden/plans/${planId}`);
  revalidatePath("/garden");
}

async function ownPlanting(viewer: Viewer, id: string) {
  const [p] = await db.select().from(gardenPlantings).where(and(eq(gardenPlantings.id, id), eq(gardenPlantings.familyId, viewer.family.id)));
  if (!p) throw new AuthorizationError("Planting not found.");
  return p;
}

export async function updatePlantingQuantity(id: string, quantity: number) {
  const viewer = await requireModule("garden", "edit");
  const p = await ownPlanting(viewer, id);
  await db.update(gardenPlantings).set({ quantity: Math.max(1, Math.min(999, Math.round(quantity))) }).where(eq(gardenPlantings.id, p.id));
  revalidatePath(`/garden/plans/${p.planId}`);
}

export async function removePlanting(id: string) {
  const viewer = await requireModule("garden", "edit");
  const p = await ownPlanting(viewer, id);
  await db.delete(gardenPlantings).where(eq(gardenPlantings.id, p.id));
  revalidatePath(`/garden/plans/${p.planId}`);
  revalidatePath("/garden");
}

const STATUSES = ["planned", "sown", "growing", "harvesting", "finished", "failed"] as const;

export async function updatePlanting(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("garden", "edit");
    const p = await ownPlanting(viewer, String(fd.get("id")));
    const status = f.str(fd, "status") as (typeof STATUSES)[number];
    const plantedOn = f.date(fd, "plantedOn");
    let expected = f.date(fd, "expectedHarvestOn");
    if (!expected && plantedOn) {
      const [plant] = await db.select().from(plants).where(eq(plants.id, p.plantId));
      const days = firstNumber(plant?.daysToMaturity ?? null);
      if (days) expected = addDays(plantedOn, days);
    }
    await db
      .update(gardenPlantings)
      .set({ status: STATUSES.includes(status) ? status : p.status, plantedOn, expectedHarvestOn: expected, quantity: f.int(fd, "quantity") ?? p.quantity, notes: f.str(fd, "notes") })
      .where(eq(gardenPlantings.id, p.id));
    revalidateGarden();
    return ok();
  });
}

// ─── Plant database (custom plants) ─────────────────────────────────────────

const SUN = sunRequirement.enumValues;

export async function savePlant(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("garden", "edit");
    const name = f.str(fd, "name");
    if (!name) return fail("Name the plant.", "name");
    const id = f.str(fd, "id");
    const image = await saveUpload(viewer, fd.get("image"));
    const sun = f.str(fd, "sun") as (typeof SUN)[number] | null;
    const values = {
      familyId: viewer.family.id,
      name,
      variety: f.str(fd, "variety"),
      category: f.str(fd, "category"),
      growingZones: f.str(fd, "growingZones"),
      sun: sun && SUN.includes(sun) ? sun : null,
      soil: f.str(fd, "soil"),
      water: f.str(fd, "water"),
      plantingDepthIn: f.num(fd, "plantingDepthIn") !== null ? String(f.num(fd, "plantingDepthIn")) : null,
      spacingIn: f.num(fd, "spacingIn") !== null ? String(f.num(fd, "spacingIn")) : null,
      germinationDays: f.str(fd, "germinationDays"),
      daysToMaturity: f.str(fd, "daysToMaturity"),
      companionPlants: f.split(fd, "companionPlants"),
      avoidPlants: f.split(fd, "avoidPlants"),
      plantingWindow: f.str(fd, "plantingWindow"),
      harvestWindow: f.str(fd, "harvestWindow"),
      soilAmendments: f.str(fd, "soilAmendments"),
      fertilizer: f.str(fd, "fertilizer"),
      seedInfo: f.str(fd, "seedInfo"),
      notes: f.str(fd, "notes"),
      ...(image ? { imageFileId: image } : {}),
    };
    let plantId = id;
    if (id) {
      const [old] = await db.select().from(plants).where(and(eq(plants.id, id), eq(plants.familyId, viewer.family.id)));
      if (!old) return fail("Only your own plants can be edited. Use “Customize” to make a copy.");
      await db.update(plants).set(values).where(eq(plants.id, id));
      if (image && old.imageFileId) await deleteFamilyFile(viewer.family.id, old.imageFileId);
    } else {
      const [row] = await db.insert(plants).values({ ...values, imageUrl: f.str(fd, "emojiImage") }).returning({ id: plants.id });
      plantId = row!.id;
      await logActivity(db, viewer.family.id, viewer.member.id, "plant.added", `added ${name} to the plant database`, { module: "garden" });
    }
    revalidateGarden();
    if (!id) redirect(`/garden/plants/${plantId}`);
    return ok("Saved.");
  });
}

export async function deletePlant(fd: FormData) {
  const viewer = await requireModule("garden", "edit");
  const [p] = await db.select().from(plants).where(and(eq(plants.id, String(fd.get("id"))), eq(plants.familyId, viewer.family.id)));
  if (!p) return;
  const used = await db.select({ id: gardenPlantings.id }).from(gardenPlantings).where(eq(gardenPlantings.plantId, p.id)).limit(1);
  if (used.length) throw new AuthorizationError("This plant is used in a garden plan. Remove those plantings first.");
  await db.delete(plants).where(eq(plants.id, p.id));
  await deleteFamilyFile(viewer.family.id, p.imageFileId);
  revalidateGarden();
  redirect("/garden/plants");
}

// ─── Seeds ───────────────────────────────────────────────────────────────────

export async function saveSeed(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("garden", "edit");
    const name = f.str(fd, "name");
    if (!name) return fail("What seeds are these?", "name");
    const plantId = f.str(fd, "plantId");
    if (plantId) await visiblePlant(viewer, plantId);
    const values = { familyId: viewer.family.id, name, plantId, quantity: f.str(fd, "quantity"), source: f.str(fd, "source"), packedFor: f.str(fd, "packedFor"), purchasedOn: f.date(fd, "purchasedOn"), notes: f.str(fd, "notes") };
    const id = f.str(fd, "id");
    if (id) await db.update(seedInventory).set(values).where(and(eq(seedInventory.id, id), eq(seedInventory.familyId, viewer.family.id)));
    else await db.insert(seedInventory).values(values);
    revalidateGarden();
    return ok();
  });
}

export async function deleteSeed(fd: FormData) {
  const viewer = await requireModule("garden", "edit");
  await db.delete(seedInventory).where(and(eq(seedInventory.id, String(fd.get("id"))), eq(seedInventory.familyId, viewer.family.id)));
  revalidateGarden();
}

// ─── Garden log (tracking & harvests) ────────────────────────────────────────

const LOG_KINDS = gardenLogKind.enumValues;
const LOCATIONS = storageLocation.enumValues;

export async function logGarden(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("garden", "edit");
    const kind = f.str(fd, "kind") as (typeof LOG_KINDS)[number];
    if (!LOG_KINDS.includes(kind)) return fail("Choose what happened.", "kind");
    const date = f.date(fd, "date") ?? todayIn(viewer.family.timezone);
    const plantingId = f.str(fd, "plantingId");
    let plantId = f.str(fd, "plantId");
    let plantName: string | null = null;
    if (plantingId) {
      const p = await ownPlanting(viewer, plantingId);
      plantId = p.plantId;
    }
    if (plantId) plantName = (await visiblePlant(viewer, plantId)).name;
    if (!plantId && kind !== "note") return fail("Which plant?", "plantingId");
    const quantity = f.num(fd, "quantity");
    if (kind === "harvest" && (quantity === null || quantity <= 0)) return fail("How much did you harvest?", "quantity");
    const photo = await saveUpload(viewer, fd.get("image"));
    const unit = f.str(fd, "unit");
    const [log] = await db
      .insert(gardenLogs)
      .values({ familyId: viewer.family.id, plantingId, plantId, kind, date, quantity: quantity !== null ? String(quantity) : null, unit, notes: f.str(fd, "notes"), photoFileId: photo, memberId: viewer.member.id })
      .returning({ id: gardenLogs.id });

    // Planting lifecycle follows the log.
    if (plantingId) {
      const next = { sown: "sown", germinated: "growing", transplanted: "growing", harvest: "harvesting" }[kind as string] as (typeof STATUSES)[number] | undefined;
      if (next) {
        const p = await ownPlanting(viewer, plantingId);
        const plantedOn = kind === "sown" || kind === "transplanted" ? (p.plantedOn ?? date) : p.plantedOn;
        let expected = p.expectedHarvestOn;
        if (!expected && plantedOn && plantId) {
          const days = firstNumber((await visiblePlant(viewer, plantId)).daysToMaturity);
          if (days) expected = addDays(plantedOn, days);
        }
        await db.update(gardenPlantings).set({ status: next, plantedOn, expectedHarvestOn: expected }).where(eq(gardenPlantings.id, p.id));
      }
    }

    // Garden → Kitchen: harvests can go straight into inventory.
    if (kind === "harvest" && f.bool(fd, "addToKitchen") && viewer.can("kitchen", "edit") && plantName && quantity) {
      const loc = f.str(fd, "location") as (typeof LOCATIONS)[number];
      await addToInventory(
        viewer.family.id,
        { name: plantName, quantity, unit, location: LOCATIONS.includes(loc) ? loc : "fridge", today: date },
        { source: "garden_harvest", sourceId: log!.id, memberId: viewer.member.id },
      );
    }
    const verb = { harvest: `harvested ${quantity ?? ""} ${unit ?? ""} of ${plantName}`, sown: `planted ${plantName}`, transplanted: `transplanted ${plantName}`, germinated: `${plantName} sprouted`, seed_saved: `saved ${plantName} seeds` }[kind as string];
    if (verb) await logActivity(db, viewer.family.id, viewer.member.id, `garden.${kind}`, verb.replace(/\s+/g, " "), { module: "garden" });
    revalidateGarden();
    return ok("Logged.");
  });
}

export async function deleteGardenLog(fd: FormData) {
  const viewer = await requireModule("garden", "edit");
  const [l] = await db.delete(gardenLogs).where(and(eq(gardenLogs.id, String(fd.get("id"))), eq(gardenLogs.familyId, viewer.family.id))).returning();
  if (l) await deleteFamilyFile(viewer.family.id, l.photoFileId);
  revalidateGarden();
}
