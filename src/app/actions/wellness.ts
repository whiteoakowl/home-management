"use server";

import { safePath } from "@/lib/safe-redirect";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { familyMembers, journalEntries, journalEntryFiles, personalHealthProfiles, quoteFavorites, wellnessCheckIns, wellnessGoalMarks, wellnessGoals, wellnessSleep } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { notify } from "@/lib/automation";
import { AuthorizationError, getViewer } from "@/lib/dal";
import { todayIn } from "@/lib/dates";
import { deleteFamilyFile, saveUpload } from "@/lib/files";
import { healthProfile, managedMember } from "@/lib/personal-health";
import { privacyFor } from "@/lib/privacy";
import { QUOTE_CATEGORIES, quoteById } from "@/lib/quotes";
import { f, saveRecordAccess } from "@/lib/records";
import { GOAL_KINDS, INTENSITIES, MOODS, needsSupport } from "@/lib/wellness";
import { DAILY_KEYS } from "@/lib/wellness-insights";

const revalidate = () => revalidatePath("/wellness", "layout");
const clean = (xs: FormDataEntryValue[], max = 20) => [...new Set(xs.map(String).map((x) => x.trim()).filter(Boolean).map((x) => x.slice(0, 40)))].slice(0, max);

/** Daily check-in: mood, feelings, intensity, self-care and a note. One per day (saving again updates it). */
export async function saveCheckIn(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await getViewer();
    const member = await managedMember(viewer, fd.get("memberId"));
    const date = f.date(fd, "date") ?? todayIn(viewer.family.timezone);
    const moodRaw = f.str(fd, "mood");
    const mood = MOODS.some((m) => m.key === moodRaw) ? moodRaw : null;
    const intensityRaw = f.str(fd, "intensity");
    const intensity = INTENSITIES.some((i) => i.key === intensityRaw) ? intensityRaw : null;
    const feelings = clean(fd.getAll("feelings"));
    const selfCare = clean(fd.getAll("selfCare"));
    const note = f.str(fd, "note")?.slice(0, 2000) ?? null;
    const scale = (k: string) => {
      const n = f.int(fd, k);
      return n !== null && n >= 1 && n <= 5 ? n : null;
    };
    const energy = scale("energy");
    const stress = scale("stress");
    const sleepQuality = scale("sleepQuality");
    const answers: Record<string, boolean> = {};
    for (const k of DAILY_KEYS) {
      const v = fd.get(`q_${k}`);
      if (v === "yes" || v === "no") answers[k] = v === "yes";
    }
    if (!mood && !feelings.length && !selfCare.length && !note && !energy && !stress && !sleepQuality && !Object.keys(answers).length) return fail("Pick how you're feeling, or add a note.");
    const values = { mood, feelings, intensity, selfCare, note, energy, stress, sleepQuality, answers, ...(fd.has("shared") ? { shared: f.bool(fd, "shared") } : {}) };
    await db
      .insert(wellnessCheckIns)
      .values({ familyId: viewer.family.id, memberId: member.id, date, ...values })
      .onConflictDoUpdate({ target: [wellnessCheckIns.memberId, wellnessCheckIns.date], set: values });
    revalidate();
    if (needsSupport(note)) redirect("/wellness?support=1");
    return ok("Checked in. Thanks for taking a moment for yourself.");
  });
}

/** "Share today's mood" / "Stop sharing" for one check-in (shared with my Mental Wellness audience). */
export async function setCheckInShared(fd: FormData) {
  const viewer = await getViewer();
  const [c] = await db.select().from(wellnessCheckIns).where(and(eq(wellnessCheckIns.id, String(fd.get("id"))), eq(wellnessCheckIns.familyId, viewer.family.id)));
  if (!c) return;
  await managedMember(viewer, c.memberId);
  await db.update(wellnessCheckIns).set({ shared: fd.get("shared") === "true" }).where(eq(wellnessCheckIns.id, c.id));
  revalidate();
}

/** Visibility for a wellness journal entry: private, or shared with my Mental Wellness audience. */
async function entryVisibility(memberId: string, share: boolean) {
  if (!share) return { visibility: "private" as const, memberIds: [] as string[] };
  const s = await privacyFor(memberId, "wellness");
  if (s.audience === "parents") return { visibility: "parents" as const, memberIds: [] };
  if (s.audience === "selected") return { visibility: "selected" as const, memberIds: s.memberIds };
  return { visibility: "private" as const, memberIds: [] };
}

