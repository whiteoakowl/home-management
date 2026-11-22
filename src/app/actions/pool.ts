"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { chores, poolAdditions, poolEquipment, pools, poolTests } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { AuthorizationError, requireModule, type Viewer } from "@/lib/dal";
import { todayIn, zonedToUtc } from "@/lib/dates";
import { recordExpense } from "@/lib/expenses";
import { logActivity } from "@/lib/family";
import { deleteFamilyFile, saveUpload } from "@/lib/files";
import { materializeChore } from "@/lib/automation";
import { CHLORINE_PRODUCTS, suggestedRoutine, type ChlorineProduct } from "@/lib/pool";
import { f, upsertRule } from "@/lib/records";

/**
 * Pool & spa. Permissions (Pool area):
 *  - Use: log water tests and chemicals added (and change/delete their own)
 *  - Add & edit: pools, equipment, the maintenance routine, anyone's entries
 */
const UUID = /^[0-9a-f-]{36}$/i;
function revalidatePool() {
  revalidatePath("/pool", "layout");
  revalidatePath("/");
}

async function ownPool(viewer: Viewer, id: string | null) {
  if (!id || !UUID.test(id)) throw new AuthorizationError("Pool not found.");
  const [p] = await db.select().from(pools).where(and(eq(pools.id, id), eq(pools.familyId, viewer.family.id)));
  if (!p) throw new AuthorizationError("Pool not found.");
  return p;
}

const KINDS = ["pool", "spa"] as const;
const SANITIZERS = ["chlorine", "salt", "bromine"] as const;
const SURFACES = ["plaster", "vinyl", "fiberglass"] as const;
const pick = <T extends string>(v: string | null, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);

export async function savePool(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("pool", "edit");
    const name = f.str(fd, "name");
    if (!name) return fail("Name it (e.g. Backyard pool, Hot tub).", "name");
    const gallons = f.int(fd, "gallons");
    if (!gallons || gallons < 50 || gallons > 1_000_000) return fail("Enter the volume in gallons.", "gallons");
    const product = f.str(fd, "chlorineProduct") as ChlorineProduct;
    const values = {
      familyId: viewer.family.id,
      name: name.slice(0, 80),
      kind: pick(f.str(fd, "kind"), KINDS, "pool"),
      gallons,
      sanitizer: pick(f.str(fd, "sanitizer"), SANITIZERS, "chlorine"),
      surface: pick(f.str(fd, "surface"), SURFACES, "plaster"),
      chlorineProduct: product in CHLORINE_PRODUCTS ? product : "liquid10",
      saltTarget: f.int(fd, "saltTarget"),
      filterType: f.str(fd, "filterType"),
      isOpen: fd.get("isOpen") !== "closed",
      notes: f.str(fd, "notes"),
    };
    const id = f.str(fd, "id");
    if (id) {
      const p = await ownPool(viewer, id);
      await db.update(pools).set(values).where(eq(pools.id, p.id));
      revalidatePool();
      return ok("Saved.");
    }
    const [p] = await db.insert(pools).values({ ...values, createdByMemberId: viewer.member.id }).returning({ id: pools.id });
    revalidatePool();
    redirect(`/pool?pool=${p!.id}`);
  });
}

export async function deletePool(fd: FormData) {
  const viewer = await requireModule("pool", "edit");
  const p = await ownPool(viewer, String(fd.get("id")));
  await db.delete(chores).where(and(eq(chores.familyId, viewer.family.id), eq(chores.poolId, p.id)));
  await db.delete(pools).where(eq(pools.id, p.id));
  revalidatePool();
  redirect("/pool");
}

const READINGS = ["fc", "cc", "ph", "ta", "ch", "cya", "salt", "tempF", "phosphates"] as const;
const LIMITS: Record<(typeof READINGS)[number], [number, number]> = { fc: [0, 50], cc: [0, 20], ph: [6, 9], ta: [0, 400], ch: [0, 2000], cya: [0, 300], salt: [0, 10000], tempF: [32, 115], phosphates: [0, 10000] };

