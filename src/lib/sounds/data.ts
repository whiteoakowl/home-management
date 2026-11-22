import "server-only";
import { and, desc, eq, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { familyMembers, soundMixes, soundPreferences } from "@/db/schema";
import type { Viewer } from "../dal";
import { canEditMix } from "./catalog";

const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export { isUuid };

export const DEFAULT_PREFS = { defaultVolume: 60, defaultTimer: 60, fadeOut: true, preferredSound: null as string | null, favoriteSounds: [] as string[], favoriteMixes: [] as string[], recent: [] as { type: "sound" | "mix" | "preset"; id: string; at: string }[], reminderKind: null as string | null, reminderTime: null as string | null, reminderDays: [] as number[] };

/** This member's Sleep Sounds preferences (defaults until they change something). */
export async function soundPrefs(viewer: Viewer) {
  const [row] = await db.select().from(soundPreferences).where(and(eq(soundPreferences.memberId, viewer.member.id), eq(soundPreferences.familyId, viewer.family.id)));
  return row ?? { ...DEFAULT_PREFS, memberId: viewer.member.id, familyId: viewer.family.id, lastReminderOn: null };
}

/** Make sure the member has a preferences row, then apply `set`. */
export async function upsertPrefs(viewer: Viewer, set: Partial<typeof soundPreferences.$inferInsert>) {
  await db
    .insert(soundPreferences)
    .values({ memberId: viewer.member.id, familyId: viewer.family.id, ...set })
    .onConflictDoUpdate({ target: soundPreferences.memberId, set: { ...set, updatedAt: new Date() } });
}

/** Mixes the viewer may play: their own, plus ones others in their household shared. */
export async function visibleMixes(viewer: Viewer) {
  const rows = await db
    .select({ m: soundMixes, ownerName: familyMembers.displayName })
    .from(soundMixes)
    .innerJoin(familyMembers, eq(familyMembers.id, soundMixes.memberId))
    .where(and(eq(soundMixes.familyId, viewer.family.id), or(eq(soundMixes.memberId, viewer.member.id), eq(soundMixes.isShared, true))))
    .orderBy(desc(soundMixes.updatedAt));
  const me = { familyId: viewer.family.id, memberId: viewer.member.id };
  return rows.map(({ m, ownerName }) => ({
    id: m.id,
    name: m.name,
    items: m.items,
    isShared: m.isShared,
    allowEdits: m.allowEdits,
    mine: m.memberId === viewer.member.id,
    canEdit: canEditMix(me, m),
    ownerName: m.memberId === viewer.member.id ? null : ownerName.split(" ")[0]!,
    updatedAt: m.updatedAt.toISOString(),
  }));
}
export type VisibleMix = Awaited<ReturnType<typeof visibleMixes>>[number];

/** One mix the viewer may see, or null. Always scoped to the viewer's household. */
export async function visibleMix(viewer: Viewer, id: unknown) {
  if (!isUuid(id)) return null;
  const [m] = await db
    .select()
    .from(soundMixes)
    .where(and(eq(soundMixes.id, id), eq(soundMixes.familyId, viewer.family.id), or(eq(soundMixes.memberId, viewer.member.id), eq(soundMixes.isShared, true))));
  return m ?? null;
}

/** Other members' shared mixes count (for the empty state). */
export async function sharedMixCount(viewer: Viewer) {
  const rows = await db.select({ id: soundMixes.id }).from(soundMixes).where(and(eq(soundMixes.familyId, viewer.family.id), eq(soundMixes.isShared, true), ne(soundMixes.memberId, viewer.member.id)));
  return rows.length;
}
