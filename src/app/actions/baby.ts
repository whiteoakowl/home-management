"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { babies, babyLogs, babySchedule, familyMembers } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { BABY_KINDS, LOG_KINDS, SCHEDULE_KINDS, SCHEDULE_PRESETS, TIMER_KINDS, type BabyLogKind } from "@/lib/baby-kinds";
import { canChangeLog, canManageBaby, getBaby } from "@/lib/baby";
import { AuthorizationError, requireModule, type Viewer } from "@/lib/dal";
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
      d.rash = f.bool(fd, "rash");
      break;
    case "sleep":
      d.where = pick(fd.get("where"), ["crib", "bassinet", "bed", "arms", "car", "stroller", "other"] as const);
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
    if (startedAt.getTime() > Date.now() + 5 * 60_000 && kind !== "doctor" && kind !== "vaccine") return fail("That time is in the future.", "time");
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
    if (["medicine", "vaccine", "milestone", "symptom", "activity", "teeth"].includes(kind) && !data.title) return fail("Add a name.", "title");
    if (kind === "note" && !f.str(fd, "notes")) return fail("Write the note.", "notes");
    const image = await saveUpload(viewer, fd.get("image"));
    const values = { kind, startedAt, endedAt, amount: amount !== null ? String(amount) : null, data, notes: f.str(fd, "notes"), ...(image ? { imageFileId: image } : {}) };
    if (old) {
      await db.update(babyLogs).set(values).where(eq(babyLogs.id, old.id));
      if (image && old.imageFileId) await deleteFamilyFile(viewer.family.id, old.imageFileId);
    } else await db.insert(babyLogs).values({ ...values, familyId: viewer.family.id, babyId: b.id, createdByMemberId: viewer.member.id });
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
  await db.insert(babyLogs).values({ familyId: viewer.family.id, babyId: b.id, kind, startedAt: new Date(), data, createdByMemberId: viewer.member.id });
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
