"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { faithEntries, faithHolidays, faithPracticeLogs, faithPractices, faithPrayers, faithReadingLogs, faithTexts, families, familyMembers } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { AuthorizationError, requireModule, requireParent, type Viewer } from "@/lib/dal";
import { todayIn } from "@/lib/dates";
import { findText } from "@/lib/faith";
import { FAITHS, isFaith, PRACTICE_UNITS, type Faith } from "@/lib/faith-config";
import { f } from "@/lib/records";

/**
 * Faith paths in the Spiritual section. Practices, reading, prayers and journal
 * entries are the member's own; family holidays are shared.
 */
const MOD = "witchcraft" as const;
const uuidOk = (v: string | null): v is string => !!v && /^[0-9a-f-]{36}$/i.test(v);
const dateOk = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const faithOf = (fd: FormData): Faith => {
  const v = f.str(fd, "faith");
  if (!isFaith(v)) throw new AuthorizationError("Choose a path.");
  return v;
};
const refresh = () => revalidatePath("/spiritual", "layout");

async function own<T extends { memberId: string }>(rows: Promise<T[]>): Promise<T> {
  const [r] = await rows;
  if (!r) throw new AuthorizationError("Not found.");
  return r;
}

// ─── Settings ────────────────────────────────────────────────────────────────

/**
 * Account settings (parents): the religions the family uses, and which members
 * get each one. Form fields: "faith" (checked religions) and "access:<faith>"
 * (member ids with that religion).
 */
export async function saveFamilyFaiths(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireParent();
    const faiths = FAITHS.filter((x) => f.list(fd, "faith").includes(x));
    const members = await db.select({ id: familyMembers.id }).from(familyMembers).where(and(eq(familyMembers.familyId, viewer.family.id), eq(familyMembers.isActive, true)));
    await db.update(families).set({ faithPaths: faiths }).where(eq(families.id, viewer.family.id));
    for (const m of members) {
      const mine = faiths.filter((x) => f.list(fd, `access:${x}`).includes(m.id));
      await db.update(familyMembers).set({ faithPaths: mine }).where(eq(familyMembers.id, m.id));
    }
    revalidatePath("/", "layout");
    return ok(faiths.length ? "Saved. Each person now sees the religions you gave them." : "No religions chosen: the Spiritual section is hidden for everyone.");
  });
}

// ─── Practices ───────────────────────────────────────────────────────────────

async function practice(viewer: Viewer, id: string | null) {
  if (!uuidOk(id)) throw new AuthorizationError("Not found.");
  return own(db.select().from(faithPractices).where(and(eq(faithPractices.id, id), eq(faithPractices.memberId, viewer.member.id))));
}

/** Check a practice off for a day (or un-check it). */
export async function togglePractice(fd: FormData) {
  const viewer = await requireModule(MOD, "view");
  const p = await practice(viewer, f.str(fd, "id"));
  const date = f.str(fd, "date") ?? todayIn(viewer.family.timezone);
  if (!dateOk(date)) throw new AuthorizationError("Pick a day.");
  const [had] = await db.select({ id: faithPracticeLogs.id }).from(faithPracticeLogs).where(and(eq(faithPracticeLogs.practiceId, p.id), eq(faithPracticeLogs.date, date)));
  if (had) await db.delete(faithPracticeLogs).where(eq(faithPracticeLogs.id, had.id));
  else await db.insert(faithPracticeLogs).values({ familyId: viewer.family.id, memberId: viewer.member.id, practiceId: p.id, date }).onConflictDoNothing();
  refresh();
}