/** Water test (Use access). */
export async function saveTest(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("pool", "use");
    const p = await ownPool(viewer, f.str(fd, "poolId"));
    const values: Record<string, number | null> = {};
    for (const k of READINGS) {
      const v = f.num(fd, k);
      if (v === null) values[k] = null;
      else if (v < LIMITS[k][0] || v > LIMITS[k][1]) return fail(`That ${k === "tempF" ? "temperature" : k.toUpperCase()} reading looks off. Check it and try again.`, k);
      else values[k] = v;
    }
    if (READINGS.every((k) => values[k] === null)) return fail("Enter at least one reading.");
    const date = f.date(fd, "date") ?? todayIn(viewer.family.timezone);
    const time = /^\d{2}:\d{2}$/.test(String(fd.get("time") ?? "")) ? String(fd.get("time")) : null;
    const testedAt = date === todayIn(viewer.family.timezone) && !time ? new Date() : zonedToUtc(date, time ?? "12:00", viewer.family.timezone);
    const photo = await saveUpload(viewer, fd.get("photo"));
    const id = f.str(fd, "id");
    if (id) {
      const old = await ownEntry(viewer, poolTests, id, "testedByMemberId");
      await db.update(poolTests).set({ ...values, notes: f.str(fd, "notes"), testedAt, ...(photo ? { photoFileId: photo } : {}) }).where(eq(poolTests.id, old.id));
      if (photo && old.photoFileId) await deleteFamilyFile(viewer.family.id, old.photoFileId);
    } else {
      await db.insert(poolTests).values({ familyId: viewer.family.id, poolId: p.id, ...values, notes: f.str(fd, "notes"), testedAt, photoFileId: photo, testedByMemberId: viewer.member.id });
      await logActivity(db, viewer.family.id, viewer.member.id, "pool.tested", `tested the ${p.name} water`, { module: "pool", entityId: p.id });
    }
    revalidatePool();
    return ok("Test saved.");
  });
}

async function ownEntry<T extends typeof poolTests | typeof poolAdditions>(viewer: Viewer, table: T, id: string, byCol: "testedByMemberId" | "addedByMemberId") {
  if (!UUID.test(id)) throw new AuthorizationError("Not found.");
  const [row] = (await db.select().from(table as typeof poolTests).where(and(eq((table as typeof poolTests).id, id), eq((table as typeof poolTests).familyId, viewer.family.id)))) as unknown as (Record<string, unknown> & { id: string; photoFileId?: string | null })[];
  if (!row) throw new AuthorizationError("Not found.");
  // Anyone with Add & edit, or the person who logged it.
  if (!viewer.can("pool", "edit") && row[byCol] !== viewer.member.id) throw new AuthorizationError("You can only change what you logged.");
  return row;
}

export async function deleteTest(fd: FormData) {
  const viewer = await requireModule("pool", "use");
  const row = await ownEntry(viewer, poolTests, String(fd.get("id")), "testedByMemberId");
  await db.delete(poolTests).where(eq(poolTests.id, row.id));
  if (row.photoFileId) await deleteFamilyFile(viewer.family.id, row.photoFileId);
  revalidatePool();
}

/** Chemical added (Use access). Optionally records the cost in the family budget. */
export async function saveAddition(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("pool", "use");
    const p = await ownPool(viewer, f.str(fd, "poolId"));
    const chemical = f.str(fd, "chemical");
    if (!chemical) return fail("What did you add?", "chemical");
    const date = f.date(fd, "date") ?? todayIn(viewer.family.timezone);
    const costCents = f.cents(fd, "cost");
    const values = { chemical: chemical.slice(0, 80), amount: f.str(fd, "amount")?.slice(0, 40) ?? null, date, costCents: costCents && costCents > 0 ? costCents : null, notes: f.str(fd, "notes") };
    const id = f.str(fd, "id");
    if (id) {
      const old = await ownEntry(viewer, poolAdditions, id, "addedByMemberId");
      await db.update(poolAdditions).set(values).where(eq(poolAdditions.id, old.id));
    } else {
      await db.insert(poolAdditions).values({ familyId: viewer.family.id, poolId: p.id, ...values, addedByMemberId: viewer.member.id });
      if (values.costCents && f.bool(fd, "addToBudget") && viewer.can("budget", "edit")) {
        await recordExpense(viewer, { name: `${p.name}: ${values.chemical}`, amountCents: values.costCents, date, categoryName: "Pool" });
        revalidatePath("/budget", "layout");
      }
    }
    revalidatePool();
    return ok("Saved.");
  });
}

