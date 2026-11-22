"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { babies, babyLogs, babyReminders, babySchedule, babySupplies, familyMembers, listItems } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { BABY_KINDS, FUTURE_OK, LOG_KINDS, milkExpiry, SCHEDULE_KINDS, SCHEDULE_PRESETS, TIMER_KINDS, type BabyLogKind } from "@/lib/baby-kinds";
import { canChangeLog, canManageBaby, getBaby } from "@/lib/baby";
import { AuthorizationError, canChangeItem, requireModule, type Viewer } from "@/lib/dal";
import { mainShoppingListId, notify, viewersOf } from "@/lib/automation";
import { addDays, todayIn, utcToZoned, zonedToUtc } from "@/lib/dates";
import { deleteFamilyFile, saveUpload } from "@/lib/files";
import { f } from "@/lib/records";

/**
 * Baby tracker. Anyone with Baby tracker "Use" logs feeds, diapers, sleep and
 * the rest, and changes what they logged; parents and Add & edit change
 * anything. Babies are shared with everyone who can open the tracker.
 */
function revalidateBaby(id?: string) {
  revalidatePath("/baby", "layout");
  if (id) revalidatePath(`/baby/${id}`, "layout");
  revalidatePath("/");
}

async function babyFor(viewer: Viewer, id: string) {
  const b = await getBaby(viewer, id);
  if (!b) throw new AuthorizationError("Baby not found.");
  return b;
}

const hhmm = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "");
  return /^\d{2}:\d{2}/.test(s) ? s.slice(0, 5) : null;
};

// ─── Babies ─────────────────────────────────────────────────────────────────

export async function saveBaby(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("baby", "use");
    const id = f.str(fd, "id");
    const old = id ? await babyFor(viewer, id) : null;
    if (old && !canManageBaby(viewer, old)) throw new AuthorizationError("Only a parent (or whoever added this baby) can change the profile.");
    const memberIdRaw = f.str(fd, "memberId");
    const [member] = memberIdRaw && /^[0-9a-f-]{36}$/i.test(memberIdRaw) ? await db.select().from(familyMembers).where(and(eq(familyMembers.id, memberIdRaw), eq(familyMembers.familyId, viewer.family.id))) : [];
    const name = f.str(fd, "name") ?? member?.displayName ?? null;
    if (!name) return fail("Choose a family member or type the baby's name.", "name");
    const image = await saveUpload(viewer, fd.get("image"));
    const values = {
      memberId: member?.id ?? null,
      name: name.slice(0, 80),
      birthDate: f.date(fd, "birthDate") ?? member?.birthday ?? null,
      volumeUnit: fd.get("volumeUnit") === "ml" ? ("ml" as const) : ("oz" as const),
      weightUnit: fd.get("weightUnit") === "kg" ? ("kg" as const) : ("lb" as const),
      notes: f.str(fd, "notes"),
      allergies: f.str(fd, "allergies")?.slice(0, 500) ?? null,
      conditions: f.str(fd, "conditions")?.slice(0, 500) ?? null,
      doctorName: f.str(fd, "doctorName")?.slice(0, 120) ?? null,
      doctorPhone: f.str(fd, "doctorPhone")?.slice(0, 40) ?? null,
      clinic: f.str(fd, "clinic")?.slice(0, 200) ?? null,
      ...(image ? { imageFileId: image } : {}),
    };
    let babyId = id;
    if (old) {
      await db.update(babies).set(values).where(eq(babies.id, old.id));
      if (image && old.imageFileId) await deleteFamilyFile(viewer.family.id, old.imageFileId);
    } else {
      const [row] = await db.insert(babies).values({ ...values, familyId: viewer.family.id, createdByMemberId: viewer.member.id }).returning({ id: babies.id });
      babyId = row!.id;
    }
    revalidateBaby(babyId!);
    if (!id) redirect(`/baby/${babyId}`);
    return ok("Saved.");
  });
}

export async function deleteBaby(fd: FormData) {
  const viewer = await requireModule("baby", "use");
  const b = await babyFor(viewer, String(fd.get("id")));
  if (!canManageBaby(viewer, b)) throw new AuthorizationError("Only a parent (or whoever added this baby) can remove the tracker.");
  await db.delete(babies).where(eq(babies.id, b.id));
  revalidateBaby();
  redirect("/baby");
}

// ─── Logs ───────────────────────────────────────────────────────────────────

