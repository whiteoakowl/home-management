"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts, entityPhotos, familyMessages, photoAlbums } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { AuthorizationError, getViewer, requireModule } from "@/lib/dal";
import { deleteFamilyFile, saveUpload } from "@/lib/files";
import { f } from "@/lib/records";
import { CONTACT_CATEGORIES, markRead } from "@/lib/hub";

const uuidOk = (v: string | null | undefined): v is string => !!v && /^[0-9a-f-]{36}$/i.test(v);

// ─── Family Chat ─────────────────────────────────────────────────────────────

export async function sendMessage(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("messages", "use");
    const body = f.str(fd, "body")?.slice(0, 4000) ?? null;
    const fileId = await saveUpload(viewer, fd.get("photo"));
    if (!body && !fileId) return fail("Type a message or add a photo.", "body");
    await db.insert(familyMessages).values({ familyId: viewer.family.id, memberId: viewer.member.id, body, fileId });
    await markRead(viewer.family.id, viewer.member.id);
    revalidatePath("/messages");
    revalidatePath("/", "layout");
    return { ok: true };
  });
}

export async function deleteMessage(fd: FormData) {
  const viewer = await requireModule("messages", "use");
  const id = String(fd.get("id") ?? "");
  if (!uuidOk(id)) return;
  const [m] = await db.select().from(familyMessages).where(and(eq(familyMessages.id, id), eq(familyMessages.familyId, viewer.family.id)));
  if (!m) return;
  if (m.memberId !== viewer.member.id && !viewer.isParent) throw new AuthorizationError("You can only delete your own messages.");
  await db.delete(familyMessages).where(eq(familyMessages.id, m.id));
  await deleteFamilyFile(viewer.family.id, m.fileId);
  revalidatePath("/messages");
}

// ─── Contacts ────────────────────────────────────────────────────────────────

async function ownContact(id: string | null) {
  const viewer = await requireModule("contacts", "use");
  if (!uuidOk(id)) throw new AuthorizationError("Contact not found.");
  const [c] = await db.select().from(contacts).where(and(eq(contacts.id, id), eq(contacts.familyId, viewer.family.id)));
  if (!c || (c.private && c.createdByMemberId !== viewer.member.id)) throw new AuthorizationError("Contact not found.");
  if (c.createdByMemberId !== viewer.member.id && !viewer.can("contacts", "edit")) throw new AuthorizationError("You can only change contacts you added.");
  return { viewer, c };
}

export async function saveContact(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("contacts", "use");
    const id = f.str(fd, "id");
    const name = f.str(fd, "name");
    if (!name) return fail("Add a name.", "name");
    const category = f.str(fd, "category") ?? "friends";
    const email = f.str(fd, "email");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("That email doesn't look right.", "email");
    const values = {
      name: name.slice(0, 200),
      category: (CONTACT_CATEGORIES as readonly string[]).includes(category) ? category : "other",
      relationship: f.str(fd, "relationship"),
      phone: f.str(fd, "phone"),
      altPhone: f.str(fd, "altPhone"),
      email,
      address: f.str(fd, "address"),
      birthday: f.date(fd, "birthday"),
      notes: f.str(fd, "notes"),
      favorite: f.bool(fd, "favorite"),
      private: f.bool(fd, "private"),
    };
    if (id) {
      const { c } = await ownContact(id);
      // Only the person who added a contact can make it private.
      if (values.private && c.createdByMemberId !== viewer.member.id) values.private = c.private;
      await db.update(contacts).set(values).where(eq(contacts.id, c.id));
    } else {
      await db.insert(contacts).values({ ...values, familyId: viewer.family.id, createdByMemberId: viewer.member.id });
    }
    revalidatePath("/contacts");
    revalidatePath("/calendar", "layout");
    return ok(id ? "Contact saved." : "Contact added.");
  });
}

export async function deleteContact(fd: FormData) {
  const { c } = await ownContact(f.str(fd, "id"));
  await db.delete(contacts).where(eq(contacts.id, c.id));
  revalidatePath("/contacts");
  revalidatePath("/calendar", "layout");
}

