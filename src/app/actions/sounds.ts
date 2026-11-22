"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { soundMixes, soundPreferences } from "@/db/schema";
import { AuthorizationError, PREMIUM_MESSAGE, requireModule, type Viewer } from "@/lib/dal";
import { canEditMix, cleanMixName, clampVolume, FREE_TIMERS, isFreeSound, isSoundId, MAX_TIMER_MINUTES, presetById, pushRecent, sanitizeMixItems } from "@/lib/sounds/catalog";
import { isUuid, soundPrefs, upsertPrefs, visibleMix } from "@/lib/sounds/data";

/**
 * Sleep Sounds. Everything is personal to the signed-in member and scoped to
 * their household on the server: IDs from the browser are checked against the
 * viewer's family (and ownership) in every query. Sounds themselves are made
 * in the browser; only favourites, mixes, preferences and a short
 * recently-played list are saved.
 *
 * Free: the basic sounds, 15/30/60-minute timers and favourites.
 * Premium: every sound, the mixer and saved mixes, presets, sharing, all
 * timers and fade-out.
 */
export type SoundResult = { ok: true; id?: string } | { ok: false; message: string };

const done = (id?: string): SoundResult => ({ ok: true, ...(id ? { id } : {}) });
const no = (message: string): SoundResult => ({ ok: false, message });

async function run(fn: (viewer: Viewer) => Promise<SoundResult>): Promise<SoundResult> {
  try {
    const viewer = await requireModule("sounds", "use");
    return await fn(viewer);
  } catch (e) {
    if (e instanceof AuthorizationError) return no(e.message);
    console.error("Sleep Sounds action failed");
    return no("Something went wrong. Please try again.");
  }
}

const premiumOnly = (viewer: Viewer) => {
  if (!viewer.premium) throw new AuthorizationError(PREMIUM_MESSAGE);
};

const refresh = () => revalidatePath("/sounds");

// ─── Favourites ─────────────────────────────────────────────────────────────

export async function toggleFavoriteSound(soundId: string): Promise<SoundResult> {
  return run(async (viewer) => {
    if (!isSoundId(soundId)) return no("Unknown sound.");
    if (!viewer.premium && !isFreeSound(soundId)) premiumOnly(viewer);
    const prefs = await soundPrefs(viewer);
    const has = prefs.favoriteSounds.includes(soundId);
    await upsertPrefs(viewer, { favoriteSounds: has ? prefs.favoriteSounds.filter((s) => s !== soundId) : [...prefs.favoriteSounds, soundId].slice(-60) });
    refresh();
    return done();
  });
}

export async function toggleFavoriteMix(mixId: string): Promise<SoundResult> {
  return run(async (viewer) => {
    const mix = await visibleMix(viewer, mixId);
    if (!mix) return no("Mix not found.");
    const prefs = await soundPrefs(viewer);
    const has = prefs.favoriteMixes.includes(mix.id);
    await upsertPrefs(viewer, { favoriteMixes: has ? prefs.favoriteMixes.filter((s) => s !== mix.id) : [...prefs.favoriteMixes, mix.id].slice(-60) });
    refresh();
    return done();
  });
}

// ─── Mixes ──────────────────────────────────────────────────────────────────

/**
 * Create or update a mix. Only the owner changes the name, sharing and
 * editing rights; others may change the sounds only when the owner allowed it.
 */