const pick = <T extends string>(v: FormDataEntryValue | null, opts: readonly T[]) => opts.find((o) => o === v) ?? null;

/** Kind-specific details from the form. */
function detailsFor(kind: BabyLogKind, fd: FormData) {
  const d: Record<string, string | number | boolean | null> = {};
  const title = f.str(fd, "title");
  if (title) d.title = title.slice(0, 160);
  switch (kind) {
    case "nursing":
      d.side = pick(fd.get("side"), ["left", "right", "both"] as const);
      break;
    case "pump":
      d.side = pick(fd.get("side"), ["left", "right", "both"] as const);
      d.stored = pick(fd.get("stored"), ["fridge", "freezer"] as const);
      break;
    case "potty":
      d.result = pick(fd.get("result"), ["pee", "poop", "both", "tried", "accident"] as const) ?? "tried";
      d.where = pick(fd.get("where"), ["potty", "toilet", "diaper", "other"] as const);
      d.prompted = f.bool(fd, "prompted");
      break;
    case "vitamin":
      d.dose = f.str(fd, "dose");
      break;
    case "appointment":
      d.where = f.str(fd, "where")?.slice(0, 200) ?? null;
      break;
    case "bottle":
      d.milk = pick(fd.get("milk"), ["breast", "formula", "mixed", "other"] as const);
      break;
    case "solids":
      d.reaction = pick(fd.get("reaction"), ["loved", "ok", "refused"] as const);
      d.firstTry = f.bool(fd, "firstTry");
      d.allergy = f.bool(fd, "allergy");
      break;
    case "diaper":
      d.type = pick(fd.get("type"), ["wet", "dirty", "both", "dry"] as const) ?? "wet";
      d.color = pick(fd.get("color"), ["yellow", "green", "brown", "black", "red", "white", "other"] as const);
      d.consistency = pick(fd.get("consistency"), ["runny", "seedy", "soft", "formed", "hard"] as const);
      d.rash = f.bool(fd, "rash");
      break;
    case "sleep":
      d.where = pick(fd.get("where"), ["crib", "bassinet", "bed", "arms", "car", "stroller", "other"] as const);
      d.type = pick(fd.get("sleepType"), ["nap", "night"] as const);
      d.quality = pick(fd.get("quality"), ["well", "okay", "restless"] as const);
      break;
    case "growth":
      d.height = f.num(fd, "height");
      d.head = f.num(fd, "head");
      d.lengthUnit = fd.get("lengthUnit") === "cm" ? "cm" : "in";
      break;
    case "temperature":
      d.unit = fd.get("tempUnit") === "C" ? "C" : "F";
      d.method = pick(fd.get("method"), ["forehead", "ear", "underarm", "rectal", "oral"] as const);
      break;
    case "medicine":
      d.dose = f.str(fd, "dose");
      break;
    case "symptom":
      d.severity = pick(fd.get("severity"), ["mild", "moderate", "severe"] as const);
      break;
  }
  return d;
}

