"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { danceClasses, danceDaysOff, danceEnrollments, danceEvents, familyMembers, pointeFavorites, pointeShoes } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { AuthorizationError, requireModule, type Viewer } from "@/lib/dal";
import { f } from "@/lib/records";

/**
 * Dance. Anyone with Dance "Use" manages their own schedule; "Add & edit"
 * (parents by default) manages every dancer's.
 */
function revalidateDance() {
  revalidatePath("/dance", "layout");
  revalidatePath("/calendar", "layout");
  revalidatePath("/");
}

async function dancerIds(viewer: Viewer, ids: string[]) {
  const clean = [...new Set(ids.filter((x) => /^[0-9a-f-]{36}$/i.test(x)))];
  if (!clean.length) return [];
  const rows = await db.select({ id: familyMembers.id }).from(familyMembers).where(and(eq(familyMembers.familyId, viewer.family.id), inArray(familyMembers.id, clean)));
  return rows.map((r) => r.id);
}

/** Members this viewer may change dance info for. */
async function allowedDancers(viewer: Viewer, ids: string[]) {
  const found = await dancerIds(viewer, ids);
  if (!found.length) throw new AuthorizationError("Choose a dancer.");
  if (!viewer.can("dance", "edit") && found.some((id) => id !== viewer.member.id)) throw new AuthorizationError("You can only change your own dance schedule.");
  return found;
}

async function existing<T extends { id: string; familyId: string }>(viewer: Viewer, rows: T[]) {
  const row = rows[0];
  if (!row || row.familyId !== viewer.family.id) throw new AuthorizationError("Not found.");
  return row;
}

const time = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "");
  return /^\d{2}:\d{2}/.test(v) ? v.slice(0, 5) : null;
};

export async function saveEnrollment(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("dance", "use");
    const [memberId] = await allowedDancers(viewer, [String(fd.get("memberId") ?? "")]);
    // A dancer's entry: who, their level, style, studio and season (no separate name or type).
    const level = f.str(fd, "level");
    const style = f.str(fd, "style");
    const studio = f.str(fd, "studio");
    if (!level && !style && !studio) return fail("Add the dancer's level (or style or studio).", "level");
    const name = (level ?? style ?? studio)!.slice(0, 80);
    const values = { familyId: viewer.family.id, memberId: memberId!, name, kind: "level" as const, level, studio, style, season: f.str(fd, "season"), active: fd.get("active") !== "no", notes: f.str(fd, "notes") };
    const id = f.str(fd, "id");
    if (id) {
      const old = await existing(viewer, await db.select().from(danceEnrollments).where(eq(danceEnrollments.id, id)));
      await allowedDancers(viewer, [old.memberId]);
      await db.update(danceEnrollments).set(values).where(eq(danceEnrollments.id, old.id));
    } else await db.insert(danceEnrollments).values(values);
    revalidateDance();
    return ok("Saved.");
  });
}

export async function deleteEnrollment(fd: FormData) {
  const viewer = await requireModule("dance", "use");
  const old = await existing(viewer, await db.select().from(danceEnrollments).where(eq(danceEnrollments.id, String(fd.get("id")))));
  await allowedDancers(viewer, [old.memberId]);
  await db.delete(danceEnrollments).where(eq(danceEnrollments.id, old.id));
  revalidateDance();
}

export async function saveDanceClass(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("dance", "use");
    const [memberId] = await allowedDancers(viewer, [String(fd.get("memberId") ?? "")]);
    const title = f.str(fd, "title");
    if (!title) return fail("Name the class (e.g. Jazz, Team rehearsal).", "title");
    const weekdays = fd.getAll("weekday").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
    if (!weekdays.length) return fail("Choose the day(s) it meets.", "weekday");
    const startTime = time(fd, "startTime");
    if (!startTime) return fail("Add the start time.", "startTime");
    const enrollmentId = f.str(fd, "enrollmentId");
    const enr = enrollmentId ? (await db.select({ id: danceEnrollments.id }).from(danceEnrollments).where(and(eq(danceEnrollments.id, enrollmentId), eq(danceEnrollments.familyId, viewer.family.id))))[0]?.id ?? null : null;
    const base = { familyId: viewer.family.id, memberId: memberId!, enrollmentId: enr, title: title.slice(0, 80), startTime, endTime: time(fd, "endTime"), location: f.str(fd, "location"), startsOn: f.date(fd, "startsOn"), endsOn: f.date(fd, "endsOn"), notes: f.str(fd, "notes") };
    const id = f.str(fd, "id");
    if (id) {
      const old = await existing(viewer, await db.select().from(danceClasses).where(eq(danceClasses.id, id)));
      await allowedDancers(viewer, [old.memberId]);
      await db.update(danceClasses).set({ ...base, weekday: weekdays[0]! }).where(eq(danceClasses.id, old.id));
    } else {
      // One row per weekday ("Mon & Wed" → two classes).
      await db.insert(danceClasses).values(weekdays.map((weekday) => ({ ...base, weekday })));
    }
    revalidateDance();
    return ok("Saved.");
  });
}

