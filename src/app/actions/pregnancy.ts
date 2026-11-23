"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, max } from "drizzle-orm";
import { db } from "@/db";
import { babies, babyLogs, calendarEvents, eventAttendees, familyMembers, pregnancies, pregnancyAppointments, pregnancyEntries, pregnancyItems, pregnancyLogs, pregnancyWeekContent, recordAccess, type PregnancyLogKind } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { requirePlatformAdmin } from "@/app/actions/admin";
import { AuthorizationError, PREMIUM_MESSAGE, requireModule, type Viewer } from "@/lib/dal";
import { todayIn, zonedToUtc } from "@/lib/dates";
import { addMember } from "@/lib/family";
import { deleteFamilyFile, saveUpload } from "@/lib/files";
import { APPOINTMENT_KINDS, BIRTH_PLAN_SECTIONS, CHECKLISTS, ITEM_STATUSES, MEASURES, QUESTION_CATEGORIES } from "@/lib/pregnancy/catalog";
import { checkDates, estimateDueDate, weekOn, type Contraction } from "@/lib/pregnancy/dates";
import { editablePregnancy, isUuid, type Pregnancy } from "@/lib/pregnancy/data";
import { pregnancyFeature, type PregnancyFeature } from "@/lib/pregnancy/features";
import { f, visibilityFromForm } from "@/lib/records";

/**
 * Pregnancy Tracker. Every action re-checks on the server: the module
 * permission, the family, that the viewer may see the pregnancy, and that
 * they may change it (the pregnant person, whoever set it up, or people it's
 * shared with "can edit"). Premium features are checked through
 * lib/pregnancy/features.ts.
 */
const revalidate = (id?: string) => {
  revalidatePath("/pregnancy", "layout");
  if (id) revalidatePath(`/pregnancy/${id}`, "layout");
  revalidatePath("/calendar", "layout");
  revalidatePath("/");
};

const feature = (viewer: Viewer, k: PregnancyFeature) => {
  if (!pregnancyFeature(viewer, k)) throw new AuthorizationError(PREMIUM_MESSAGE);
};
const hhmm = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "");
  return /^([01]\d|2[0-3]):[0-5]\d/.test(s) ? s.slice(0, 5) : null;
};
const cap = (s: string | null, n: number) => (s ? s.slice(0, n) : null);
const pick = <T extends string>(v: FormDataEntryValue | null, opts: readonly T[]) => opts.find((o) => o === v) ?? null;
const pregnancyViewer = () => requireModule("pregnancy", "use");

/** Mirror the pregnancy's sharing onto its calendar appointments. */
async function shareEvents(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], p: { id: string; familyId: string; memberId: string; visibility: Pregnancy["visibility"] }, shared: string[]) {
  const evs = await tx.select({ eventId: pregnancyAppointments.eventId }).from(pregnancyAppointments).where(eq(pregnancyAppointments.pregnancyId, p.id));
  if (!evs.length) return;
  const ids = evs.map((e) => e.eventId);
  await tx.update(calendarEvents).set({ visibility: p.visibility }).where(inArray(calendarEvents.id, ids));
  await tx.delete(recordAccess).where(and(eq(recordAccess.entityType, "event"), inArray(recordAccess.entityId, ids)));
  const who = [...new Set([p.memberId, ...(p.visibility === "selected" ? shared : [])])];
  await tx.insert(recordAccess).values(ids.flatMap((eventId) => who.map((memberId) => ({ familyId: p.familyId, entityType: "event" as const, entityId: eventId, memberId }))));
}

// ─── Setup & settings ───────────────────────────────────────────────────────

