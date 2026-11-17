"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { vehicleOdometer, vehicleParts, vehicles, vehicleSchedule, vehicleServices } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { AuthorizationError, getViewer, type Viewer } from "@/lib/dal";
import { todayIn } from "@/lib/dates";
import { recordExpense } from "@/lib/expenses";
import { deleteFamilyFile, saveUpload } from "@/lib/files";
import { familyMemberIdOrNull, f } from "@/lib/records";
import { DEFAULT_SCHEDULE, monthlyPayment } from "@/lib/vehicles";
import { vehicleOwnerIs, vehicleScope } from "@/lib/vehicle-data";

/**
 * Vehicles. "Use": log mileage and work done. "Add & edit": vehicles, the
 * maintenance plan, parts and the loan; change anyone's entries.
 */
function revalidateVehicles(id?: string) {
  revalidatePath("/vehicles", "layout");
  if (id) revalidatePath(`/vehicles/${id}`);
  revalidatePath("/calendar", "layout");
  revalidatePath("/");
}

/** Parents work on the family's vehicles; a member with My Vehicles only on their own. */
async function actor(level: "use" | "edit") {
  const viewer = await getViewer();
  const scope = vehicleScope(viewer);
  if (!scope || (level === "edit" ? !scope.canEdit : !scope.canUse)) throw new AuthorizationError("You don't have access to vehicles.");
  return { viewer, owner: scope.owner, canEditAll: scope.canEdit };
}

async function ownVehicle(viewer: Viewer, owner: string | null, id: string | null) {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new AuthorizationError("Vehicle not found.");
  const [v] = await db.select().from(vehicles).where(and(eq(vehicles.id, id), eq(vehicles.familyId, viewer.family.id), vehicleOwnerIs(owner)));
  if (!v) throw new AuthorizationError("Vehicle not found.");
  return v;
}

export async function saveVehicle(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const { viewer, owner } = await actor("edit");
    const nickname = f.str(fd, "nickname");
    if (!nickname) return fail("Give it a name (e.g. Mom's SUV).", "nickname");
    const year = f.int(fd, "year");
    if (year !== null && (year < 1900 || year > 2100)) return fail("Check the year.", "year");
    const image = await saveUpload(viewer, fd.get("image"));
    const values = {
      familyId: viewer.family.id,
      nickname: nickname.slice(0, 60),
      year,
      make: f.str(fd, "make"),
      model: f.str(fd, "model"),
      trim: f.str(fd, "trim"),
      color: f.str(fd, "color"),
      vin: f.str(fd, "vin")?.toUpperCase().slice(0, 17) ?? null,
      plate: f.str(fd, "plate")?.toUpperCase() ?? null,
      driverMemberId: owner ?? (await familyMemberIdOrNull(viewer.family.id, f.str(fd, "driverMemberId"))),
      purchaseDate: f.date(fd, "purchaseDate"),
      purchasePriceCents: f.cents(fd, "purchasePrice"),
      oilType: f.str(fd, "oilType"),
      tireSize: f.str(fd, "tireSize"),
      insuranceCompany: f.str(fd, "insuranceCompany"),
      insurancePolicy: f.str(fd, "insurancePolicy"),
      insuranceRenewsOn: f.date(fd, "insuranceRenewsOn"),
      registrationExpiresOn: f.date(fd, "registrationExpiresOn"),
      inspectionDueOn: f.date(fd, "inspectionDueOn"),
      active: fd.get("active") !== "no",
      notes: f.str(fd, "notes"),
      ...(image ? { imageFileId: image } : fd.get("removeImage") === "1" ? { imageFileId: null } : {}),
    };
    const id = f.str(fd, "id");
    if (id) {
      const old = await ownVehicle(viewer, owner, id);
      await db.update(vehicles).set(values).where(eq(vehicles.id, old.id));
      if (old.imageFileId && (image || fd.get("removeImage") === "1")) await deleteFamilyFile(viewer.family.id, old.imageFileId);
      revalidateVehicles(old.id);
      return ok("Saved.");
    }
    const [v] = await db.insert(vehicles).values({ ...values, privateOwnerId: owner }).returning({ id: vehicles.id });
    // Starter maintenance plan (editable) and the current odometer.
    await db.insert(vehicleSchedule).values(DEFAULT_SCHEDULE.map((s) => ({ familyId: viewer.family.id, vehicleId: v!.id, ...s })));
    const miles = f.int(fd, "miles");
    if (miles && miles > 0) await db.insert(vehicleOdometer).values({ familyId: viewer.family.id, vehicleId: v!.id, date: todayIn(viewer.family.timezone), miles });
    revalidateVehicles();
    redirect(`/vehicles/${v!.id}`);
  });
}