export async function saveBabyLog(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("baby", "use");
    const b = await babyFor(viewer, String(fd.get("babyId")));
    const id = f.str(fd, "id");
    const [old] = id ? await db.select().from(babyLogs).where(and(eq(babyLogs.id, id), eq(babyLogs.babyId, b.id))) : [];
    if (id && !old) throw new AuthorizationError("Not found.");
    if (old && !canChangeLog(viewer, old)) throw new AuthorizationError("You can only change what you logged.");
    const kind = (old?.kind ?? pick(fd.get("kind"), LOG_KINDS)) as BabyLogKind | null;
    if (!kind) return fail("What are you logging?");
    const tz = viewer.family.timezone;
    const date = f.date(fd, "date") ?? todayIn(tz);
    const time = hhmm(fd.get("time")) ?? utcToZoned(new Date(), tz).time;
    const startedAt = zonedToUtc(date, time, tz);
    if (startedAt.getTime() > Date.now() + 5 * 60_000 && !FUTURE_OK.includes(kind)) return fail("That time is in the future.", "time");
    let endedAt: Date | null = null;
    if (BABY_KINDS[kind].timer) {
      const endTime = hhmm(fd.get("endTime"));
      const minutes = f.num(fd, "minutes");
      if (endTime) {
        endedAt = zonedToUtc(date, endTime, tz);
        if (endedAt <= startedAt) endedAt = zonedToUtc(addDays(date, 1), endTime, tz); // overnight
      } else if (minutes !== null && minutes >= 0) endedAt = new Date(startedAt.getTime() + minutes * 60_000);
      else if (old) endedAt = old.endedAt;
      else endedAt = startedAt; // logged after the fact with no length
    } else endedAt = null;
    const amount = f.num(fd, "amount");
    const data = detailsFor(kind, fd);
    if (["medicine", "vaccine", "milestone", "symptom", "activity", "teeth", "vitamin", "appointment"].includes(kind) && !data.title) return fail("Add a name.", "title");
    if (["note", "caregiver", "development", "journal"].includes(kind) && !f.str(fd, "notes") && !data.title) return fail("Write a few words.", "notes");
    const image = await saveUpload(viewer, fd.get("image"));
    if (kind === "photo" && !image && !old?.imageFileId) return fail("Choose a photo.", "image");
    const values = { kind, startedAt, endedAt, amount: amount !== null ? String(amount) : null, data, notes: f.str(fd, "notes"), ...(image ? { imageFileId: image } : {}) };
    if (old) {
      await db.update(babyLogs).set(values).where(eq(babyLogs.id, old.id));
      if (image && old.imageFileId) await deleteFamilyFile(viewer.family.id, old.imageFileId);
    } else {
      // Twins/multiples: log the same thing for the other babies picked too.
      const others = await otherBabies(viewer, b.id, fd.getAll("alsoFor"));
      await db.insert(babyLogs).values([b.id, ...others].map((babyId) => ({ ...values, familyId: viewer.family.id, babyId, createdByMemberId: viewer.member.id })));
      if (kind === "diaper") await takeDiapers(viewer, [b.id, ...others]);
      if (kind === "pump" && data.stored && amount) await stashMilk(viewer, b.id, amount, startedAt, data.stored as "fridge" | "freezer");
    }
    revalidateBaby(b.id);
    return ok(id ? "Saved." : `${BABY_KINDS[kind].label} logged.`);
  });
}

/** One-tap logging from the Today screen (diaper, bottle of the usual size…). */
export async function quickBabyLog(fd: FormData) {
  const viewer = await requireModule("baby", "use");
  const b = await babyFor(viewer, String(fd.get("babyId")));
  const kind = pick(fd.get("kind"), ["diaper", "bath"] as const);
  if (!kind) return;
  const data: Record<string, string> = kind === "diaper" ? { type: pick(fd.get("type"), ["wet", "dirty", "both", "dry"] as const) ?? "wet" } : {};
  const ids = [b.id, ...(await otherBabies(viewer, b.id, fd.getAll("alsoFor")))];
  const now = new Date();
  await db.insert(babyLogs).values(ids.map((babyId) => ({ familyId: viewer.family.id, babyId, kind, startedAt: now, data, createdByMemberId: viewer.member.id })));
  if (kind === "diaper") await takeDiapers(viewer, ids);
  revalidateBaby(b.id);
}

/** Start a timer (nursing on a side, sleep, tummy time). Stops one of the same kind already running. */
export async function startBabyTimer(fd: FormData) {
  const viewer = await requireModule("baby", "use");
  const b = await babyFor(viewer, String(fd.get("babyId")));
  const kind = pick(fd.get("kind"), TIMER_KINDS);
  if (!kind) return;
  const now = new Date();
  // Nursing and sleep don't overlap themselves; switching sides ends the last side.
  await db.update(babyLogs).set({ endedAt: now }).where(and(eq(babyLogs.babyId, b.id), eq(babyLogs.kind, kind), isNull(babyLogs.endedAt)));
  const side = kind === "nursing" ? (pick(fd.get("side"), ["left", "right"] as const) ?? "left") : null;
  await db.insert(babyLogs).values({ familyId: viewer.family.id, babyId: b.id, kind, startedAt: now, data: side ? { side } : {}, createdByMemberId: viewer.member.id });
  revalidateBaby(b.id);
}

export async function stopBabyTimer(fd: FormData) {
  const viewer = await requireModule("baby", "use");
  const [l] = await db.select().from(babyLogs).where(and(eq(babyLogs.id, String(fd.get("id"))), eq(babyLogs.familyId, viewer.family.id)));
  if (!l || l.endedAt) return;
  await db.update(babyLogs).set({ endedAt: new Date() }).where(eq(babyLogs.id, l.id));
  revalidateBaby(l.babyId);
}