/** Record a practice with an amount and/or note. */
export async function logPractice(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule(MOD, "view");
    const p = await practice(viewer, f.str(fd, "id"));
    const date = f.str(fd, "date") ?? todayIn(viewer.family.timezone);
    if (!dateOk(date)) return fail("Pick a day.", "date");
    const amount = f.int(fd, "amount");
    const values = { amount: amount !== null && amount >= 0 && amount < 100000 ? amount : null, note: f.str(fd, "note")?.slice(0, 1000) ?? null };
    await db
      .insert(faithPracticeLogs)
      .values({ familyId: viewer.family.id, memberId: viewer.member.id, practiceId: p.id, date, ...values })
      .onConflictDoUpdate({ target: [faithPracticeLogs.practiceId, faithPracticeLogs.date], set: values });
    refresh();
    return ok("Saved.");
  });
}

export async function savePractice(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule(MOD, "view");
    const id = f.str(fd, "id");
    const name = f.str(fd, "name");
    if (!name) return fail("Name the practice.", "name");
    const unit = f.str(fd, "unit");
    const values = { name: name.slice(0, 80), emoji: f.str(fd, "emoji")?.slice(0, 8) ?? null, unit: unit && (PRACTICE_UNITS as readonly string[]).includes(unit) ? unit : null };
    if (id) {
      const p = await practice(viewer, id);
      await db.update(faithPractices).set(values).where(eq(faithPractices.id, p.id));
    } else {
      await db.insert(faithPractices).values({ familyId: viewer.family.id, memberId: viewer.member.id, faith: faithOf(fd), sort: 100, ...values });
    }
    refresh();
    return ok("Saved.");
  });
}

/** Show or hide a practice on the daily checklist (history is kept). */
export async function togglePracticeActive(fd: FormData) {
  const viewer = await requireModule(MOD, "view");
  const p = await practice(viewer, f.str(fd, "id"));
  await db.update(faithPractices).set({ active: !p.active }).where(eq(faithPractices.id, p.id));
  refresh();
}

export async function deletePractice(fd: FormData) {
  const viewer = await requireModule(MOD, "view");
  const p = await practice(viewer, f.str(fd, "id"));
  await db.delete(faithPractices).where(eq(faithPractices.id, p.id));
  refresh();
}

// ─── Reading ─────────────────────────────────────────────────────────────────

/** Mark one section (chapter, portion…) read or unread. */
export async function toggleReading(fd: FormData) {
  const viewer = await requireModule(MOD, "view");
  const t = await findText(viewer, f.str(fd, "text") ?? "");
  const n = f.int(fd, "section");
  if (!t || !n || n < 1 || n > t.sections) throw new AuthorizationError("Not found.");
  const where = and(eq(faithReadingLogs.memberId, viewer.member.id), eq(faithReadingLogs.textKey, t.key), eq(faithReadingLogs.section, n));
  const [had] = await db.select({ id: faithReadingLogs.id }).from(faithReadingLogs).where(where);
  if (had) await db.delete(faithReadingLogs).where(eq(faithReadingLogs.id, had.id));
  else await db.insert(faithReadingLogs).values({ familyId: viewer.family.id, memberId: viewer.member.id, textKey: t.key, section: n, readOn: todayIn(viewer.family.timezone) }).onConflictDoNothing();
  refresh();
}

/** op = "all" (mark every section read) | "reset" (start over). */
export async function markText(fd: FormData) {
  const viewer = await requireModule(MOD, "view");
  const t = await findText(viewer, f.str(fd, "text") ?? "");
  if (!t) throw new AuthorizationError("Not found.");
  const where = and(eq(faithReadingLogs.memberId, viewer.member.id), eq(faithReadingLogs.textKey, t.key));
  if (f.str(fd, "op") === "reset") await db.delete(faithReadingLogs).where(where);
  else {
    const today = todayIn(viewer.family.timezone);
    await db
      .insert(faithReadingLogs)
      .values(Array.from({ length: t.sections }, (_, i) => ({ familyId: viewer.family.id, memberId: viewer.member.id, textKey: t.key, section: i + 1, readOn: today })))
      .onConflictDoNothing();
  }
  refresh();
}