export async function savePregnancy(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await pregnancyViewer();
    const id = f.str(fd, "id");
    const old = id ? await editablePregnancy(viewer, id) : null;
    const today = todayIn(viewer.family.timezone);
    // Whose pregnancy: yourself, or (parents) another family member.
    const wanted = f.str(fd, "memberId");
    let memberId = old?.memberId ?? viewer.member.id;
    if (!old && wanted && wanted !== viewer.member.id) {
      if (!viewer.isParent) throw new AuthorizationError("You can only start a pregnancy for yourself.");
      const [m] = isUuid(wanted) ? await db.select({ id: familyMembers.id }).from(familyMembers).where(and(eq(familyMembers.id, wanted), eq(familyMembers.familyId, viewer.family.id))) : [];
      if (!m) return fail("Choose someone in your family.", "memberId");
      memberId = m.id;
    }
    const embryo = f.int(fd, "embryoDays");
    const inputs = { due: f.date(fd, "dueDate"), lmp: f.date(fd, "lmpDate"), conception: f.date(fd, "conceptionDate"), ivfTransfer: f.date(fd, "ivfTransfer"), embryoDays: embryo };
    const bad = checkDates(inputs, today);
    if (bad) return fail(bad, "dueDate");
    const est = estimateDueDate(inputs);
    if (!est) return fail("Add a due date, the first day of your last period, a conception date or an IVF transfer date.", "dueDate");
    const count = Math.min(8, Math.max(1, f.int(fd, "babyCount") ?? 1));
    const { visibility, memberIds } = visibilityFromForm(fd);
    const letEdit = f.bool(fd, "letEdit");
    const values = {
      nickname: cap(f.str(fd, "nickname"), 80),
      babyNickname: cap(f.str(fd, "babyNickname"), 80),
      babySex: pick(fd.get("babySex"), ["girl", "boy", "unknown", "surprise", "mixed"] as const) ?? "unknown",
      dueDate: est.due,
      lmpDate: inputs.lmp,
      conceptionDate: inputs.conception,
      dueSource: f.bool(fd, "dueFromUltrasound") && est.source === "due" ? ("ultrasound" as const) : est.source,
      ivf: inputs.ivfTransfer ? { transferDate: inputs.ivfTransfer, embryoDays: embryo, notes: cap(f.str(fd, "ivfNotes"), 500) } : null,
      pregnancyNumber: f.int(fd, "pregnancyNumber"),
      previousPregnancies: cap(f.str(fd, "previousPregnancies"), 1000),
      babyCount: count,
      provider: cap(f.str(fd, "provider"), 120),
      providerPhone: cap(f.str(fd, "providerPhone"), 40),
      providerEmail: cap(f.str(fd, "providerEmail"), 120),
      providerAddress: cap(f.str(fd, "providerAddress"), 200),
      hospital: cap(f.str(fd, "hospital"), 200),
      birthLocation: cap(f.str(fd, "birthLocation"), 200),
      notes: cap(f.str(fd, "notes"), 4000),
      visibility,
    };
    let pid = id;
    await db.transaction(async (tx) => {
      if (old) await tx.update(pregnancies).set(values).where(eq(pregnancies.id, old.id));
      else pid = (await tx.insert(pregnancies).values({ ...values, familyId: viewer.family.id, memberId, createdByMemberId: viewer.member.id }).returning({ id: pregnancies.id }))[0]!.id;
      // Who it's shared with ("Selected people"), and whether they may edit.
      await tx.delete(recordAccess).where(and(eq(recordAccess.entityType, "pregnancy"), eq(recordAccess.entityId, pid!)));
      const shared = visibility === "selected" ? memberIds.filter((m) => m !== memberId) : [];
      if (shared.length) {
        const valid = await tx.select({ id: familyMembers.id }).from(familyMembers).where(and(eq(familyMembers.familyId, viewer.family.id), inArray(familyMembers.id, shared)));
        if (valid.length) await tx.insert(recordAccess).values(valid.map((m) => ({ familyId: viewer.family.id, entityType: "pregnancy" as const, entityId: pid!, memberId: m.id, canEdit: letEdit })));
      }
      await shareEvents(tx, { id: pid!, familyId: viewer.family.id, memberId, visibility }, shared);
    });
    revalidate(pid!);
    if (!id) redirect(`/pregnancy/${pid}`);
    return ok("Saved.");
  });
}

/** Pause, archive, mark completed or continue tracking. (Babies born: recordBirth.) */
export async function setPregnancyStatus(fd: FormData) {
  const viewer = await pregnancyViewer();
  const p = await editablePregnancy(viewer, fd.get("id"));
  const status = pick(fd.get("status"), ["active", "paused", "archived", "completed"] as const);
  if (!status) return;
  await db
    .update(pregnancies)
    .set({ status, endedOn: status === "completed" ? (f.date(fd, "endedOn") ?? todayIn(viewer.family.timezone)) : status === "active" ? null : p.endedOn })
    .where(eq(pregnancies.id, p.id));
  revalidate(p.id);
}

/**
 * The baby (or babies) arrived. Saves the birth details and, if asked (and
 * allowed), adds each baby to the family and starts their Baby tracker with
 * the birth weight and length. The pregnancy and its history are kept.
 */
export async function recordBirth(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await pregnancyViewer();
    const p = await editablePregnancy(viewer, fd.get("id"));
    const date = f.date(fd, "date");
    if (!date) return fail("What day was the birth?", "date");
    if (date > todayIn(viewer.family.timezone)) return fail("The birth date can't be in the future.", "date");
    const names = String(fd.get("names") ?? "")
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, Math.max(1, p.babyCount));
    const outcome = {
      date,
      time: hhmm(fd.get("time")),
      location: cap(f.str(fd, "location"), 200),
      weight: cap(f.str(fd, "weight"), 40),
      length: cap(f.str(fd, "length"), 40),
      notes: cap(f.str(fd, "notes"), 2000),
      memberIds: [] as string[],
      babyIds: [] as string[],
    };
    const addFamily = f.bool(fd, "addToFamily");
    if (addFamily && !viewer.isParent) return fail("Only a parent can add someone to the family. Save the birth now and ask a parent to add the baby.", "addToFamily");
    if (addFamily && !names.length) return fail("Add the baby's name to add them to the family.", "names");
    if (addFamily) {
      for (const name of names) {
        const m = await addMember({ familyId: viewer.family.id, actorMemberId: viewer.member.id, displayName: name.slice(0, 60), role: "member", birthday: date });
        outcome.memberIds.push(m.id);
        if (viewer.can("baby", "use")) {
          const unitKg = /kg|g\b/i.test(outcome.weight ?? "");
          const [b] = await db
            .insert(babies)
            .values({ familyId: viewer.family.id, memberId: m.id, name: name.slice(0, 80), birthDate: date, weightUnit: unitKg ? "kg" : "lb", notes: outcome.notes, createdByMemberId: viewer.member.id })
            .returning({ id: babies.id });
          outcome.babyIds.push(b!.id);
          const wNum = Number((outcome.weight ?? "").replace(/[^\d.]/g, ""));
          const lNum = Number((outcome.length ?? "").replace(/[^\d.]/g, ""));
          if (wNum || lNum) {
            const at = zonedToUtc(date, outcome.time ?? "12:00", viewer.family.timezone);
            await db.insert(babyLogs).values({
              familyId: viewer.family.id,
              babyId: b!.id,
              kind: "growth",
              startedAt: at,
              amount: wNum ? String(wNum) : null,
              data: { height: lNum || null, lengthUnit: /cm/i.test(outcome.length ?? "") ? "cm" : "in", title: "Birth" },
              notes: "Birth measurements",
              createdByMemberId: viewer.member.id,
            });
          }
        }
      }
    }
    await db.update(pregnancies).set({ status: "born", endedOn: date, outcome }).where(eq(pregnancies.id, p.id));
    revalidate(p.id);
    revalidatePath("/family");
    revalidatePath("/baby", "layout");
    return ok(addFamily ? `Welcome, ${names.join(" & ")}! Added to your family${outcome.babyIds.length ? " and the Baby tracker" : ""}.` : "Birth details saved. Congratulations!");
  });
}