export async function deleteBabyLog(fd: FormData) {
  const viewer = await requireModule("baby", "use");
  const [l] = await db.select().from(babyLogs).where(and(eq(babyLogs.id, String(fd.get("id"))), eq(babyLogs.familyId, viewer.family.id)));
  if (!l) return;
  if (!canChangeLog(viewer, l)) throw new AuthorizationError("You can only delete what you logged.");
  await db.delete(babyLogs).where(eq(babyLogs.id, l.id));
  await deleteFamilyFile(viewer.family.id, l.imageFileId);
  revalidateBaby(l.babyId);
}

// ─── Schedule ───────────────────────────────────────────────────────────────

const SCHED_KINDS = SCHEDULE_KINDS.map((k) => k.value);

async function schedulable(viewer: Viewer, babyId: string) {
  const b = await babyFor(viewer, babyId);
  if (!viewer.can("baby", "use")) throw new AuthorizationError("You can't change the schedule.");
  return b;
}

export async function saveBabyScheduleItem(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("baby", "use");
    const b = await schedulable(viewer, String(fd.get("babyId")));
    const id = f.str(fd, "id");
    const time = hhmm(fd.get("time"));
    if (!time) return fail("What time?", "time");
    const kind = pick(fd.get("kind"), SCHED_KINDS) ?? "other";
    const title = f.str(fd, "title") ?? SCHEDULE_KINDS.find((k) => k.value === kind)!.label;
    const days = f.list(fd, "days").map(Number).filter((d) => d >= 0 && d <= 6);
    const values = { time, kind, title: title.slice(0, 80), minutes: f.num(fd, "minutes"), days: days.length === 7 ? [] : days, notes: f.str(fd, "notes") };
    if (id) await db.update(babySchedule).set(values).where(and(eq(babySchedule.id, id), eq(babySchedule.babyId, b.id)));
    else await db.insert(babySchedule).values({ ...values, familyId: viewer.family.id, babyId: b.id });
    revalidateBaby(b.id);
    return ok(id ? "Saved." : `${title} added.`);
  });
}

export async function deleteBabyScheduleItem(fd: FormData) {
  const viewer = await requireModule("baby", "use");
  const [s] = await db.select().from(babySchedule).where(and(eq(babySchedule.id, String(fd.get("id"))), eq(babySchedule.familyId, viewer.family.id)));
  if (!s) return;
  await schedulable(viewer, s.babyId);
  await db.delete(babySchedule).where(eq(babySchedule.id, s.id));
  revalidateBaby(s.babyId);
}

/** Fill the routine from a ready-made one (replacing what's there when asked). */
export async function applySchedulePreset(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("baby", "use");
    const b = await schedulable(viewer, String(fd.get("babyId")));
    const preset = SCHEDULE_PRESETS[String(fd.get("preset"))];
    if (!preset) return fail("Pick a routine.", "preset");
    await db.transaction(async (tx) => {
      if (f.bool(fd, "replace")) await tx.delete(babySchedule).where(eq(babySchedule.babyId, b.id));
      await tx.insert(babySchedule).values(preset.items.map((i) => ({ familyId: viewer.family.id, babyId: b.id, time: i.time, kind: i.kind, title: i.title, minutes: i.minutes ?? null, days: [] })));
    });
    revalidateBaby(b.id);
    return ok("Routine added. Adjust any times to fit your baby.");
  });
}

/** Remove every routine item (start over). */
export async function clearBabySchedule(fd: FormData) {
  const viewer = await requireModule("baby", "use");
  const b = await schedulable(viewer, String(fd.get("babyId")));
  await db.delete(babySchedule).where(and(eq(babySchedule.babyId, b.id), inArray(babySchedule.kind, SCHED_KINDS)));
  revalidateBaby(b.id);
}

// ─── Multiples ──────────────────────────────────────────────────────────────

/** Other babies in the viewer's family picked in "Also log for" (validated). */
async function otherBabies(viewer: Viewer, babyId: string, raw: FormDataEntryValue[]) {
  const ids = [...new Set(raw.flatMap((x) => String(x).split(",")).map((x) => x.trim()).filter((x) => /^[0-9a-f-]{36}$/i.test(x) && x !== babyId))].slice(0, 6);
  if (!ids.length) return [];
  const rows = await db.select({ id: babies.id }).from(babies).where(and(eq(babies.familyId, viewer.family.id), inArray(babies.id, ids)));
  return rows.map((r) => r.id);
}