export async function deleteVehicle(fd: FormData) {
  const { viewer, owner } = await actor("edit");
  const v = await ownVehicle(viewer, owner, String(fd.get("id")));
  await db.delete(vehicles).where(eq(vehicles.id, v.id));
  if (v.imageFileId) await deleteFamilyFile(viewer.family.id, v.imageFileId);
  revalidateVehicles();
  redirect("/vehicles");
}

export async function logMileage(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const { viewer, owner } = await actor("use");
    const v = await ownVehicle(viewer, owner, f.str(fd, "vehicleId"));
    const miles = f.int(fd, "miles");
    if (!miles || miles <= 0 || miles > 2_000_000) return fail("Enter the odometer reading.", "miles");
    await db.insert(vehicleOdometer).values({ familyId: viewer.family.id, vehicleId: v.id, date: f.date(fd, "date") ?? todayIn(viewer.family.timezone), miles });
    revalidateVehicles(v.id);
    return ok("Mileage saved.");
  });
}

export async function deleteMileage(fd: FormData) {
  const { viewer, owner } = await actor("edit");
  const [row] = await db.select().from(vehicleOdometer).where(and(eq(vehicleOdometer.id, String(fd.get("id"))), eq(vehicleOdometer.familyId, viewer.family.id)));
  if (!row) return;
  await ownVehicle(viewer, owner, row.vehicleId);
  await db.delete(vehicleOdometer).where(eq(vehicleOdometer.id, row.id));
  revalidateVehicles();
}

const KINDS = ["maintenance", "repair", "inspection", "tires", "upgrade", "other"];

/** Work done. Linking a maintenance item marks it done at this date/mileage. */
export async function saveService(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const { viewer, owner, canEditAll } = await actor("use");
    const v = await ownVehicle(viewer, owner, f.str(fd, "vehicleId"));
    const scheduleId = f.str(fd, "scheduleId");
    const [item] = scheduleId ? await db.select().from(vehicleSchedule).where(and(eq(vehicleSchedule.id, scheduleId), eq(vehicleSchedule.vehicleId, v.id))) : [];
    const title = f.str(fd, "title") ?? item?.title;
    if (!title) return fail("What was done?", "title");
    const date = f.date(fd, "date") ?? todayIn(viewer.family.timezone);
    const miles = f.int(fd, "miles");
    const costCents = f.cents(fd, "cost");
    const receipt = await saveUpload(viewer, fd.get("receipt"), { allowDocs: true });
    const kind = KINDS.includes(String(fd.get("kind"))) ? String(fd.get("kind")) : "maintenance";
    const values = { vehicleId: v.id, scheduleId: item?.id ?? null, date, miles, kind, title: title.slice(0, 100), shop: f.str(fd, "shop"), parts: f.str(fd, "parts"), costCents: costCents && costCents > 0 ? costCents : null, notes: f.str(fd, "notes"), ...(receipt ? { receiptFileId: receipt } : {}) };
    const id = f.str(fd, "id");
    if (id) {
      const [old] = await db.select().from(vehicleServices).where(and(eq(vehicleServices.id, id), eq(vehicleServices.familyId, viewer.family.id)));
      if (!old) throw new AuthorizationError("Not found.");
      if (!canEditAll && old.loggedByMemberId !== viewer.member.id) throw new AuthorizationError("You can only change what you logged.");
      await db.update(vehicleServices).set(values).where(eq(vehicleServices.id, old.id));
    } else {
      await db.insert(vehicleServices).values({ familyId: viewer.family.id, ...values, loggedByMemberId: viewer.member.id });
      if (miles) await db.insert(vehicleOdometer).values({ familyId: viewer.family.id, vehicleId: v.id, date, miles });
      if (values.costCents && f.bool(fd, "addToBudget") && (owner ? viewer.member.privateFinance : viewer.can("budget", "edit"))) {
        await recordExpense(viewer, { name: `${v.nickname}: ${values.title}`, amountCents: values.costCents, date, categoryName: "Car", mine: !!owner });
        revalidatePath("/budget", "layout");
      }
    }
    if (item && (!item.lastDate || date >= item.lastDate)) await db.update(vehicleSchedule).set({ lastDate: date, lastMiles: miles ?? item.lastMiles }).where(eq(vehicleSchedule.id, item.id));
    revalidateVehicles(v.id);
    return ok("Saved.");
  });
}

export async function deleteService(fd: FormData) {
  const { viewer, owner, canEditAll } = await actor("use");
  const [old] = await db.select().from(vehicleServices).where(and(eq(vehicleServices.id, String(fd.get("id"))), eq(vehicleServices.familyId, viewer.family.id)));
  if (!old) return;
  await ownVehicle(viewer, owner, old.vehicleId);
  if (!canEditAll && old.loggedByMemberId !== viewer.member.id) throw new AuthorizationError("You can only delete what you logged.");
  await db.delete(vehicleServices).where(eq(vehicleServices.id, old.id));
  if (old.receiptFileId) await deleteFamilyFile(viewer.family.id, old.receiptFileId);
  revalidateVehicles(old.vehicleId);
}