/** Permanently delete a pregnancy (the pregnant person or whoever set it up), with its appointments and files. */
export async function deletePregnancy(fd: FormData) {
  const viewer = await pregnancyViewer();
  const p = await editablePregnancy(viewer, fd.get("id"));
  if (p.memberId !== viewer.member.id && p.createdByMemberId !== viewer.member.id) throw new AuthorizationError("Only the person who's pregnant (or whoever set this up) can delete it.");
  const [appts, entries] = await Promise.all([
    db.select({ eventId: pregnancyAppointments.eventId }).from(pregnancyAppointments).where(eq(pregnancyAppointments.pregnancyId, p.id)),
    db.select({ fileId: pregnancyEntries.fileId }).from(pregnancyEntries).where(eq(pregnancyEntries.pregnancyId, p.id)),
  ]);
  await db.transaction(async (tx) => {
    if (appts.length) await tx.delete(calendarEvents).where(and(inArray(calendarEvents.id, appts.map((a) => a.eventId)), eq(calendarEvents.familyId, viewer.family.id)));
    await tx.delete(recordAccess).where(and(eq(recordAccess.entityType, "pregnancy"), eq(recordAccess.entityId, p.id)));
    await tx.delete(pregnancies).where(eq(pregnancies.id, p.id));
  });
  for (const e of entries) if (e.fileId) await deleteFamilyFile(viewer.family.id, e.fileId);
  revalidate();
  redirect("/pregnancy");
}

export async function saveReminders(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await pregnancyViewer();
    const p = await editablePregnancy(viewer, fd.get("id"));
    feature(viewer, "reminders");
    await db
      .update(pregnancies)
      .set({ reminders: { kicks: hhmm(fd.get("kicks")), journal: hhmm(fd.get("journal")), hydration: f.bool(fd, "hydration"), weekly: f.bool(fd, "weekly"), prep: f.bool(fd, "prep"), questions: f.bool(fd, "questions") } })
      .where(eq(pregnancies.id, p.id));
    revalidate(p.id);
    return ok("Reminders saved.");
  });
}

export async function saveBirthPlan(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await pregnancyViewer();
    const p = await editablePregnancy(viewer, fd.get("id"));
    feature(viewer, "birthPlan");
    const plan: Record<string, string> = {};
    for (const s of BIRTH_PLAN_SECTIONS) {
      const v = f.str(fd, `bp_${s.key}`);
      if (v) plan[s.key] = v.slice(0, 3000);
    }
    await db.update(pregnancies).set({ birthPlan: plan }).where(eq(pregnancies.id, p.id));
    revalidate(p.id);
    return ok("Birth preferences saved.");
  });
}

// ─── Logs (symptoms, mood, weight, measurements, water, meals, sleep, doses) ─

const LOG_FEATURE: Record<PregnancyLogKind, PregnancyFeature> = { symptom: "symptoms", mood: "mood", weight: "weight", measure: "measurements", kicks: "kicks", contractions: "contractions", hydration: "nutrition", meal: "nutrition", sleep: "sleep", dose: "medications" };