// ─── Supplies ───────────────────────────────────────────────────────────────

const SUPPLY_KINDS = ["diapers", "wipes", "formula", "food", "milk", "bottles", "other"] as const;

/** One diaper used per change, from the baby's own stock or the shared stock. */
async function takeDiapers(viewer: Viewer, babyIds: string[]) {
  for (const babyId of babyIds) {
    const [stock] = await db
      .select()
      .from(babySupplies)
      .where(and(eq(babySupplies.familyId, viewer.family.id), eq(babySupplies.kind, "diapers"), isNull(babySupplies.usedAt), sql`(${babySupplies.babyId} = ${babyId} or ${babySupplies.babyId} is null)`, sql`${babySupplies.quantity} > 0`))
      .orderBy(sql`${babySupplies.babyId} is null`, babySupplies.createdAt)
      .limit(1);
    if (!stock) continue;
    const next = Math.max(0, Number(stock.quantity) - 1);
    await db.update(babySupplies).set({ quantity: String(next) }).where(eq(babySupplies.id, stock.id));
    await lowStockCheck(viewer, stock, Number(stock.quantity), next);
  }
}

/** Crossed the low-stock line: onto the shopping list and a heads-up to caregivers. */
async function lowStockCheck(viewer: Viewer, s: typeof babySupplies.$inferSelect, before: number, after: number) {
  if (s.lowAt === null || s.kind === "milk") return;
  const low = Number(s.lowAt);
  if (!(before > low && after <= low)) return;
  if (viewer.can("shopping", "add")) {
    const listId = await mainShoppingListId(viewer.family.id);
    const [already] = await db.select({ id: listItems.id }).from(listItems).where(and(eq(listItems.listId, listId), eq(listItems.sourceId, s.id), eq(listItems.checked, false)));
    if (!already) await db.insert(listItems).values({ listId, text: s.name, shoppingCategory: "household", sourceId: s.id, addedByMemberId: viewer.member.id, notes: "Baby supplies running low", position: 1000 });
  }
  const to = await viewersOf(viewer.family.id, "baby");
  await notify(viewer.family.id, to, { kind: "low_stock", title: `Running low: ${s.name}`, body: `${after}${s.unit ? ` ${s.unit}` : ""} left.`, href: "/baby" }, todayIn(viewer.family.timezone));
}

/** Pumped milk straight into the stash. */
async function stashMilk(viewer: Viewer, babyId: string, amount: number, pumpedAt: Date, place: "fridge" | "freezer") {
  const [b] = await db.select({ unit: babies.volumeUnit }).from(babies).where(eq(babies.id, babyId));
  await db.insert(babySupplies).values({
    familyId: viewer.family.id,
    babyId,
    kind: "milk",
    name: `Breast milk ${amount} ${b?.unit ?? "oz"}`,
    quantity: String(amount),
    unit: b?.unit ?? "oz",
    location: place,
    pumpedAt,
    expiresOn: milkExpiry(place, pumpedAt).toISOString().slice(0, 10),
    createdByMemberId: viewer.member.id,
  });
}