export async function saveScheduleItem(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const { viewer, owner } = await actor("edit");
    const v = await ownVehicle(viewer, owner, f.str(fd, "vehicleId"));
    const title = f.str(fd, "title");
    if (!title) return fail("Name it (e.g. Oil change).", "title");
    const everyMiles = f.int(fd, "everyMiles");
    const everyMonths = f.int(fd, "everyMonths");
    if (!everyMiles && !everyMonths) return fail("Set miles, months or both.", "everyMiles");
    const values = { title: title.slice(0, 80), everyMiles, everyMonths, lastDate: f.date(fd, "lastDate"), lastMiles: f.int(fd, "lastMiles"), notes: f.str(fd, "notes") };
    const id = f.str(fd, "id");
    if (id) await db.update(vehicleSchedule).set(values).where(and(eq(vehicleSchedule.id, id), eq(vehicleSchedule.vehicleId, v.id)));
    else await db.insert(vehicleSchedule).values({ familyId: viewer.family.id, vehicleId: v.id, ...values });
    revalidateVehicles(v.id);
    return ok("Saved.");
  });
}

export async function deleteScheduleItem(fd: FormData) {
  const { viewer, owner } = await actor("edit");
  const [row] = await db.select().from(vehicleSchedule).where(and(eq(vehicleSchedule.id, String(fd.get("id"))), eq(vehicleSchedule.familyId, viewer.family.id)));
  if (!row) return;
  await ownVehicle(viewer, owner, row.vehicleId);
  await db.delete(vehicleSchedule).where(eq(vehicleSchedule.id, row.id));
  revalidateVehicles();
}

export async function savePart(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const { viewer, owner } = await actor("edit");
    const v = await ownVehicle(viewer, owner, f.str(fd, "vehicleId"));
    const name = f.str(fd, "name");
    if (!name) return fail("Name the part (e.g. Wiper blades).", "name");
    const values = { name: name.slice(0, 80), partNumber: f.str(fd, "partNumber"), brand: f.str(fd, "brand"), whereToBuy: f.str(fd, "whereToBuy"), lastReplacedOn: f.date(fd, "lastReplacedOn"), notes: f.str(fd, "notes") };
    const id = f.str(fd, "id");
    if (id) await db.update(vehicleParts).set(values).where(and(eq(vehicleParts.id, id), eq(vehicleParts.vehicleId, v.id)));
    else await db.insert(vehicleParts).values({ familyId: viewer.family.id, vehicleId: v.id, ...values });
    revalidateVehicles(v.id);
    return ok("Saved.");
  });
}

export async function deletePart(fd: FormData) {
  const { viewer, owner } = await actor("edit");
  const [row] = await db.select().from(vehicleParts).where(and(eq(vehicleParts.id, String(fd.get("id"))), eq(vehicleParts.familyId, viewer.family.id)));
  if (!row) return;
  await ownVehicle(viewer, owner, row.vehicleId);
  await db.delete(vehicleParts).where(eq(vehicleParts.id, row.id));
  revalidateVehicles();
}

/** Loan details. Leave the payment blank to calculate it from amount, APR and term. */
export async function saveLoan(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const { viewer, owner } = await actor("edit");
    const v = await ownVehicle(viewer, owner, f.str(fd, "vehicleId"));
    if (fd.get("clear") === "1") {
      await db.update(vehicles).set({ loanLender: null, loanAmountCents: null, loanApr: null, loanPaymentCents: null, loanStartDate: null, loanTermMonths: null }).where(eq(vehicles.id, v.id));
      revalidateVehicles(v.id);
      return ok("Loan removed.");
    }
    const amount = f.cents(fd, "amount");
    const term = f.int(fd, "termMonths");
    const start = f.date(fd, "startDate");
    const apr = f.num(fd, "apr") ?? 0;
    if (!amount || amount <= 0) return fail("Enter the amount financed.", "amount");
    if (!term || term < 1 || term > 120) return fail("Enter the term in months (e.g. 60).", "termMonths");
    if (!start) return fail("Enter the loan start date.", "startDate");
    if (apr < 0 || apr > 40) return fail("Check the APR.", "apr");
    const payment = f.cents(fd, "payment") || monthlyPayment(amount, apr, term);
    await db.update(vehicles).set({ loanLender: f.str(fd, "lender"), loanAmountCents: amount, loanApr: apr, loanPaymentCents: payment, loanStartDate: start, loanTermMonths: term }).where(eq(vehicles.id, v.id));
    revalidateVehicles(v.id);
    return ok("Loan saved.");
  });
}