export async function savePregnancyLog(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await pregnancyViewer();
    const p = await editablePregnancy(viewer, fd.get("pregnancyId"));
    const kind = pick(fd.get("kind"), ["symptom", "mood", "weight", "measure", "hydration", "meal", "sleep", "dose"] as const);
    if (!kind) return fail("What are you logging?");
    feature(viewer, LOG_FEATURE[kind]);
    const tz = viewer.family.timezone;
    const date = f.date(fd, "date") ?? todayIn(tz);
    const time = hhmm(fd.get("time")) ?? "12:00";
    const startedAt = zonedToUtc(date, time, tz);
    if (startedAt.getTime() > Date.now() + 10 * 60_000) return fail("That time is in the future.", "time");
    const data: Record<string, unknown> = {};
    let amount: number | null = null;
    let endedAt: Date | null = null;
    switch (kind) {
      case "symptom": {
        const name = cap(f.str(fd, "symptom") ?? f.str(fd, "custom"), 80);
        if (!name) return fail("Which symptom?", "symptom");
        data.symptom = name;
        data.severity = Math.min(4, Math.max(1, f.int(fd, "severity") ?? 1));
        const minutes = f.int(fd, "minutes");
        if (minutes !== null && minutes > 0) endedAt = new Date(startedAt.getTime() + Math.min(minutes, 60 * 72) * 60_000);
        break;
      }
      case "mood": {
        for (const k of ["mood", "energy", "stress", "sleepQuality"]) {
          const n = f.int(fd, k);
          if (n !== null && n >= 1 && n <= 5) data[k] = n;
        }
        if (!Object.keys(data).length && !f.str(fd, "notes")) return fail("Pick how you're feeling.", "mood");
        break;
      }
      case "weight": {
        amount = f.num(fd, "amount");
        if (amount === null || amount <= 0 || amount > 1000) return fail("Enter your weight.", "amount");
        data.unit = fd.get("unit") === "kg" ? "kg" : "lb";
        break;
      }
      case "measure": {
        const type = MEASURES.find((m) => m.value === fd.get("type"))?.value ?? "other";
        data.type = type;
        if (type === "bp") {
          const sys = f.int(fd, "systolic");
          const dia = f.int(fd, "diastolic");
          if (!sys || !dia || sys < 50 || sys > 260 || dia < 30 || dia > 180) return fail("Enter both numbers (like 118 / 76).", "systolic");
          data.systolic = sys;
          data.diastolic = dia;
          const pulse = f.int(fd, "pulse");
          if (pulse) data.pulse = pulse;
        } else {
          amount = f.num(fd, "amount");
          if (amount === null) return fail("Enter the reading.", "amount");
          data.label = cap(f.str(fd, "label"), 60);
          data.unit = cap(f.str(fd, "unit"), 20);
        }
        break;
      }
      case "hydration": {
        amount = f.num(fd, "amount") ?? 1;
        if (amount <= 0 || amount > 50) return fail("How many glasses?", "amount");
        break;
      }
      case "meal": {
        const what = cap(f.str(fd, "what"), 300);
        if (!what) return fail("What did you have?", "what");
        data.what = what;
        data.type = pick(fd.get("type"), ["breakfast", "lunch", "dinner", "snack"] as const) ?? "snack";
        break;
      }
      case "sleep": {
        const bed = hhmm(fd.get("bed"));
        const wake = hhmm(fd.get("wake"));
        if (!bed || !wake) return fail("Add when you went to bed and woke up.", "bed");
        const wakeDate = f.date(fd, "date") ?? todayIn(tz);
        endedAt = zonedToUtc(wakeDate, wake, tz);
        let start = zonedToUtc(wakeDate, bed, tz);
        if (start >= endedAt) start = new Date(start.getTime() - 86_400_000);
        data.quality = Math.min(5, Math.max(1, f.int(fd, "quality") ?? 3));
        data.wakeUps = Math.max(0, f.int(fd, "wakeUps") ?? 0);
        await db.insert(pregnancyLogs).values({ familyId: viewer.family.id, pregnancyId: p.id, kind, startedAt: start, endedAt, data, notes: cap(f.str(fd, "notes"), 2000), createdByMemberId: viewer.member.id });
        revalidate(p.id);
        return ok("Sleep saved.");
      }
      case "dose": {
        const itemId = f.str(fd, "itemId");
        const [it] = isUuid(itemId) ? await db.select().from(pregnancyItems).where(and(eq(pregnancyItems.id, itemId), eq(pregnancyItems.pregnancyId, p.id), eq(pregnancyItems.kind, "medication"))) : [];
        if (!it) return fail("Which medicine?");
        data.itemId = it.id;
        data.name = it.title;
        break;
      }
    }
    const id = f.str(fd, "id");
    const values = { kind, startedAt, endedAt, amount: amount !== null ? String(amount) : null, data, notes: cap(f.str(fd, "notes"), 2000) };
    if (id) {
      const res = await db.update(pregnancyLogs).set(values).where(and(eq(pregnancyLogs.id, id), eq(pregnancyLogs.pregnancyId, p.id))).returning({ id: pregnancyLogs.id });
      if (!res.length) throw new AuthorizationError("Not found.");
    } else await db.insert(pregnancyLogs).values({ ...values, familyId: viewer.family.id, pregnancyId: p.id, createdByMemberId: viewer.member.id });
    revalidate(p.id);
    return ok("Saved.");
  });
}

/** One-tap logs from the dashboard: a glass of water, a medicine dose. */
export async function quickPregnancyLog(fd: FormData) {
  const viewer = await pregnancyViewer();
  const p = await editablePregnancy(viewer, fd.get("pregnancyId"));
  const kind = pick(fd.get("kind"), ["hydration", "dose"] as const);
  if (!kind) return;
  feature(viewer, LOG_FEATURE[kind]);
  let data: Record<string, unknown> = {};
  if (kind === "dose") {
    const itemId = String(fd.get("itemId"));
    const [it] = isUuid(itemId) ? await db.select().from(pregnancyItems).where(and(eq(pregnancyItems.id, itemId), eq(pregnancyItems.pregnancyId, p.id), eq(pregnancyItems.kind, "medication"))) : [];
    if (!it) return;
    data = { itemId: it.id, name: it.title };
  }
  await db.insert(pregnancyLogs).values({ familyId: viewer.family.id, pregnancyId: p.id, kind, startedAt: new Date(), amount: kind === "hydration" ? "1" : null, data, createdByMemberId: viewer.member.id });
  revalidate(p.id);
}