export async function saveText(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule(MOD, "view");
    const title = f.str(fd, "title");
    if (!title) return fail("What are you reading?", "title");
    const sections = f.int(fd, "sections");
    if (!sections || sections < 1 || sections > 2000) return fail("How many chapters or parts (1–2000)?", "sections");
    await db.insert(faithTexts).values({ familyId: viewer.family.id, memberId: viewer.member.id, faith: faithOf(fd), title: title.slice(0, 120), sections, sectionLabel: f.str(fd, "sectionLabel")?.slice(0, 30) ?? "Chapter" });
    refresh();
    return ok("Added to your reading.");
  });
}

export async function deleteText(fd: FormData) {
  const viewer = await requireModule(MOD, "view");
  const id = f.str(fd, "id");
  if (!uuidOk(id)) throw new AuthorizationError("Not found.");
  const t = await own(db.select().from(faithTexts).where(and(eq(faithTexts.id, id), eq(faithTexts.memberId, viewer.member.id))));
  await db.delete(faithReadingLogs).where(and(eq(faithReadingLogs.memberId, viewer.member.id), eq(faithReadingLogs.textKey, t.id)));
  await db.delete(faithTexts).where(eq(faithTexts.id, t.id));
  refresh();
}

// ─── Prayers / intentions ────────────────────────────────────────────────────

async function prayer(viewer: Viewer, id: string | null) {
  if (!uuidOk(id)) throw new AuthorizationError("Not found.");
  return own(db.select().from(faithPrayers).where(and(eq(faithPrayers.id, id), eq(faithPrayers.memberId, viewer.member.id))));
}

export async function savePrayer(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule(MOD, "view");
    const title = f.str(fd, "title");
    if (!title) return fail("What is it for?", "title");
    const values = { title: title.slice(0, 200), forWhom: f.str(fd, "forWhom")?.slice(0, 120) ?? null, details: f.str(fd, "details")?.slice(0, 2000) ?? null, shared: f.bool(fd, "shared") };
    const id = f.str(fd, "id");
    if (id) {
      const p = await prayer(viewer, id);
      await db.update(faithPrayers).set(values).where(eq(faithPrayers.id, p.id));
    } else await db.insert(faithPrayers).values({ familyId: viewer.family.id, memberId: viewer.member.id, faith: faithOf(fd), ...values });
    refresh();
    return ok("Saved.");
  });
}

export async function answerPrayer(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule(MOD, "view");
    const p = await prayer(viewer, f.str(fd, "id"));
    await db.update(faithPrayers).set({ answeredOn: todayIn(viewer.family.timezone), answerNote: f.str(fd, "answerNote")?.slice(0, 2000) ?? null }).where(eq(faithPrayers.id, p.id));
    refresh();
    return ok("Marked as answered.");
  });
}

export async function reopenPrayer(fd: FormData) {
  const viewer = await requireModule(MOD, "view");
  const p = await prayer(viewer, f.str(fd, "id"));
  await db.update(faithPrayers).set({ answeredOn: null, answerNote: null }).where(eq(faithPrayers.id, p.id));
  refresh();
}

export async function deletePrayer(fd: FormData) {
  const viewer = await requireModule(MOD, "view");
  const p = await prayer(viewer, f.str(fd, "id"));
  await db.delete(faithPrayers).where(eq(faithPrayers.id, p.id));
  refresh();
}

// ─── Journal ─────────────────────────────────────────────────────────────────

export async function saveFaithEntry(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule(MOD, "view");
    const body = f.str(fd, "body");
    if (!body) return fail("Write a few words.", "body");
    const date = f.str(fd, "date") ?? todayIn(viewer.family.timezone);
    if (!dateOk(date)) return fail("Pick a day.", "date");
    const values = { date, title: f.str(fd, "title")?.slice(0, 160) ?? null, reference: f.str(fd, "reference")?.slice(0, 160) ?? null, body: body.slice(0, 20000), shared: f.bool(fd, "shared") };
    const id = f.str(fd, "id");
    if (id) {
      if (!uuidOk(id)) return fail("Not found.");
      const e = await own(db.select().from(faithEntries).where(and(eq(faithEntries.id, id), eq(faithEntries.memberId, viewer.member.id))));
      await db.update(faithEntries).set(values).where(eq(faithEntries.id, e.id));
    } else await db.insert(faithEntries).values({ familyId: viewer.family.id, memberId: viewer.member.id, faith: faithOf(fd), ...values });
    refresh();
    return ok("Saved.");
  });
}

