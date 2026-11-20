"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { animals, entityPhotos, familyMembers, pets, plants } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { AuthorizationError, getFamilyMember, getViewer, type Viewer } from "@/lib/dal";
import { deleteFamilyFile, saveUpload } from "@/lib/files";
import { f } from "@/lib/records";

type Kind = "animal" | "plant" | "member";
const PATHS: Record<Kind, (id: string) => string> = { animal: (id) => `/farm/animals/${id}`, plant: (id) => `/garden/plants/${id}`, member: (id) => `/family/${id}` };

/** May the viewer add/remove album photos for this animal / plant / person? */
async function assertCanEdit(viewer: Viewer, kind: Kind, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new AuthorizationError("Not found.");
  if (kind === "animal") {
    if (!viewer.can("farm", "edit")) throw new AuthorizationError("You can't add farm photos.");
    const [a] = await db.select({ id: animals.id }).from(animals).where(and(eq(animals.id, id), eq(animals.familyId, viewer.family.id)));
    if (!a) throw new AuthorizationError("Animal not found.");
  } else if (kind === "plant") {
    if (!viewer.can("garden", "edit")) throw new AuthorizationError("You can't add garden photos.");
    const [p] = await db.select({ id: plants.id }).from(plants).where(and(eq(plants.id, id), or(eq(plants.familyId, viewer.family.id), isNull(plants.familyId))));
    if (!p) throw new AuthorizationError("Plant not found.");
  } else {
    // Your own album, or (for parents) anyone's in the family.
    if (id !== viewer.member.id && !viewer.isParent) throw new AuthorizationError("Only parents can add photos to someone else's album.");
    if (!(await getFamilyMember(viewer, id))) throw new AuthorizationError("Family member not found.");
  }
}

/** Add one or more photos (with an optional caption) to an album. */
export async function addAlbumPhotos(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await getViewer();
    const kind = String(fd.get("kind")) as Kind;
    if (!(kind in PATHS)) return fail("Unknown album.");
    const id = String(fd.get("entityId") ?? "");
    await assertCanEdit(viewer, kind, id);
    const ids: string[] = [];
    for (const file of fd.getAll("photos").slice(0, 12)) {
      const fileId = await saveUpload(viewer, file);
      if (fileId) ids.push(fileId);
    }
    if (!ids.length) return fail("Choose at least one photo.", "photos");
    const caption = f.str(fd, "caption")?.slice(0, 200) ?? null;
    await db.insert(entityPhotos).values(ids.map((fileId) => ({ familyId: viewer.family.id, entityType: kind, entityId: id, fileId, caption, createdByMemberId: viewer.member.id })));
    // No revalidatePath here: rebuilding a busy page (like a member's dashboard) inside this
    // upload request can run past the host's time limit. The form refreshes the page itself.
    return ok(`${ids.length} photo${ids.length === 1 ? "" : "s"} added.`);
  });
}

export async function deleteAlbumPhoto(fd: FormData) {
  const viewer = await getViewer();
  const [p] = await db.select().from(entityPhotos).where(and(eq(entityPhotos.id, String(fd.get("id"))), eq(entityPhotos.familyId, viewer.family.id)));
  if (!p) return;
  await assertCanEdit(viewer, p.entityType as Kind, p.entityId);
  if (!viewer.isParent && p.createdByMemberId !== viewer.member.id && !(p.entityType === "member" && p.entityId === viewer.member.id)) throw new AuthorizationError("Only the person who added this photo (or a parent) can remove it.");
  await db.delete(entityPhotos).where(eq(entityPhotos.id, p.id));
  await deleteFamilyFile(viewer.family.id, p.fileId);
  revalidatePath(PATHS[p.entityType as Kind](p.entityId));
}

/** A family member's profile photo (shown on their avatar everywhere). Yourself, or anyone for parents. */
export async function saveProfilePhoto(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await getViewer();
    const memberId = String(fd.get("memberId") ?? viewer.member.id);
    if (memberId !== viewer.member.id && !viewer.isParent) throw new AuthorizationError("Only parents can change someone else's photo.");
    const m = await getFamilyMember(viewer, memberId);
    if (!m) return fail("Family member not found.");
    const remove = fd.get("removeImage") === "1";
    const fileId = await saveUpload(viewer, fd.get("image"));
    if (!fileId && !remove) return fail("Choose a photo.", "image");
    await db.update(familyMembers).set({ avatarFileId: fileId }).where(eq(familyMembers.id, m.id));
    if (m.avatarFileId) await deleteFamilyFile(viewer.family.id, m.avatarFileId);
    // No revalidatePath here: rebuilding a busy page (like a member's dashboard) inside this
    // upload request can run past the host's time limit. The form refreshes the page itself.
    return ok(fileId ? "Profile photo updated." : "Profile photo removed.");
  });
}

/** Profile photo for a pet or farm animal (replaces the stock picture). */
export async function saveMainPhoto(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await getViewer();
    const kind = String(fd.get("kind"));
    const id = String(fd.get("entityId") ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Not found.");
    const table = kind === "pet" ? pets : kind === "animal" ? animals : null;
    if (!table) return fail("Unknown kind.");
    if (!viewer.can(kind === "pet" ? "pets" : "farm", "edit")) throw new AuthorizationError("You can't change this photo.");
    const [row] = await db.select({ id: table.id, old: table.imageFileId }).from(table).where(and(eq(table.id, id), eq(table.familyId, viewer.family.id)));
    if (!row) return fail("Not found.");
    const remove = fd.get("removeImage") === "1";
    const fileId = await saveUpload(viewer, fd.get("image"));
    if (!fileId && !remove) return fail("Choose a photo.", "image");
    await db.update(table).set({ imageFileId: fileId }).where(eq(table.id, row.id));
    if (row.old) await deleteFamilyFile(viewer.family.id, row.old);
    // No revalidatePath here: rebuilding a busy page (like a member's dashboard) inside this
    // upload request can run past the host's time limit. The form refreshes the page itself.
    return ok(fileId ? "Photo updated." : "Photo removed.");
  });
}
