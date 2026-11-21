"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { entityPhotos, familyDates, mediaComments, mediaFavorites, mediaReactions, memories, memoryMedia } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { AuthorizationError, requireModule } from "@/lib/dal";
import { todayIn } from "@/lib/dates";
import { deleteFamilyFile, saveUpload } from "@/lib/files";
import { canSeeEntity, memoryVisible, REACTION_EMOJI } from "@/lib/memories";
import { f, familyMemberIds } from "@/lib/records";

/** Memories & Photos: memories, milestones, comments, reactions, favorites, special dates. */
const MOD = "photos" as const;
const refresh = () => {
  revalidatePath("/memories", "layout");
  revalidatePath("/photos", "layout");
};

async function ownMemory(id: string | null) {
  const viewer = await requireModule(MOD, "use");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new AuthorizationError("Not found.");
  const [m] = await db.select().from(memories).where(and(eq(memories.id, id), memoryVisible(viewer)));
  if (!m) throw new AuthorizationError("Not found.");
  if (m.createdByMemberId !== viewer.member.id && !viewer.can(MOD, "edit")) throw new AuthorizationError("Only the person who added this memory (or a parent) can change it.");
  return { viewer, m };
}

export async function saveMemory(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const id = f.str(fd, "id");
    const { viewer, m } = id ? await ownMemory(id) : { viewer: await requireModule(MOD, "use"), m: null };
    const title = f.str(fd, "title");
    if (!title) return fail("Give the memory a title.", "title");
    const date = f.date(fd, "date") ?? todayIn(viewer.family.timezone);
    const values = {
      title: title.slice(0, 160),
      body: f.str(fd, "body")?.slice(0, 20000) ?? null,
      date,
      kind: f.bool(fd, "milestone") ? "milestone" : "memory",
      memberIds: await familyMemberIds(viewer.family.id, f.list(fd, "people")),
      place: f.str(fd, "place")?.slice(0, 160) ?? null,
      visibility: f.bool(fd, "private") ? "private" : "family",
    };
    let memoryId = m?.id;
    if (m) await db.update(memories).set(values).where(eq(memories.id, m.id));
    else {
      const [row] = await db.insert(memories).values({ ...values, familyId: viewer.family.id, createdByMemberId: viewer.member.id }).returning({ id: memories.id });
      memoryId = row!.id;
    }
    const photos: string[] = [];
    for (const file of fd.getAll("photos").slice(0, 30)) {
      const fileId = await saveUpload(viewer, file);
      if (fileId) photos.push(fileId);
    }
    const media = photos.map((fileId) => ({ fileId, mediaType: "photo" }));
    if (media.length) await db.insert(memoryMedia).values(media.map((x, i) => ({ ...x, memoryId: memoryId!, familyId: viewer.family.id, sort: i })));
    refresh();
    return ok(m ? "Saved." : "Memory added.");
  });
}

export async function deleteMemory(fd: FormData) {
  const { viewer, m } = await ownMemory(f.str(fd, "id"));
  const media = await db.select({ fileId: memoryMedia.fileId }).from(memoryMedia).where(eq(memoryMedia.memoryId, m.id));
  await db.delete(memories).where(eq(memories.id, m.id));
  await db.delete(mediaComments).where(and(eq(mediaComments.entityType, "memory"), eq(mediaComments.entityId, m.id)));
  for (const x of media) await deleteFamilyFile(viewer.family.id, x.fileId);
  refresh();
}

export async function removeMemoryMedia(fd: FormData) {
  const id = f.str(fd, "id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
  const viewer = await requireModule(MOD, "use");
  const [x] = await db.select().from(memoryMedia).where(and(eq(memoryMedia.id, id), eq(memoryMedia.familyId, viewer.family.id)));
  if (!x) return;
  await ownMemory(x.memoryId);
  await db.delete(memoryMedia).where(eq(memoryMedia.id, x.id));
  await deleteFamilyFile(viewer.family.id, x.fileId);
  refresh();
}

// ─── Comments, reactions, favorites (photos and memories) ────────────────────

const entityOf = (fd: FormData) => {
  const type = f.str(fd, "type");
  const id = f.str(fd, "entityId") ?? "";
  if (type !== "photo" && type !== "memory") throw new AuthorizationError("Not found.");
  return { type, id };
};

export async function addMediaComment(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule(MOD, "view");
    const { type, id } = entityOf(fd);
    if (!(await canSeeEntity(viewer, type, id))) return fail("Not found.");
    const body = f.str(fd, "body");
    if (!body) return fail("Write a comment.", "body");
    await db.insert(mediaComments).values({ familyId: viewer.family.id, entityType: type, entityId: id, memberId: viewer.member.id, body: body.slice(0, 1000) });
    refresh();
    return ok();
  });
}