/** Wellness journal entry (stored in the family journal as book "wellness"; private by default). */
export async function saveWellnessEntry(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await getViewer();
    const id = f.str(fd, "id");
    const existing = id ? (await db.select().from(journalEntries).where(and(eq(journalEntries.id, id), eq(journalEntries.familyId, viewer.family.id), eq(journalEntries.book, "wellness"))))[0] : null;
    if (id && (!existing || existing.authorMemberId !== viewer.member.id)) throw new AuthorizationError("Only you can change your journal.");
    const body = f.str(fd, "body") ?? "";
    const gratitude = clean(fd.getAll("gratitude"), 10).map((g) => g.slice(0, 200));
    const accomplishments = f.str(fd, "accomplishments")?.slice(0, 2000) ?? null;
    const challenges = f.str(fd, "challenges")?.slice(0, 2000) ?? null;
    const hasVoice = fd.get("voice") instanceof File && (fd.get("voice") as File).size > 0;
    if (!body && !gratitude.length && !accomplishments && !challenges && !hasVoice) return fail("Write a few words or record a voice note first. Any of the boxes is fine.", "body");
    const moodRaw = f.str(fd, "mood");
    const intensityRaw = f.str(fd, "intensity");
    const { visibility, memberIds } = await entryVisibility(viewer.member.id, f.bool(fd, "share"));
    const values = {
      familyId: viewer.family.id,
      date: f.date(fd, "date") ?? todayIn(viewer.family.timezone),
      title: f.str(fd, "title")?.slice(0, 200) ?? null,
      body,
      mood: MOODS.some((m) => m.key === moodRaw) ? moodRaw : null,
      tags: f.split(fd, "tags").map((t) => t.toLowerCase().replace(/^#/, "")).slice(0, 20),
      book: "wellness",
      visibility,
      details: {
        feelings: clean(fd.getAll("feelings")),
        intensity: INTENSITIES.some((i) => i.key === intensityRaw) ? intensityRaw : null,
        gratitude,
        accomplishments,
        challenges,
        selfCare: clean(fd.getAll("selfCare")),
        prompt: f.str(fd, "prompt")?.slice(0, 300) ?? null,
      },
    };
    const uploads: string[] = [];
    for (const file of fd.getAll("photos").slice(0, 4)) {
      const fileId = await saveUpload(viewer, file);
      if (fileId) uploads.push(fileId);
    }
    // A voice note (recorded in the app, or picked from the phone).
    const voice = await saveUpload(viewer, fd.get("voice"), { allowAudio: true });
    if (voice) uploads.push(voice);
    let entryId = id;
    await db.transaction(async (tx) => {
      if (existing) await tx.update(journalEntries).set(values).where(eq(journalEntries.id, existing.id));
      else entryId = (await tx.insert(journalEntries).values({ ...values, authorMemberId: viewer.member.id }).returning({ id: journalEntries.id }))[0]!.id;
      if (uploads.length) await tx.insert(journalEntryFiles).values(uploads.map((fileId, i) => ({ entryId: entryId!, fileId, position: i })));
      await saveRecordAccess(tx, viewer.family.id, "journal_entry", entryId!, memberIds);
    });
    revalidate();
    if (needsSupport(body, challenges, accomplishments, ...gratitude)) redirect("/wellness/journal?support=1");
    return ok("Saved to your wellness journal.");
  });
}

export async function deleteWellnessEntry(fd: FormData) {
  const viewer = await getViewer();
  const [e] = await db.select().from(journalEntries).where(and(eq(journalEntries.id, String(fd.get("id"))), eq(journalEntries.familyId, viewer.family.id), eq(journalEntries.book, "wellness")));
  if (!e || e.authorMemberId !== viewer.member.id) return;
  const photos = await db.select().from(journalEntryFiles).where(eq(journalEntryFiles.entryId, e.id));
  await db.delete(journalEntries).where(eq(journalEntries.id, e.id));
  for (const p of photos) await deleteFamilyFile(viewer.family.id, p.fileId);
  revalidate();
}

/** Share or stop sharing one wellness journal entry with my Mental Wellness audience. */
export async function setEntryShared(fd: FormData) {
  const viewer = await getViewer();
  const [e] = await db.select().from(journalEntries).where(and(eq(journalEntries.id, String(fd.get("id"))), eq(journalEntries.familyId, viewer.family.id), eq(journalEntries.book, "wellness")));
  if (!e || e.authorMemberId !== viewer.member.id) return;
  const { visibility, memberIds } = await entryVisibility(viewer.member.id, fd.get("shared") === "true");
  await db.transaction(async (tx) => {
    await tx.update(journalEntries).set({ visibility }).where(eq(journalEntries.id, e.id));
    await saveRecordAccess(tx, viewer.family.id, "journal_entry", e.id, memberIds);
  });
  revalidate();
}