export async function deleteAddition(fd: FormData) {
  const viewer = await requireModule("pool", "use");
  const row = await ownEntry(viewer, poolAdditions, String(fd.get("id")), "addedByMemberId");
  await db.delete(poolAdditions).where(eq(poolAdditions.id, row.id));
  revalidatePool();
}

export async function saveEquipment(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("pool", "edit");
    const p = await ownPool(viewer, f.str(fd, "poolId"));
    const name = f.str(fd, "name");
    if (!name) return fail("Name the equipment.", "name");
    const values = {
      name: name.slice(0, 80),
      kind: f.str(fd, "kind") ?? "other",
      model: f.str(fd, "model"),
      installedOn: f.date(fd, "installedOn"),
      lastServicedOn: f.date(fd, "lastServicedOn"),
      serviceEveryMonths: f.int(fd, "serviceEveryMonths"),
      notes: f.str(fd, "notes"),
    };
    const id = f.str(fd, "id");
    if (id) await db.update(poolEquipment).set(values).where(and(eq(poolEquipment.id, id), eq(poolEquipment.familyId, viewer.family.id), eq(poolEquipment.poolId, p.id)));
    else await db.insert(poolEquipment).values({ familyId: viewer.family.id, poolId: p.id, ...values });
    revalidatePool();
    return ok("Saved.");
  });
}

export async function markServiced(fd: FormData) {
  const viewer = await requireModule("pool", "use");
  await db.update(poolEquipment).set({ lastServicedOn: todayIn(viewer.family.timezone) }).where(and(eq(poolEquipment.id, String(fd.get("id"))), eq(poolEquipment.familyId, viewer.family.id)));
  revalidatePool();
}

export async function deleteEquipment(fd: FormData) {
  const viewer = await requireModule("pool", "edit");
  await db.delete(poolEquipment).where(and(eq(poolEquipment.id, String(fd.get("id"))), eq(poolEquipment.familyId, viewer.family.id)));
  revalidatePool();
}

/** One tap: the recommended routine as repeating chores (they earn points and show under Chores). */
export async function setupPoolRoutine(fd: FormData) {
  const viewer = await requireModule("pool", "edit");
  if (!viewer.can("chores", "edit")) throw new AuthorizationError("You need Chores access to create chores.");
  const p = await ownPool(viewer, String(fd.get("poolId")));
  const today = todayIn(viewer.family.timezone);
  const existing = new Set((await db.select({ title: chores.title }).from(chores).where(and(eq(chores.familyId, viewer.family.id), eq(chores.poolId, p.id)))).map((c) => c.title));
  for (const r of suggestedRoutine(p.kind, p.sanitizer)) {
    if (existing.has(r.title)) continue;
    const ruleId = await upsertRule(db, viewer.family.id, { freq: r.freq, interval: 1, byWeekday: r.byWeekday ?? undefined, startsOn: today });
    const [c] = await db
      .insert(chores)
      .values({ familyId: viewer.family.id, kind: "chore", title: r.title, instructions: r.instructions, estimatedMinutes: r.minutes, points: r.points, recurrenceRuleId: ruleId, poolId: p.id, createdByMemberId: viewer.member.id })
      .returning({ id: chores.id });
    await materializeChore(c!.id, today);
  }
  revalidatePool();
  revalidatePath("/house", "layout");
}