export async function saveBabySupply(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("baby", "use");
    const id = f.str(fd, "id");
    const [old] = id ? await db.select().from(babySupplies).where(and(eq(babySupplies.id, id), eq(babySupplies.familyId, viewer.family.id))) : [];
    if (id && !old) throw new AuthorizationError("Not found.");
    const kind = pick(fd.get("kind"), SUPPLY_KINDS) ?? old?.kind ?? "other";
    const babyIdRaw = f.str(fd, "babyId");
    const babyId = babyIdRaw ? (await getBaby(viewer, babyIdRaw))?.id ?? null : null;
    const quantity = f.num(fd, "quantity") ?? 0;
    if (quantity < 0) return fail("Quantity can't be negative.", "quantity");
    const tz = viewer.family.timezone;
    const place = pick(fd.get("location"), ["room", "fridge", "freezer", "thawed"] as const);
    const pumpedDate = f.date(fd, "pumpedOn");
    const pumpedAt = kind === "milk" ? (pumpedDate ? zonedToUtc(pumpedDate, hhmm(fd.get("pumpedTime")) ?? "08:00", tz) : (old?.pumpedAt ?? new Date())) : null;
    const name = f.str(fd, "name") ?? (kind === "milk" ? `Breast milk ${quantity} ${f.str(fd, "unit") ?? "oz"}` : null);
    if (!name) return fail("What is it?", "name");
    const values = {
      kind,
      babyId,
      name: name.slice(0, 120),
      quantity: String(quantity),
      unit: f.str(fd, "unit"),
      lowAt: kind === "milk" ? null : f.num(fd, "lowAt") !== null ? String(f.num(fd, "lowAt")) : null,
      location: kind === "milk" ? (place ?? "fridge") : null,
      pumpedAt,
      expiresOn: kind === "milk" && pumpedAt ? milkExpiry(place ?? "fridge", place === "thawed" ? new Date() : pumpedAt).toISOString().slice(0, 10) : f.date(fd, "expiresOn"),
      notes: f.str(fd, "notes"),
    };
    if (old) await db.update(babySupplies).set(values).where(eq(babySupplies.id, old.id));
    else await db.insert(babySupplies).values({ ...values, familyId: viewer.family.id, createdByMemberId: viewer.member.id });
    revalidateBaby(babyId ?? undefined);
    return ok(id ? "Saved." : `${name} added.`);
  });
}

async function supplyFor(viewer: Viewer, id: unknown) {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw new AuthorizationError("Not found.");
  const [s] = await db.select().from(babySupplies).where(and(eq(babySupplies.id, id), eq(babySupplies.familyId, viewer.family.id)));
  if (!s) throw new AuthorizationError("Not found.");
  return s;
}

/** +1 / −1 (or any amount) on a supply. */
export async function adjustBabySupply(fd: FormData) {
  const viewer = await requireModule("baby", "use");
  const s = await supplyFor(viewer, fd.get("id"));
  const delta = Number(fd.get("delta"));
  if (!Number.isFinite(delta)) return;
  const next = Math.max(0, Number(s.quantity) + delta);
  await db.update(babySupplies).set({ quantity: String(next) }).where(eq(babySupplies.id, s.id));
  await lowStockCheck(viewer, s, Number(s.quantity), next);
  revalidateBaby();
}

/** Breast milk: used, thawed (moves to "thawed" with 24 hours left) or thrown out. */
export async function markMilk(fd: FormData) {
  const viewer = await requireModule("baby", "use");
  const s = await supplyFor(viewer, fd.get("id"));
  if (s.kind !== "milk") return;
  if (fd.get("op") === "thaw") await db.update(babySupplies).set({ location: "thawed", expiresOn: milkExpiry("thawed", new Date()).toISOString().slice(0, 10) }).where(eq(babySupplies.id, s.id));
  else await db.update(babySupplies).set({ usedAt: new Date(), notes: fd.get("op") === "discard" ? "Thrown out" : s.notes }).where(eq(babySupplies.id, s.id));
  revalidateBaby();
}

export async function deleteBabySupply(fd: FormData) {
  const viewer = await requireModule("baby", "use");
  const s = await supplyFor(viewer, fd.get("id"));
  if (!viewer.can("baby", "edit") && !canChangeItem(viewer, s.createdByMemberId)) throw new AuthorizationError("Only a parent (or whoever added it) can delete this.");
  await db.delete(babySupplies).where(eq(babySupplies.id, s.id));
  revalidateBaby();
}

/** Everything running low → the shopping list. */
export async function babySuppliesToShopping() {
  const viewer = await requireModule("baby", "use");
  if (!viewer.can("shopping", "add")) throw new AuthorizationError("You can't add to the shopping list.");
  const low = (await db.select().from(babySupplies).where(and(eq(babySupplies.familyId, viewer.family.id), isNull(babySupplies.usedAt), sql`${babySupplies.lowAt} is not null and ${babySupplies.quantity} <= ${babySupplies.lowAt}`))).filter((s) => s.kind !== "milk");
  if (!low.length) return;
  const listId = await mainShoppingListId(viewer.family.id);
  const have = new Set((await db.select({ s: listItems.sourceId }).from(listItems).where(and(eq(listItems.listId, listId), eq(listItems.checked, false), inArray(listItems.sourceId, low.map((l) => l.id))))).map((r) => r.s));
  const rows = low.filter((l) => !have.has(l.id)).map((l, i) => ({ listId, text: l.name, shoppingCategory: "household" as const, sourceId: l.id, addedByMemberId: viewer.member.id, notes: "Baby supplies", position: 1000 + i }));
  if (rows.length) await db.insert(listItems).values(rows);
  revalidatePath("/shopping", "layout");
  revalidateBaby();
}