/** Gentle personal goals ("Journal 3 times this week"). */
export async function saveWellnessGoal(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await getViewer();
    const member = await managedMember(viewer, fd.get("memberId"));
    const title = f.str(fd, "title")?.slice(0, 120);
    if (!title) return fail("Name your goal.", "title");
    const kindRaw = f.str(fd, "kind") ?? "custom";
    const kind = GOAL_KINDS.some((k) => k.key === kindRaw) ? kindRaw : "custom";
    const times = Math.min(7, Math.max(1, f.int(fd, "timesPerWeek") ?? 3));
    const id = f.str(fd, "id");
    const cadence = fd.get("cadence") === "daily" ? ("daily" as const) : ("weekly" as const);
    const values = { title, kind, timesPerWeek: cadence === "daily" ? 7 : times, cadence, reminderTime: hhmm(fd.get("reminderTime")), selfCareKey: kind === "self_care" ? f.str(fd, "selfCareKey") : null };
    if (id) {
      const [g] = await db.select().from(wellnessGoals).where(and(eq(wellnessGoals.id, id), eq(wellnessGoals.memberId, member.id)));
      if (!g) throw new AuthorizationError("Goal not found.");
      await db.update(wellnessGoals).set(values).where(eq(wellnessGoals.id, g.id));
    } else await db.insert(wellnessGoals).values({ familyId: viewer.family.id, memberId: member.id, ...values });
    revalidate();
    return ok("Saved.");
  });
}

async function ownGoal(fd: FormData) {
  const viewer = await getViewer();
  const [g] = await db.select().from(wellnessGoals).where(and(eq(wellnessGoals.id, String(fd.get("id"))), eq(wellnessGoals.familyId, viewer.family.id)));
  if (!g) return null;
  await managedMember(viewer, g.memberId);
  return { viewer, g };
}

export async function archiveWellnessGoal(fd: FormData) {
  const r = await ownGoal(fd);
  if (!r) return;
  await db.update(wellnessGoals).set({ archivedAt: r.g.archivedAt ? null : new Date() }).where(eq(wellnessGoals.id, r.g.id));
  revalidate();
}

export async function setGoalShared(fd: FormData) {
  const r = await ownGoal(fd);
  if (!r) return;
  await db.update(wellnessGoals).set({ shared: fd.get("shared") === "true" }).where(eq(wellnessGoals.id, r.g.id));
  revalidate();
}

/** Tick a custom goal for today (or untick). */
export async function toggleGoalMark(fd: FormData) {
  const r = await ownGoal(fd);
  if (!r) return;
  const date = todayIn(r.viewer.family.timezone);
  const [m] = await db.select().from(wellnessGoalMarks).where(and(eq(wellnessGoalMarks.goalId, r.g.id), eq(wellnessGoalMarks.date, date)));
  if (m) await db.delete(wellnessGoalMarks).where(and(eq(wellnessGoalMarks.goalId, r.g.id), eq(wellnessGoalMarks.date, date)));
  else await db.insert(wellnessGoalMarks).values({ goalId: r.g.id, date });
  revalidate();
}

/** Favourite (save) a quote, or remove it. */
export async function toggleQuoteFavorite(fd: FormData) {
  const viewer = await getViewer();
  const id = String(fd.get("quoteId"));
  if (!quoteById(id)) return;
  const [row] = await db.select().from(quoteFavorites).where(and(eq(quoteFavorites.memberId, viewer.member.id), eq(quoteFavorites.quoteId, id)));
  if (row) await db.delete(quoteFavorites).where(and(eq(quoteFavorites.memberId, viewer.member.id), eq(quoteFavorites.quoteId, id)));
  else await db.insert(quoteFavorites).values({ memberId: viewer.member.id, quoteId: id });
  revalidate();
}

export async function saveQuoteNote(_: ActionState, fd: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  const id = String(fd.get("quoteId"));
  if (!quoteById(id)) return fail("Quote not found.");
  const note = f.str(fd, "note")?.slice(0, 1000) ?? null;
  await db.insert(quoteFavorites).values({ memberId: viewer.member.id, quoteId: id, note }).onConflictDoUpdate({ target: [quoteFavorites.memberId, quoteFavorites.quoteId], set: { note } });
  revalidate();
  return ok("Saved with your note.");
}