export async function deletePregnancyLog(fd: FormData) {
  const viewer = await pregnancyViewer();
  const [l] = isUuid(fd.get("id")) ? await db.select().from(pregnancyLogs).where(and(eq(pregnancyLogs.id, String(fd.get("id"))), eq(pregnancyLogs.familyId, viewer.family.id))) : [];
  if (!l) return;
  await editablePregnancy(viewer, l.pregnancyId);
  await db.delete(pregnancyLogs).where(eq(pregnancyLogs.id, l.id));
  revalidate(l.pregnancyId);
}

/** Save a kick-count session (sent from the counter on the device). */
export async function saveKickSession(input: { pregnancyId: string; start: string; end: string; times: string[]; notes?: string }) {
  try {
    const viewer = await pregnancyViewer();
    const p = await editablePregnancy(viewer, input?.pregnancyId);
    feature(viewer, "kicks");
    const start = new Date(input.start);
    const end = new Date(input.end);
    if (Number.isNaN(+start) || Number.isNaN(+end) || end < start || end.getTime() - start.getTime() > 12 * 3600_000 || end.getTime() > Date.now() + 60_000) return { ok: false as const, message: "That session's times don't look right." };
    const times = (Array.isArray(input.times) ? input.times : []).filter((t) => typeof t === "string" && !Number.isNaN(Date.parse(t))).slice(0, 500);
    await db.insert(pregnancyLogs).values({ familyId: viewer.family.id, pregnancyId: p.id, kind: "kicks", startedAt: start, endedAt: end, amount: String(times.length), data: { times }, notes: cap(input.notes?.trim() || null, 1000), createdByMemberId: viewer.member.id });
    revalidate(p.id);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, message: e instanceof AuthorizationError ? e.message : "Couldn't save. Your session is still on this device; try again." };
  }
}

/** Save a contraction-timing session. */
export async function saveContractionSession(input: { pregnancyId: string; contractions: Contraction[]; notes?: string }) {
  try {
    const viewer = await pregnancyViewer();
    const p = await editablePregnancy(viewer, input?.pregnancyId);
    feature(viewer, "contractions");
    const list = (Array.isArray(input.contractions) ? input.contractions : [])
      .filter((c) => c && typeof c.s === "string" && !Number.isNaN(Date.parse(c.s)) && (c.e === null || (typeof c.e === "string" && Date.parse(c.e) >= Date.parse(c.s))))
      .slice(0, 500);
    if (!list.length) return { ok: false as const, message: "Time at least one contraction first." };
    const start = new Date(list[0]!.s);
    const last = list[list.length - 1]!;
    await db.insert(pregnancyLogs).values({ familyId: viewer.family.id, pregnancyId: p.id, kind: "contractions", startedAt: start, endedAt: new Date(last.e ?? last.s), amount: String(list.filter((c) => c.e).length), data: { contractions: list }, notes: cap(input.notes?.trim() || null, 1000), createdByMemberId: viewer.member.id });
    revalidate(p.id);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, message: e instanceof AuthorizationError ? e.message : "Couldn't save. Your session is still on this device; try again." };
  }
}

// ─── Lists: questions, medicines, names, checklists ─────────────────────────

const ITEM_FEATURE = { question: "questions", medication: "medications", name: "names", checklist: "checklists" } as const;

export async function savePregnancyItem(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await pregnancyViewer();
    const p = await editablePregnancy(viewer, fd.get("pregnancyId"));
    const kind = pick(fd.get("kind"), ["question", "medication", "name", "checklist"] as const);
    if (!kind) return fail("What are you adding?");
    feature(viewer, ITEM_FEATURE[kind]);
    const id = f.str(fd, "id");
    // Several at once (one per line) for questions, names and checklist items.
    const titles = id || kind === "medication" ? [f.str(fd, "title")].filter(Boolean) as string[] : String(fd.get("title") ?? "").split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 50);
    if (!titles.length) return fail(kind === "question" ? "Type your question." : "Add a name.", "title");
    const list =
      kind === "question"
        ? (QUESTION_CATEGORIES.find((c) => c.value === fd.get("list"))?.value ?? "other")
        : kind === "name"
          ? (pick(fd.get("list"), ["first", "middle", "both"] as const) ?? "first")
          : kind === "checklist"
            ? cap(f.str(fd, "list"), 40) ?? "custom"
            : null;
    const appointmentId = f.str(fd, "appointmentId");
    const [appt] = isUuid(appointmentId) ? await db.select({ id: pregnancyAppointments.id }).from(pregnancyAppointments).where(and(eq(pregnancyAppointments.id, appointmentId), eq(pregnancyAppointments.pregnancyId, p.id))) : [];
    const data: Record<string, unknown> = {};
    if (kind === "medication") {
      data.dose = cap(f.str(fd, "dose"), 80);
      data.schedule = cap(f.str(fd, "schedule"), 120);
      data.times = f.list(fd, "times").map((t) => hhmm(t)).filter(Boolean).slice(0, 6);
      data.remind = f.bool(fd, "remind");
    }
    if (kind === "name") data.sex = pick(fd.get("sex"), ["girl", "boy", "any"] as const) ?? "any";
    const rating = f.int(fd, "rating");
    const values = {
      list,
      status: kind === "checklist" ? (ITEM_STATUSES.find((s) => s.value === fd.get("status"))?.value ?? "needed") : null,
      notes: cap(f.str(fd, "notes"), 2000),
      rating: rating !== null && rating >= 1 && rating <= 5 ? rating : null,
      appointmentId: appt?.id ?? null,
      data,
    };
    if (id) {
      const res = await db.update(pregnancyItems).set({ ...values, title: titles[0]!.slice(0, 200) }).where(and(eq(pregnancyItems.id, id), eq(pregnancyItems.pregnancyId, p.id))).returning({ id: pregnancyItems.id });
      if (!res.length) throw new AuthorizationError("Not found.");
    } else {
      const [{ pos } = { pos: 0 }] = await db.select({ pos: max(pregnancyItems.position) }).from(pregnancyItems).where(eq(pregnancyItems.pregnancyId, p.id));
      await db.insert(pregnancyItems).values(titles.map((t, i) => ({ ...values, kind, title: t.slice(0, 200), familyId: viewer.family.id, pregnancyId: p.id, position: (pos ?? 0) + i + 1, createdByMemberId: viewer.member.id })));
    }
    revalidate(p.id);
    return ok(id ? "Saved." : titles.length > 1 ? `${titles.length} added.` : "Added.");
  });
}

