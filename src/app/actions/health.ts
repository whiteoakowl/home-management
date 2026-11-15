"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { periodDays, personalHealthProfiles } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { getViewer } from "@/lib/dal";
import { healthProfile, managedMember } from "@/lib/personal-health";
import { f } from "@/lib/records";

const FLOW_KEYS = ["none", "spotting", "light", "medium", "heavy"];
const clean = (xs: string[], max = 40) => [...new Set(xs.map((x) => x.trim()).filter(Boolean).map((x) => x.slice(0, 40)))].slice(0, max);


/** Record (or clear) one day in the period tracker. */
export async function savePeriodDay(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await getViewer();
    const member = await managedMember(viewer, fd.get("memberId"));
    const date = f.date(fd, "date");
    if (!date) return fail("Pick a day.", "date");
    const flowRaw = f.str(fd, "flow");
    const flow = flowRaw && FLOW_KEYS.includes(flowRaw) ? flowRaw : null;
    const symptoms = clean(fd.getAll("symptoms").map(String));
    const feelings = clean(fd.getAll("feelings").map(String));
    const intensity = f.int(fd, "moodIntensity");
    const moodIntensity = intensity && intensity >= 1 && intensity <= 3 ? intensity : null;
    const note = f.str(fd, "note")?.slice(0, 2000) ?? null;
    if (!flow && !symptoms.length && !feelings.length && !note && !moodIntensity) {
      await db.delete(periodDays).where(and(eq(periodDays.memberId, member.id), eq(periodDays.date, date)));
    } else {
      const values = { flow, symptoms, feelings, moodIntensity, note };
      await db
        .insert(periodDays)
        .values({ familyId: viewer.family.id, memberId: member.id, date, ...values })
        .onConflictDoUpdate({ target: [periodDays.memberId, periodDays.date], set: values });
    }
    revalidatePath("/health", "layout");
    return ok("Saved.");
  });
}

/** Period tracker on/off, typical lengths (used until enough cycles are recorded), custom symptoms & feelings. */
export async function savePeriodSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await getViewer();
    const member = await managedMember(viewer, fd.get("memberId"));
    await healthProfile(viewer.family.id, member.id);
    const cycle = f.int(fd, "typicalCycleLength");
    const period = f.int(fd, "typicalPeriodLength");
    if (cycle !== null && (cycle < 15 || cycle > 60)) return fail("Enter a typical cycle between 15 and 60 days.", "typicalCycleLength");
    if (period !== null && (period < 1 || period > 14)) return fail("Enter a typical period between 1 and 14 days.", "typicalPeriodLength");
    await db
      .update(personalHealthProfiles)
      .set({
        periodEnabled: fd.has("periodEnabled") ? f.bool(fd, "periodEnabled") : undefined,
        ...(cycle !== null ? { typicalCycleLength: cycle } : {}),
        ...(period !== null ? { typicalPeriodLength: period } : {}),
        ...(fd.has("customSymptoms") ? { customSymptoms: clean(String(fd.get("customSymptoms")).split(",")) } : {}),
        ...(fd.has("customFeelings") ? { customFeelings: clean(String(fd.get("customFeelings")).split(",")) } : {}),
      })
      .where(eq(personalHealthProfiles.memberId, member.id));
    revalidatePath("/health", "layout");
    return ok("Saved.");
  });
}

/** Turn the period tracker on for myself (one tap from Personal Health). */
export async function enablePeriodTracker() {
  const viewer = await getViewer();
  await healthProfile(viewer.family.id, viewer.member.id);
  await db.update(personalHealthProfiles).set({ periodEnabled: true }).where(eq(personalHealthProfiles.memberId, viewer.member.id));
  revalidatePath("/health", "layout");
}