export async function saveSoundMix(input: { id?: string | null; name: string; items: unknown; isShared?: boolean; allowEdits?: boolean }): Promise<SoundResult> {
  return run(async (viewer) => {
    premiumOnly(viewer);
    const name = cleanMixName(input?.name);
    if (!name) return no("Give your mix a name.");
    const items = sanitizeMixItems(input?.items, { premium: true });
    if (!items.length) return no("Add at least one sound to the mix.");
    const isShared = input?.isShared === true;
    const allowEdits = isShared && input?.allowEdits === true;
    if (input?.id) {
      const mix = await visibleMix(viewer, input.id);
      if (!mix || !canEditMix({ familyId: viewer.family.id, memberId: viewer.member.id }, mix)) return no("You can't change this mix. Duplicate it to make your own version.");
      const owner = mix.memberId === viewer.member.id;
      await db
        .update(soundMixes)
        .set(owner ? { name, items, isShared, allowEdits, updatedAt: new Date() } : { items, updatedAt: new Date() })
        .where(and(eq(soundMixes.id, mix.id), eq(soundMixes.familyId, viewer.family.id)));
      refresh();
      return done(mix.id);
    }
    const count = await db.$count(soundMixes, and(eq(soundMixes.familyId, viewer.family.id), eq(soundMixes.memberId, viewer.member.id)));
    if (count >= 100) return no("You have 100 mixes. Delete one to save another.");
    const [row] = await db.insert(soundMixes).values({ familyId: viewer.family.id, memberId: viewer.member.id, name, items, isShared, allowEdits }).returning({ id: soundMixes.id });
    refresh();
    return done(row!.id);
  });
}

/** Rename a mix (owner only). */
export async function renameSoundMix(id: string, name: string): Promise<SoundResult> {
  return run(async (viewer) => {
    premiumOnly(viewer);
    const clean = cleanMixName(name);
    if (!clean) return no("Give your mix a name.");
    if (!isUuid(id)) return no("Mix not found.");
    const res = await db
      .update(soundMixes)
      .set({ name: clean, updatedAt: new Date() })
      .where(and(eq(soundMixes.id, id), eq(soundMixes.familyId, viewer.family.id), eq(soundMixes.memberId, viewer.member.id)))
      .returning({ id: soundMixes.id });
    if (!res.length) return no("Only the person who made this mix can rename it.");
    refresh();
    return done(id);
  });
}

/** Share a mix with the household (or stop sharing). Owner only. */
export async function shareSoundMix(id: string, isShared: boolean, allowEdits = false): Promise<SoundResult> {
  return run(async (viewer) => {
    premiumOnly(viewer);
    if (!isUuid(id)) return no("Mix not found.");
    const res = await db
      .update(soundMixes)
      .set({ isShared, allowEdits: isShared && allowEdits, updatedAt: new Date() })
      .where(and(eq(soundMixes.id, id), eq(soundMixes.familyId, viewer.family.id), eq(soundMixes.memberId, viewer.member.id)))
      .returning({ id: soundMixes.id });
    if (!res.length) return no("Only the person who made this mix can share it.");
    if (!isShared) await forgetMixForOthers(viewer, id);
    refresh();
    return done(id);
  });
}

/** Make your own copy of a mix you can see (your own, a shared one, or a preset). */
export async function duplicateSoundMix(source: { mixId?: string; presetId?: string }, name?: string): Promise<SoundResult> {
  return run(async (viewer) => {
    premiumOnly(viewer);
    let baseName: string;
    let items;
    if (source?.presetId) {
      const p = presetById(source.presetId);
      if (!p) return no("Preset not found.");
      baseName = p.name;
      items = p.items;
    } else {
      const mix = await visibleMix(viewer, source?.mixId);
      if (!mix) return no("Mix not found.");
      baseName = mix.name;
      items = mix.items;
    }
    const clean = sanitizeMixItems(items, { premium: true });
    const [row] = await db
      .insert(soundMixes)
      .values({ familyId: viewer.family.id, memberId: viewer.member.id, name: cleanMixName(name) || cleanMixName(`${baseName} (my copy)`), items: clean })
      .returning({ id: soundMixes.id });
    refresh();
    return done(row!.id);
  });
}

/** Remove a mix someone else stopped sharing from other members' favourites and recents. */
async function forgetMixForOthers(viewer: Viewer, mixId: string, includeOwner = false) {
  await db
    .update(soundPreferences)
    .set({
      favoriteMixes: sql`array_remove(${soundPreferences.favoriteMixes}, ${mixId}::uuid)`,
      recent: sql`coalesce((select jsonb_agg(e) from jsonb_array_elements(${soundPreferences.recent}) e where e->>'id' <> ${mixId}), '[]'::jsonb)`,
    })
    .where(and(eq(soundPreferences.familyId, viewer.family.id), includeOwner ? undefined : sql`${soundPreferences.memberId} <> ${viewer.member.id}`));
}