export async function deleteDanceClass(fd: FormData) {
  const viewer = await requireModule("dance", "use");
  const old = await existing(viewer, await db.select().from(danceClasses).where(eq(danceClasses.id, String(fd.get("id")))));
  await allowedDancers(viewer, [old.memberId]);
  await db.delete(danceClasses).where(eq(danceClasses.id, old.id));
  revalidateDance();
}

/** Day off / holiday / break. "Everyone" (studio closed) needs Add & edit. */
export async function saveDayOff(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("dance", "use");
    const who = String(fd.get("memberId") ?? "");
    const memberId = who === "all" || !who ? null : (await allowedDancers(viewer, [who]))[0]!;
    if (!memberId && !viewer.can("dance", "edit")) throw new AuthorizationError("Only people who manage Dance can add studio-wide days off.");
    const title = f.str(fd, "title") ?? "Day off";
    const startDate = f.date(fd, "startDate");
    if (!startDate) return fail("Choose the date.", "startDate");
    const endDate = f.date(fd, "endDate") ?? startDate;
    if (endDate < startDate) return fail("The end date is before the start.", "endDate");
    const values = { familyId: viewer.family.id, memberId, title: title.slice(0, 80), startDate, endDate };
    const id = f.str(fd, "id");
    if (id) {
      const old = await existing(viewer, await db.select().from(danceDaysOff).where(eq(danceDaysOff.id, id)));
      if (old.memberId) await allowedDancers(viewer, [old.memberId]);
      else if (!viewer.can("dance", "edit")) throw new AuthorizationError("Not allowed.");
      await db.update(danceDaysOff).set(values).where(eq(danceDaysOff.id, old.id));
    } else await db.insert(danceDaysOff).values(values);
    revalidateDance();
    return ok("Saved.");
  });
}

export async function deleteDayOff(fd: FormData) {
  const viewer = await requireModule("dance", "use");
  const old = await existing(viewer, await db.select().from(danceDaysOff).where(eq(danceDaysOff.id, String(fd.get("id")))));
  if (old.memberId) await allowedDancers(viewer, [old.memberId]);
  else if (!viewer.can("dance", "edit")) throw new AuthorizationError("Not allowed.");
  await db.delete(danceDaysOff).where(eq(danceDaysOff.id, old.id));
  revalidateDance();
}

const EVENT_KINDS = ["performance", "competition", "recital", "rehearsal", "audition", "photos", "other"] as const;

export async function saveDanceEvent(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("dance", "use");
    const memberIds = await allowedDancers(viewer, fd.getAll("memberIds").map(String));
    const title = f.str(fd, "title");
    if (!title) return fail("Name it (e.g. Spring Recital).", "title");
    const date = f.date(fd, "date");
    if (!date) return fail("Choose the date.", "date");
    const values = {
      familyId: viewer.family.id,
      memberIds,
      kind: EVENT_KINDS.find((k) => k === fd.get("kind")) ?? "performance",
      title: title.slice(0, 100),
      date,
      endDate: f.date(fd, "endDate"),
      callTime: time(fd, "callTime"),
      startTime: time(fd, "startTime"),
      endTime: time(fd, "endTime"),
      location: f.str(fd, "location"),
      details: f.str(fd, "details"),
      costCents: f.cents(fd, "cost"),
      ticketCents: f.cents(fd, "ticket"),
      link: safeLink(f.str(fd, "link")),
    };
    const id = f.str(fd, "id");
    if (id) {
      const old = await existing(viewer, await db.select().from(danceEvents).where(eq(danceEvents.id, id)));
      await allowedDancers(viewer, old.memberIds);
      await db.update(danceEvents).set(values).where(eq(danceEvents.id, old.id));
    } else await db.insert(danceEvents).values(values);
    revalidateDance();
    return ok("Saved.");
  });
}

export async function deleteDanceEvent(fd: FormData) {
  const viewer = await requireModule("dance", "use");
  const old = await existing(viewer, await db.select().from(danceEvents).where(eq(danceEvents.id, String(fd.get("id")))));
  await allowedDancers(viewer, old.memberIds);
  await db.delete(danceEvents).where(eq(danceEvents.id, old.id));
  revalidateDance();
}