async function itemFor(viewer: Viewer, id: unknown) {
  const [it] = isUuid(id) ? await db.select().from(pregnancyItems).where(and(eq(pregnancyItems.id, id), eq(pregnancyItems.familyId, viewer.family.id))) : [];
  if (!it) throw new AuthorizationError("Not found.");
  await editablePregnancy(viewer, it.pregnancyId);
  return it;
}

/** Done/answered, favourite, or a checklist status. */
export async function updatePregnancyItem(fd: FormData) {
  const viewer = await pregnancyViewer();
  const it = await itemFor(viewer, fd.get("id"));
  const set: Partial<typeof pregnancyItems.$inferInsert> = {};
  if (fd.has("done")) set.done = fd.get("done") === "true";
  if (fd.has("favorite")) set.favorite = fd.get("favorite") === "true";
  if (fd.has("status")) {
    const s = ITEM_STATUSES.find((x) => x.value === fd.get("status"))?.value;
    if (s) {
      set.status = s;
      set.done = s === "complete" || s === "packed" || s === "purchased";
    }
  }
  if (fd.has("rating")) {
    const r = Number(fd.get("rating"));
    set.rating = r >= 1 && r <= 5 ? r : null;
  }
  if (Object.keys(set).length) await db.update(pregnancyItems).set(set).where(eq(pregnancyItems.id, it.id));
  revalidate(it.pregnancyId);
}

export async function deletePregnancyItem(fd: FormData) {
  const viewer = await pregnancyViewer();
  const it = await itemFor(viewer, fd.get("id"));
  await db.delete(pregnancyItems).where(eq(pregnancyItems.id, it.id));
  revalidate(it.pregnancyId);
}

/** Add a starter checklist (skipping items already there). */
export async function addChecklist(fd: FormData) {
  const viewer = await pregnancyViewer();
  const p = await editablePregnancy(viewer, fd.get("pregnancyId"));
  feature(viewer, String(fd.get("list")).startsWith("post") || fd.get("list") === "recovery" ? "postpartum" : "checklists");
  const group = CHECKLISTS.find((c) => c.key === fd.get("list"));
  if (!group) return;
  const have = new Set((await db.select({ t: pregnancyItems.title }).from(pregnancyItems).where(and(eq(pregnancyItems.pregnancyId, p.id), eq(pregnancyItems.kind, "checklist"), eq(pregnancyItems.list, group.key)))).map((r) => r.t.toLowerCase()));
  const rows = group.items.filter((t) => !have.has(t.toLowerCase())).map((t, i) => ({ familyId: viewer.family.id, pregnancyId: p.id, kind: "checklist" as const, list: group.key, title: t, status: "needed", position: i, createdByMemberId: viewer.member.id }));
  if (rows.length) await db.insert(pregnancyItems).values(rows);
  revalidate(p.id);
}

/** Move every unanswered question from one appointment to another (or back to the general list). */
export async function carryQuestions(fd: FormData) {
  const viewer = await pregnancyViewer();
  const p = await editablePregnancy(viewer, fd.get("pregnancyId"));
  const from = String(fd.get("from"));
  const to = f.str(fd, "to");
  const ids = [from, to].filter(Boolean) as string[];
  const valid = ids.length ? await db.select({ id: pregnancyAppointments.id }).from(pregnancyAppointments).where(and(inArray(pregnancyAppointments.id, ids.filter(isUuid)), eq(pregnancyAppointments.pregnancyId, p.id))) : [];
  if (!valid.some((v) => v.id === from)) return;
  await db
    .update(pregnancyItems)
    .set({ appointmentId: to && valid.some((v) => v.id === to) ? to : null })
    .where(and(eq(pregnancyItems.pregnancyId, p.id), eq(pregnancyItems.kind, "question"), eq(pregnancyItems.appointmentId, from), eq(pregnancyItems.done, false)));
  revalidate(p.id);
}