export async function deleteFaithEntry(fd: FormData) {
  const viewer = await requireModule(MOD, "view");
  const id = f.str(fd, "id");
  if (!uuidOk(id)) throw new AuthorizationError("Not found.");
  await db.delete(faithEntries).where(and(eq(faithEntries.id, id), eq(faithEntries.memberId, viewer.member.id)));
  refresh();
}

// ─── Family holidays ─────────────────────────────────────────────────────────

/** A custom family day, or (with holidayKey) this year's date change for a built-in holiday. */
export async function saveFaithHoliday(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule(MOD, "view");
    const faith = faithOf(fd);
    const date = f.str(fd, "date");
    if (!dateOk(date)) return fail("Pick a date.", "date");
    const holidayKey = f.str(fd, "holidayKey")?.slice(0, 60) ?? null;
    const name = f.str(fd, "name");
    if (!name) return fail("Name the day.", "name");
    const values = { name: name.slice(0, 120), emoji: f.str(fd, "emoji")?.slice(0, 8) ?? null, date, yearly: !holidayKey && f.bool(fd, "yearly"), notes: f.str(fd, "notes")?.slice(0, 2000) ?? null };
    const id = f.str(fd, "id");
    if (id) {
      if (!uuidOk(id)) return fail("Not found.");
      const [r] = await db.select().from(faithHolidays).where(and(eq(faithHolidays.id, id), eq(faithHolidays.familyId, viewer.family.id)));
      if (!r) return fail("Not found.");
      if (r.createdByMemberId !== viewer.member.id && !viewer.can(MOD, "edit")) return fail("Only the person who added this (or a parent) can change it.");
      await db.update(faithHolidays).set(values).where(eq(faithHolidays.id, r.id));
    } else {
      if (holidayKey) {
        // One change per holiday per year: replace an earlier one.
        const y = date.slice(0, 4);
        const old = await db.select({ id: faithHolidays.id, date: faithHolidays.date }).from(faithHolidays).where(and(eq(faithHolidays.familyId, viewer.family.id), eq(faithHolidays.faith, faith), eq(faithHolidays.holidayKey, holidayKey)));
        const same = old.filter((o) => o.date.slice(0, 4) === y).map((o) => o.id);
        if (same.length) await db.delete(faithHolidays).where(inArray(faithHolidays.id, same));
      }
      await db.insert(faithHolidays).values({ familyId: viewer.family.id, faith, holidayKey, createdByMemberId: viewer.member.id, ...values });
    }
    refresh();
    revalidatePath("/calendar");
    return ok(holidayKey ? "Date changed for your family." : "Added to your family's holidays.");
  });
}

export async function deleteFaithHoliday(fd: FormData) {
  const viewer = await requireModule(MOD, "view");
  const id = f.str(fd, "id");
  if (!uuidOk(id)) throw new AuthorizationError("Not found.");
  const [r] = await db.select().from(faithHolidays).where(and(eq(faithHolidays.id, id), eq(faithHolidays.familyId, viewer.family.id)));
  if (!r) throw new AuthorizationError("Not found.");
  if (r.createdByMemberId !== viewer.member.id && !viewer.can(MOD, "edit")) throw new AuthorizationError("Only the person who added this (or a parent) can remove it.");
  await db.delete(faithHolidays).where(eq(faithHolidays.id, r.id));
  refresh();
  revalidatePath("/calendar");
}