// ─── Reminders ──────────────────────────────────────────────────────────────

const REMINDER_KINDS = ["feed", "nap", "medicine", "diaper", "appointment", "pumping", "potty", "custom"] as const;

export async function saveBabyReminder(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("baby", "use");
    const b = await babyFor(viewer, String(fd.get("babyId")));
    const id = f.str(fd, "id");
    const [old] = id ? await db.select().from(babyReminders).where(and(eq(babyReminders.id, id), eq(babyReminders.babyId, b.id))) : [];
    if (id && !old) throw new AuthorizationError("Not found.");
    if (old && !viewer.can("baby", "edit") && !canChangeItem(viewer, old.createdByMemberId)) throw new AuthorizationError("Only a parent (or whoever set it) can change this reminder.");
    const kind = pick(fd.get("kind"), REMINDER_KINDS) ?? "custom";
    const mode = pick(fd.get("mode"), ["interval", "time", "once", "wake"] as const) ?? "time";
    const title = f.str(fd, "title") ?? { feed: "Feed time", nap: "Nap time", medicine: "Medicine", diaper: "Diaper check", appointment: "Appointment", pumping: "Time to pump", potty: "Potty break", custom: "Reminder" }[kind];
    const tz = viewer.family.timezone;
    const interval = f.int(fd, "intervalHours") !== null || f.num(fd, "intervalHours") !== null ? Math.round((f.num(fd, "intervalHours") ?? 0) * 60) : null;
    if (mode === "interval" && (!interval || interval < 15 || interval > 24 * 60)) return fail("Choose between 15 minutes and 24 hours.", "intervalHours");
    const time = hhmm(fd.get("time"));
    if (mode === "time" && !time) return fail("What time?", "time");
    const onceDate = f.date(fd, "date");
    const at = mode === "once" ? (onceDate && time ? zonedToUtc(onceDate, time, tz) : null) : null;
    if (mode === "once" && !at) return fail("Pick a date and time.", "date");
    const members = f.list(fd, "memberIds");
    const memberRows = members.length ? await db.select({ id: familyMembers.id }).from(familyMembers).where(and(eq(familyMembers.familyId, viewer.family.id), inArray(familyMembers.id, members))) : [];
    const values = {
      kind,
      mode,
      title: title.slice(0, 80),
      intervalMinutes: mode === "interval" ? interval : null,
      time: mode === "time" || mode === "once" ? time : null,
      days: mode === "time" ? f.list(fd, "days").map(Number).filter((d) => d >= 0 && d <= 6) : [],
      at,
      memberIds: memberRows.map((m) => m.id),
      enabled: true,
      lastSentAt: null,
    };
    if (old) await db.update(babyReminders).set(values).where(eq(babyReminders.id, old.id));
    else await db.insert(babyReminders).values({ ...values, familyId: viewer.family.id, babyId: b.id, createdByMemberId: viewer.member.id });
    revalidateBaby(b.id);
    return ok("Reminder saved.");
  });
}

async function reminderFor(viewer: Viewer, id: unknown) {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw new AuthorizationError("Not found.");
  const [r] = await db.select().from(babyReminders).where(and(eq(babyReminders.id, id), eq(babyReminders.familyId, viewer.family.id)));
  if (!r) throw new AuthorizationError("Not found.");
  if (!viewer.can("baby", "edit") && !canChangeItem(viewer, r.createdByMemberId)) throw new AuthorizationError("Only a parent (or whoever set it) can change this reminder.");
  return r;
}

export async function toggleBabyReminder(fd: FormData) {
  const viewer = await requireModule("baby", "use");
  const r = await reminderFor(viewer, fd.get("id"));
  await db.update(babyReminders).set({ enabled: !r.enabled }).where(eq(babyReminders.id, r.id));
  revalidateBaby(r.babyId);
}

export async function deleteBabyReminder(fd: FormData) {
  const viewer = await requireModule("baby", "use");
  const r = await reminderFor(viewer, fd.get("id"));
  await db.delete(babyReminders).where(eq(babyReminders.id, r.id));
  revalidateBaby(r.babyId);
}