/** Delete a mix (owner only), and everyone's favourites and recents of it. */
export async function deleteSoundMix(id: string): Promise<SoundResult> {
  return run(async (viewer) => {
    if (!isUuid(id)) return no("Mix not found.");
    const res = await db
      .delete(soundMixes)
      .where(and(eq(soundMixes.id, id), eq(soundMixes.familyId, viewer.family.id), eq(soundMixes.memberId, viewer.member.id)))
      .returning({ id: soundMixes.id });
    if (!res.length) return no("Only the person who made this mix can delete it.");
    await forgetMixForOthers(viewer, id, true);
    refresh();
    return done();
  });
}

// ─── Recently played ────────────────────────────────────────────────────────

/** Remember what was just played (only the last few, nothing else). */
export async function recordRecentSound(item: { type: "sound" | "mix" | "preset"; id: string }): Promise<SoundResult> {
  return run(async (viewer) => {
    if (item?.type === "sound" ? !isSoundId(item.id) : item?.type === "preset" ? !presetById(item.id) : item?.type === "mix" ? !(await visibleMix(viewer, item.id)) : true) return no("Unknown.");
    const prefs = await soundPrefs(viewer);
    await upsertPrefs(viewer, { recent: pushRecent(prefs.recent, { type: item.type, id: item.id }, new Date().toISOString()) });
    if (item.type === "mix") await db.update(soundMixes).set({ lastPlayedAt: new Date() }).where(and(eq(soundMixes.id, item.id), eq(soundMixes.familyId, viewer.family.id), eq(soundMixes.memberId, viewer.member.id)));
    return done();
  });
}

export async function clearRecentSounds(): Promise<SoundResult> {
  return run(async (viewer) => {
    await upsertPrefs(viewer, { recent: [] });
    refresh();
    return done();
  });
}

// ─── Preferences & reminders ────────────────────────────────────────────────

const REMINDER_KINDS = ["bedtime", "relax", "meditation", "routine"] as const;

export async function saveSoundPreferences(input: {
  defaultVolume?: number;
  defaultTimer?: number;
  fadeOut?: boolean;
  preferredSound?: string | null;
  reminderKind?: string | null;
  reminderTime?: string | null;
  reminderDays?: number[];
}): Promise<SoundResult> {
  return run(async (viewer) => {
    const set: Partial<typeof soundPreferences.$inferInsert> = {};
    if (input?.defaultVolume !== undefined) set.defaultVolume = clampVolume(input.defaultVolume, 60);
    if (input?.defaultTimer !== undefined) {
      const t = Math.round(Number(input.defaultTimer));
      if (!Number.isFinite(t) || t < 0 || t > MAX_TIMER_MINUTES) return no("Choose a timer between 0 and 12 hours.");
      if (!viewer.premium && t !== 0 && !FREE_TIMERS.includes(t)) premiumOnly(viewer);
      set.defaultTimer = t;
    }
    if (input?.fadeOut !== undefined) {
      if (input.fadeOut && !viewer.premium) premiumOnly(viewer);
      set.fadeOut = input.fadeOut === true;
    }
    if (input?.preferredSound !== undefined) {
      if (input.preferredSound !== null && !isSoundId(input.preferredSound)) return no("Unknown sound.");
      if (input.preferredSound && !viewer.premium && !isFreeSound(input.preferredSound)) premiumOnly(viewer);
      set.preferredSound = input.preferredSound;
    }
    if (input?.reminderTime !== undefined) {
      const time = input.reminderTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(input.reminderTime) ? input.reminderTime : null;
      set.reminderTime = time;
      set.reminderKind = time ? (REMINDER_KINDS.find((k) => k === input.reminderKind) ?? "bedtime") : null;
      set.reminderDays = time ? [...new Set((input.reminderDays ?? []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))] : [];
    }
    await upsertPrefs(viewer, set);
    refresh();
    return done();
  });
}