// ─── Appointments (on the family calendar) ──────────────────────────────────

export async function savePregnancyAppointment(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await pregnancyViewer();
    const p = await editablePregnancy(viewer, fd.get("pregnancyId"));
    feature(viewer, "appointments");
    const tz = viewer.family.timezone;
    const kind = APPOINTMENT_KINDS.find((k) => k.value === fd.get("kind"))?.value ?? "prenatal";
    const title = cap(f.str(fd, "title"), 120) ?? APPOINTMENT_KINDS.find((k) => k.value === kind)!.label;
    const date = f.date(fd, "date");
    if (!date) return fail("Pick a date.", "date");
    const time = hhmm(fd.get("time")) ?? "09:00";
    const startsAt = zonedToUtc(date, time, tz);
    const minutes = Math.min(600, Math.max(5, f.int(fd, "duration") ?? 60));
    const reminder = f.int(fd, "reminderMinutes");
    const id = f.str(fd, "id");
    const [old] = id ? await db.select().from(pregnancyAppointments).where(and(eq(pregnancyAppointments.id, id), eq(pregnancyAppointments.pregnancyId, p.id))) : [];
    if (id && !old) throw new AuthorizationError("Appointment not found.");
    const event = {
      familyId: viewer.family.id,
      title: `🤰 ${title}`,
      description: cap(f.str(fd, "questions"), 2000),
      location: cap(f.str(fd, "location"), 200),
      startsAt,
      endsAt: new Date(startsAt.getTime() + minutes * 60_000),
      allDay: false,
      reminderMinutes: reminder !== null && reminder >= 0 && reminder <= 10080 ? reminder : null,
      notes: cap(f.str(fd, "notes"), 4000),
      visibility: p.visibility,
      source: "pregnancy" as const,
      sourceId: p.id,
    };
    const details = { kind, provider: cap(f.str(fd, "provider"), 120), tests: cap(f.str(fd, "tests"), 1000), results: cap(f.str(fd, "results"), 2000), followUpOn: f.date(fd, "followUpOn") };
    const upload = await saveUpload(viewer, fd.get("attachment"), { allowDocs: true });
    let apptId = old?.id;
    await db.transaction(async (tx) => {
      let eventId = old?.eventId;
      if (old) await tx.update(calendarEvents).set(event).where(and(eq(calendarEvents.id, old.eventId), eq(calendarEvents.familyId, viewer.family.id)));
      else eventId = (await tx.insert(calendarEvents).values({ ...event, createdByMemberId: viewer.member.id }).returning({ id: calendarEvents.id }))[0]!.id;
      if (old) await tx.update(pregnancyAppointments).set(details).where(eq(pregnancyAppointments.id, old.id));
      else apptId = (await tx.insert(pregnancyAppointments).values({ ...details, familyId: viewer.family.id, pregnancyId: p.id, eventId: eventId!, createdByMemberId: viewer.member.id }).returning({ id: pregnancyAppointments.id }))[0]!.id;
      await tx.delete(eventAttendees).where(eq(eventAttendees.eventId, eventId!));
      await tx.insert(eventAttendees).values({ eventId: eventId!, memberId: p.memberId });
      const shared = p.visibility === "selected" ? (await tx.select({ m: recordAccess.memberId }).from(recordAccess).where(and(eq(recordAccess.entityType, "pregnancy"), eq(recordAccess.entityId, p.id)))).map((r) => r.m) : [];
      await tx.delete(recordAccess).where(and(eq(recordAccess.entityType, "event"), eq(recordAccess.entityId, eventId!)));
      await tx.insert(recordAccess).values([...new Set([p.memberId, ...shared])].map((memberId) => ({ familyId: viewer.family.id, entityType: "event" as const, entityId: eventId!, memberId })));
      // Questions picked for this visit.
      const qs = f.list(fd, "questionIds").filter(isUuid).slice(0, 50);
      if (qs.length) await tx.update(pregnancyItems).set({ appointmentId: apptId! }).where(and(inArray(pregnancyItems.id, qs), eq(pregnancyItems.pregnancyId, p.id), eq(pregnancyItems.kind, "question")));
      if (upload) await tx.insert(pregnancyEntries).values({ familyId: viewer.family.id, pregnancyId: p.id, kind: "document", category: "appointment", title: cap(f.str(fd, "attachmentTitle"), 120) ?? `${title} document`, date, week: weekOn(p.dueDate, date), fileId: upload, appointmentId: apptId!, createdByMemberId: viewer.member.id });
    });
    revalidate(p.id);
    return ok(id ? "Appointment saved." : "Appointment added to the calendar.");
  });
}

export async function deletePregnancyAppointment(fd: FormData) {
  const viewer = await pregnancyViewer();
  const [a] = isUuid(fd.get("id")) ? await db.select().from(pregnancyAppointments).where(and(eq(pregnancyAppointments.id, String(fd.get("id"))), eq(pregnancyAppointments.familyId, viewer.family.id))) : [];
  if (!a) return;
  await editablePregnancy(viewer, a.pregnancyId);
  await db.transaction(async (tx) => {
    await tx.update(pregnancyItems).set({ appointmentId: null }).where(eq(pregnancyItems.appointmentId, a.id));
    await tx.delete(calendarEvents).where(and(eq(calendarEvents.id, a.eventId), eq(calendarEvents.familyId, viewer.family.id)));
  });
  revalidate(a.pregnancyId);
}