export async function toggleFavoriteContact(fd: FormData) {
  const viewer = await requireModule("contacts", "use");
  const id = f.str(fd, "id");
  if (!uuidOk(id)) return;
  const [c] = await db.select().from(contacts).where(and(eq(contacts.id, id), eq(contacts.familyId, viewer.family.id)));
  if (!c || (c.private && c.createdByMemberId !== viewer.member.id)) return;
  await db.update(contacts).set({ favorite: !c.favorite }).where(eq(contacts.id, c.id));
  revalidatePath("/contacts");
}

// ─── Photo albums ────────────────────────────────────────────────────────────

async function album(id: string | null, change = false) {
  const viewer = await requireModule("photos", "use");
  if (!uuidOk(id)) throw new AuthorizationError("Album not found.");
  const [a] = await db.select().from(photoAlbums).where(and(eq(photoAlbums.id, id), eq(photoAlbums.familyId, viewer.family.id)));
  if (!a) throw new AuthorizationError("Album not found.");
  if (change && a.createdByMemberId !== viewer.member.id && !viewer.can("photos", "edit")) throw new AuthorizationError("Only the person who made this album (or a parent) can change it.");
  return { viewer, a };
}

export async function saveAlbum(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("photos", "use");
    const id = f.str(fd, "id");
    const title = f.str(fd, "title");
    if (!title) return fail("Name the album.", "title");
    const values = { title: title.slice(0, 120), description: f.str(fd, "description"), eventDate: f.date(fd, "eventDate") };
    if (id) {
      const { a } = await album(id, true);
      await db.update(photoAlbums).set(values).where(eq(photoAlbums.id, a.id));
      revalidatePath("/photos", "layout");
      return ok("Album saved.");
    }
    const [created] = await db.insert(photoAlbums).values({ ...values, familyId: viewer.family.id, createdByMemberId: viewer.member.id }).returning({ id: photoAlbums.id });
    revalidatePath("/photos");
    redirect(`/photos/${created!.id}`);
  });
}

export async function deleteAlbum(fd: FormData) {
  const { viewer, a } = await album(f.str(fd, "id"), true);
  const photos = await db.select().from(entityPhotos).where(and(eq(entityPhotos.entityType, "album"), eq(entityPhotos.entityId, a.id)));
  await db.delete(entityPhotos).where(and(eq(entityPhotos.entityType, "album"), eq(entityPhotos.entityId, a.id)));
  for (const p of photos) await deleteFamilyFile(viewer.family.id, p.fileId);
  await db.delete(photoAlbums).where(eq(photoAlbums.id, a.id));
  revalidatePath("/photos", "layout");
  redirect("/photos");
}

export async function addPhotosToAlbum(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const { viewer, a } = await album(f.str(fd, "albumId"));
    const ids: string[] = [];
    for (const file of fd.getAll("photos").slice(0, 20)) {
      const fileId = await saveUpload(viewer, file);
      if (fileId) ids.push(fileId);
    }
    if (!ids.length) return fail("Choose at least one photo.", "photos");
    const caption = f.str(fd, "caption")?.slice(0, 200) ?? null;
    await db.insert(entityPhotos).values(ids.map((fileId) => ({ familyId: viewer.family.id, entityType: "album", entityId: a.id, fileId, caption, createdByMemberId: viewer.member.id })));
    await db.update(photoAlbums).set({ updatedAt: new Date() }).where(eq(photoAlbums.id, a.id));
    revalidatePath("/photos", "layout");
    return ok(`${ids.length} photo${ids.length === 1 ? "" : "s"} added.`);
  });
}

export async function deleteAlbumPhotoItem(fd: FormData) {
  const viewer = await getViewer();
  const id = f.str(fd, "id");
  if (!uuidOk(id)) return;
  const [p] = await db.select().from(entityPhotos).where(and(eq(entityPhotos.id, id), eq(entityPhotos.familyId, viewer.family.id), eq(entityPhotos.entityType, "album")));
  if (!p) return;
  if (p.createdByMemberId !== viewer.member.id && !viewer.can("photos", "edit")) throw new AuthorizationError("Only the person who added this photo (or a parent) can remove it.");
  await db.delete(entityPhotos).where(eq(entityPhotos.id, p.id));
  await deleteFamilyFile(viewer.family.id, p.fileId);
  revalidatePath("/photos", "layout");
}