/** Only http(s) links; "tickets.example.com" gets https:// added. */
function safeLink(v: string | null) {
  if (!v) return null;
  const url = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString().slice(0, 500) : null;
  } catch {
    return null;
  }
}

// ─── Pointe shoes ────────────────────────────────────────────────────────────

const SHOE_STATUS = ["ordered", "on_hand", "in_use", "retired"] as const;

function shoeFields(fd: FormData) {
  return {
    brand: (f.str(fd, "brand") ?? "").slice(0, 80),
    model: f.str(fd, "model"),
    size: f.str(fd, "size"),
    width: f.str(fd, "width"),
    shank: f.str(fd, "shank"),
    wings: f.str(fd, "wings"),
    notes: f.str(fd, "notes"),
  };
}

export async function savePointeShoe(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("dance", "use");
    const [memberId] = await allowedDancers(viewer, [String(fd.get("memberId") ?? "")]);
    const fields = shoeFields(fd);
    if (!fields.brand) return fail("Which brand?", "brand");
    const status = SHOE_STATUS.find((x) => x === fd.get("status")) ?? "on_hand";
    const values = {
      ...fields,
      familyId: viewer.family.id,
      memberId: memberId!,
      status,
      store: f.str(fd, "store"),
      priceCents: f.cents(fd, "price"),
      orderedOn: f.date(fd, "orderedOn"),
      receivedOn: f.date(fd, "receivedOn"),
      firstWornOn: f.date(fd, "firstWornOn"),
      retiredOn: f.date(fd, "retiredOn"),
      reorderBy: f.date(fd, "reorderBy"),
    };
    const id = f.str(fd, "id");
    if (id) {
      const old = await existing(viewer, await db.select().from(pointeShoes).where(eq(pointeShoes.id, id)));
      await allowedDancers(viewer, [old.memberId]);
      await db.update(pointeShoes).set(values).where(eq(pointeShoes.id, old.id));
    } else await db.insert(pointeShoes).values(values);
    revalidateDance();
    return ok("Saved.");
  });
}

/** Move a pair along: ordered → on hand → in use → retired (filling in today's date). */
export async function advancePointeShoe(fd: FormData) {
  const viewer = await requireModule("dance", "use");
  const old = await existing(viewer, await db.select().from(pointeShoes).where(eq(pointeShoes.id, String(fd.get("id")))));
  await allowedDancers(viewer, [old.memberId]);
  const today = String(fd.get("today") ?? "");
  const day = /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : new Date().toISOString().slice(0, 10);
  const next = { ordered: "on_hand", on_hand: "in_use", in_use: "retired", retired: "retired" } as const;
  const status = next[old.status];
  await db
    .update(pointeShoes)
    .set({
      status,
      ...(status === "on_hand" && !old.receivedOn ? { receivedOn: day } : {}),
      ...(status === "in_use" && !old.firstWornOn ? { firstWornOn: day } : {}),
      ...(status === "retired" && !old.retiredOn ? { retiredOn: day } : {}),
    })
    .where(eq(pointeShoes.id, old.id));
  revalidateDance();
}

export async function deletePointeShoe(fd: FormData) {
  const viewer = await requireModule("dance", "use");
  const old = await existing(viewer, await db.select().from(pointeShoes).where(eq(pointeShoes.id, String(fd.get("id")))));
  await allowedDancers(viewer, [old.memberId]);
  await db.delete(pointeShoes).where(eq(pointeShoes.id, old.id));
  revalidateDance();
}

export async function savePointeFavorite(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("dance", "use");
    const [memberId] = await allowedDancers(viewer, [String(fd.get("memberId") ?? "")]);
    const fields = shoeFields(fd);
    if (!fields.brand) return fail("Which brand?", "brand");
    const id = f.str(fd, "id");
    if (id) {
      const old = await existing(viewer, await db.select().from(pointeFavorites).where(eq(pointeFavorites.id, id)));
      await allowedDancers(viewer, [old.memberId]);
      await db.update(pointeFavorites).set({ ...fields, memberId: memberId! }).where(eq(pointeFavorites.id, old.id));
    } else await db.insert(pointeFavorites).values({ ...fields, familyId: viewer.family.id, memberId: memberId! });
    revalidateDance();
    return ok("Saved.");
  });
}

export async function deletePointeFavorite(fd: FormData) {
  const viewer = await requireModule("dance", "use");
  const old = await existing(viewer, await db.select().from(pointeFavorites).where(eq(pointeFavorites.id, String(fd.get("id")))));
  await allowedDancers(viewer, [old.memberId]);
  await db.delete(pointeFavorites).where(eq(pointeFavorites.id, old.id));
  revalidateDance();
}