// ─── Journal, photos, documents ─────────────────────────────────────────────

export async function savePregnancyEntry(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await pregnancyViewer();
    const p = await editablePregnancy(viewer, fd.get("pregnancyId"));
    const kind = pick(fd.get("kind"), ["journal", "photo", "document"] as const);
    if (!kind) return fail("What are you adding?");
    feature(viewer, kind === "journal" ? "journal" : kind === "photo" ? "photos" : "documents");
    const date = f.date(fd, "date") ?? todayIn(viewer.family.timezone);
    if (date > todayIn(viewer.family.timezone)) return fail("That date is in the future.", "date");
    const id = f.str(fd, "id");
    const [old] = id ? await db.select().from(pregnancyEntries).where(and(eq(pregnancyEntries.id, id), eq(pregnancyEntries.pregnancyId, p.id))) : [];
    if (id && !old) throw new AuthorizationError("Not found.");
    const file = await saveUpload(viewer, fd.get("file"), { allowDocs: kind === "document" });
    if (kind !== "journal" && !file && !old?.fileId) return fail(kind === "photo" ? "Choose a photo." : "Choose a file (image or PDF).", "file");
    const body = cap(f.str(fd, "body"), 10000);
    if (kind === "journal" && !body && !f.str(fd, "title")) return fail("Write a few words.", "body");
    const values = { kind, category: cap(f.str(fd, "category"), 40), title: cap(f.str(fd, "title"), 160), body, date, week: weekOn(p.dueDate, date), mood: cap(f.str(fd, "mood"), 20), ...(file ? { fileId: file } : {}) };
    if (old) {
      await db.update(pregnancyEntries).set(values).where(eq(pregnancyEntries.id, old.id));
      if (file && old.fileId) await deleteFamilyFile(viewer.family.id, old.fileId);
    } else await db.insert(pregnancyEntries).values({ ...values, familyId: viewer.family.id, pregnancyId: p.id, createdByMemberId: viewer.member.id });
    revalidate(p.id);
    return ok(id ? "Saved." : kind === "journal" ? "Saved to your journal." : kind === "photo" ? "Photo added." : "Document saved.");
  });
}

export async function deletePregnancyEntry(fd: FormData) {
  const viewer = await pregnancyViewer();
  const [e] = isUuid(fd.get("id")) ? await db.select().from(pregnancyEntries).where(and(eq(pregnancyEntries.id, String(fd.get("id"))), eq(pregnancyEntries.familyId, viewer.family.id))) : [];
  if (!e) return;
  await editablePregnancy(viewer, e.pregnancyId);
  await db.delete(pregnancyEntries).where(eq(pregnancyEntries.id, e.id));
  if (e.fileId) await deleteFamilyFile(viewer.family.id, e.fileId);
  revalidate(e.pregnancyId);
}

// ─── Admin: educational content ─────────────────────────────────────────────

/** Platform admin only: override a week's educational content (blank fields keep the built-in text). */
export async function saveWeekContent(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const admin = await requirePlatformAdmin();
    const week = f.int(fd, "week");
    if (!week || week < 1 || week > 42) return fail("Pick a week from 1 to 42.", "week");
    const lines = (k: string) => {
      const v = f.str(fd, k);
      return v ? v.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 30).map((s) => s.slice(0, 400)) : undefined;
    };
    const str = (k: string, n = 1500) => cap(f.str(fd, k), n) ?? undefined;
    const num = (k: string) => {
      const n = f.num(fd, k);
      return n !== null && n >= 0 && n < 10000 ? n : undefined;
    };
    const data = Object.fromEntries(
      Object.entries({
        size: str("size", 80),
        emoji: str("emoji", 8),
        baby: str("baby"),
        bodyChanges: str("bodyChanges"),
        lengthCm: num("lengthCm"),
        weightG: num("weightG"),
        milestones: lines("milestones"),
        symptoms: lines("symptoms"),
        care: lines("care"),
        prepare: lines("prepare"),
        questions: lines("questions"),
        development: Object.fromEntries(Object.entries({ body: str("dev_body"), organs: str("dev_organs"), movement: str("dev_movement"), senses: str("dev_senses") }).filter(([, v]) => v)),
      }).filter(([, v]) => v !== undefined && !(typeof v === "object" && !Array.isArray(v) && !Object.keys(v as object).length)),
    );
    if (f.bool(fd, "reset") || !Object.keys(data).length) await db.delete(pregnancyWeekContent).where(eq(pregnancyWeekContent.week, week));
    else
      await db
        .insert(pregnancyWeekContent)
        .values({ week, data, updatedBy: (admin as { user?: { email?: string } }).user?.email ?? "admin" })
        .onConflictDoUpdate({ target: pregnancyWeekContent.week, set: { data, updatedAt: new Date() } });
    revalidatePath("/pregnancy", "layout");
    revalidatePath("/admin/pregnancy");
    return ok(`Week ${week} saved.`);
  });
}