const FREQS = ["off", "daily", "weekdays", "weekly"];
/** Reminder frequencies, my own feelings & self-care activities, and quote categories. */
export async function saveWellnessSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await getViewer();
    await healthProfile(viewer.family.id, viewer.member.id);
    const reminders = Object.fromEntries(
      (["checkIn", "journal", "gratitude", "selfCare", "goals"] as const).map((k) => {
        const v = String(fd.get(`reminder_${k}`) ?? "off");
        return [k, FREQS.includes(v) ? v : "off"];
      }),
    );
    await db
      .update(personalHealthProfiles)
      .set({
        reminders,
        customFeelings: clean(String(fd.get("customFeelings") ?? "").split(",")),
        customSelfCare: clean(String(fd.get("customSelfCare") ?? "").split(",")),
        quoteCategories: fd.getAll("quoteCategories").map(String).filter((c) => (QUOTE_CATEGORIES as readonly string[]).includes(c)),
      })
      .where(eq(personalHealthProfiles.memberId, viewer.member.id));
    revalidate();
    return ok("Saved.");
  });
}

/** "I'd like to talk": a gentle heads-up to parents. It never shares what you wrote. */
export async function askParentToTalk(fd: FormData) {
  const viewer = await getViewer();
  const parents = await db
    .select({ id: familyMembers.id })
    .from(familyMembers)
    .where(and(eq(familyMembers.familyId, viewer.family.id), eq(familyMembers.role, "parent"), eq(familyMembers.isActive, true)));
  const to = parents.map((p) => p.id).filter((id) => id !== viewer.member.id);
  await notify(viewer.family.id, to, { kind: "wellness_support", title: `${viewer.member.displayName} would like to talk with you`, body: "Find a quiet moment together when you can.", href: "/family" }, todayIn(viewer.family.timezone));
  const back = safePath(fd.get("back"), "/wellness");
  redirect(`${back}${back.includes("?") ? "&" : "?"}asked=1`);
}

// ─── Sleep journal ──────────────────────────────────────────────────────────

const hhmm = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "");
  return /^([01]\d|2[0-3]):[0-5]\d/.test(s) ? s.slice(0, 5) : null;
};

/** Log a night: bedtime, wake time, quality, wake-ups and notes (one per morning; saving again updates it). */
export async function saveSleepEntry(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await getViewer();
    const member = await managedMember(viewer, fd.get("memberId") ?? viewer.member.id);
    const date = f.date(fd, "date") ?? todayIn(viewer.family.timezone);
    if (date > todayIn(viewer.family.timezone)) return fail("That date is in the future.", "date");
    const bedTime = hhmm(fd.get("bedTime"));
    const wakeTime = hhmm(fd.get("wakeTime"));
    const q = f.int(fd, "quality");
    const quality = q !== null && q >= 1 && q <= 5 ? q : null;
    const a = f.int(fd, "awakenings");
    const awakenings = a !== null && a >= 0 && a <= 30 ? a : null;
    const notes = f.str(fd, "notes")?.slice(0, 1000) ?? null;
    if (!bedTime && !wakeTime && !quality && !notes) return fail("Add when you went to bed and woke up, or how you slept.");
    const values = { bedTime, wakeTime, quality, awakenings, notes };
    await db
      .insert(wellnessSleep)
      .values({ familyId: viewer.family.id, memberId: member.id, date, ...values })
      .onConflictDoUpdate({ target: [wellnessSleep.memberId, wellnessSleep.date], set: { ...values, updatedAt: new Date() } });
    revalidate();
    return ok("Saved to your sleep journal.");
  });
}

export async function deleteSleepEntry(fd: FormData) {
  const viewer = await getViewer();
  const [n] = await db.select().from(wellnessSleep).where(and(eq(wellnessSleep.id, String(fd.get("id"))), eq(wellnessSleep.familyId, viewer.family.id)));
  if (!n) return;
  await managedMember(viewer, n.memberId);
  await db.delete(wellnessSleep).where(eq(wellnessSleep.id, n.id));
  revalidate();
}

/** Bedtime reminder and sleep goal (just for you). */
export async function saveSleepSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await getViewer();
    await healthProfile(viewer.family.id, viewer.member.id);
    const goal = Number(fd.get("sleepGoalHours"));
    await db
      .update(personalHealthProfiles)
      .set({ bedtimeReminder: hhmm(fd.get("bedtimeReminder")), sleepGoalHours: String(Number.isFinite(goal) && goal >= 4 && goal <= 14 ? Math.round(goal * 2) / 2 : 8) })
      .where(eq(personalHealthProfiles.memberId, viewer.member.id));
    revalidate();
    return ok("Saved.");
  });
}