export async function deleteMediaComment(fd: FormData) {
  const viewer = await requireModule(MOD, "view");
  const id = f.str(fd, "id") ?? "";
  const [c] = await db.select().from(mediaComments).where(and(eq(mediaComments.id, id), eq(mediaComments.familyId, viewer.family.id)));
  if (!c) return;
  if (c.memberId !== viewer.member.id && !viewer.isParent) throw new AuthorizationError("You can only delete your own comments.");
  await db.delete(mediaComments).where(eq(mediaComments.id, c.id));
  refresh();
}

export async function toggleMediaReaction(fd: FormData) {
  const viewer = await requireModule(MOD, "view");
  const { type, id } = entityOf(fd);
  const emoji = f.str(fd, "emoji") ?? "";
  if (!(REACTION_EMOJI as readonly string[]).includes(emoji) || !(await canSeeEntity(viewer, type, id))) return;
  const where = and(eq(mediaReactions.entityType, type), eq(mediaReactions.entityId, id), eq(mediaReactions.memberId, viewer.member.id), eq(mediaReactions.emoji, emoji));
  const had = await db.select().from(mediaReactions).where(where);
  if (had.length) await db.delete(mediaReactions).where(where);
  else await db.insert(mediaReactions).values({ familyId: viewer.family.id, entityType: type, entityId: id, memberId: viewer.member.id, emoji }).onConflictDoNothing();
  refresh();
}

export async function toggleFavorite(fd: FormData) {
  const viewer = await requireModule(MOD, "view");
  const { type, id } = entityOf(fd);
  if (!(await canSeeEntity(viewer, type, id))) return;
  const where = and(eq(mediaFavorites.memberId, viewer.member.id), eq(mediaFavorites.entityType, type), eq(mediaFavorites.entityId, id));
  const had = await db.select().from(mediaFavorites).where(where);
  if (had.length) await db.delete(mediaFavorites).where(where);
  else await db.insert(mediaFavorites).values({ familyId: viewer.family.id, memberId: viewer.member.id, entityType: type, entityId: id }).onConflictDoNothing();
  refresh();
}

/** Mark an album photo as a milestone ("First steps!"), or clear it. */
export async function setPhotoMilestone(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule(MOD, "use");
    const id = f.str(fd, "id") ?? "";
    if (!(await canSeeEntity(viewer, "photo", id))) return fail("Not found.");
    const caption = f.str(fd, "caption")?.slice(0, 200) ?? null;
    await db.update(entityPhotos).set({ milestone: f.str(fd, "milestone")?.slice(0, 120) ?? null, caption }).where(and(eq(entityPhotos.id, id), eq(entityPhotos.familyId, viewer.family.id)));
    refresh();
    return ok("Saved.");
  });
}

// ─── Birthdays, anniversaries & other yearly dates ───────────────────────────

export async function saveFamilyDate(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule(MOD, "use");
    const title = f.str(fd, "title");
    if (!title) return fail("What's the occasion?", "title");
    const date = f.str(fd, "date") ?? "";
    const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return fail("Pick the date.", "date");
    const kind = ["anniversary", "birthday", "other"].includes(f.str(fd, "kind") ?? "") ? f.str(fd, "kind")! : "anniversary";
    const remind = f.int(fd, "remindDays");
    const values = {
      title: title.slice(0, 120),
      kind,
      month: Number(m[2]),
      day: Number(m[3]),
      year: f.bool(fd, "yearUnknown") ? null : Number(m[1]),
      memberIds: await familyMemberIds(viewer.family.id, f.list(fd, "people")),
      remindDays: remind !== null && remind >= 0 && remind <= 60 ? remind : 7,
      notes: f.str(fd, "notes")?.slice(0, 1000) ?? null,
    };
    const id = f.str(fd, "id");
    if (id) {
      const [row] = await db.select().from(familyDates).where(and(eq(familyDates.id, id), eq(familyDates.familyId, viewer.family.id)));
      if (!row) return fail("Not found.");
      if (row.createdByMemberId !== viewer.member.id && !viewer.isParent) return fail("Only the person who added this (or a parent) can change it.");
      await db.update(familyDates).set(values).where(eq(familyDates.id, id));
    } else await db.insert(familyDates).values({ ...values, familyId: viewer.family.id, createdByMemberId: viewer.member.id });
    refresh();
    revalidatePath("/calendar");
    return ok("Saved.");
  });
}

export async function deleteFamilyDate(fd: FormData) {
  const viewer = await requireModule(MOD, "use");
  const id = f.str(fd, "id") ?? "";
  const [row] = await db.select().from(familyDates).where(and(eq(familyDates.id, id), eq(familyDates.familyId, viewer.family.id)));
  if (!row) return;
  if (row.createdByMemberId !== viewer.member.id && !viewer.isParent) throw new AuthorizationError("Only the person who added this (or a parent) can remove it.");
  await db.delete(familyDates).where(eq(familyDates.id, id));
  refresh();
  revalidatePath("/calendar");
}

