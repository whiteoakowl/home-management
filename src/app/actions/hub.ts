"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { calendarEvents, contacts, entityPhotos, familyMessages, files, messageReactions, photoAlbums, pollVotes } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { AuthorizationError, getViewer, requireModule } from "@/lib/dal";
import { deleteFamilyFile, familyVideos, saveUpload } from "@/lib/files";
import { f, familyMemberIds } from "@/lib/records";
import { CONTACT_CATEGORIES, markRead } from "@/lib/hub";
import { pushChat } from "@/lib/push-chat";
import { canPostChannel, canSeeChannel, EMOJI, REACTIONS, type Channel } from "@/lib/hub-shared";

const uuidOk = (v: string | null | undefined): v is string => !!v && /^[0-9a-f-]{36}$/i.test(v);

// ─── Family Chat ─────────────────────────────────────────────────────────────

const chatChannel = (v: unknown) => (["all", "parents", "kids", "announcements"].includes(String(v)) ? (String(v) as Channel) : "all");

/** A message in this family that the viewer may see. */
async function visibleMessage(viewer: Awaited<ReturnType<typeof requireModule>>, id: string) {
  if (!uuidOk(id)) throw new AuthorizationError("Message not found.");
  const [m] = await db.select().from(familyMessages).where(and(eq(familyMessages.id, id), eq(familyMessages.familyId, viewer.family.id)));
  if (!m || !canSeeChannel(viewer.isParent, m.channel)) throw new AuthorizationError("Message not found.");
  return m;
}

const chatChanged = async (viewer: { family: { id: string }; member: { id: string } }) => {
  await markRead(viewer.family.id, viewer.member.id);
  revalidatePath("/messages");
  revalidatePath("/", "layout");
};

/** Send a message, photo or file to one of the family's chats. */
export async function sendMessage(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("messages", "use");
    const channel = chatChannel(fd.get("channel"));
    if (!canPostChannel(viewer.isParent, channel)) return fail(channel === "announcements" ? "Only parents can post announcements." : "You can't post in this chat.");
    const body = f.str(fd, "body")?.slice(0, 4000) ?? null;
    const photo = await saveUpload(viewer, fd.get("photo"));
    const file = photo ? null : await saveUpload(viewer, fd.get("file"), { allowDocs: true });
    if (!body && !photo && !file) return fail("Type a message, or add a photo or file.", "body");
    await db.insert(familyMessages).values({ familyId: viewer.family.id, memberId: viewer.member.id, body, fileId: photo ?? file, channel, kind: photo ? "photo" : file ? "file" : "text" });
    pushChat(viewer.family.id, viewer.member, channel, body || (photo ? "📷 Photo" : "📎 File"));
    await chatChanged(viewer);
    return { ok: true };
  });
}

/** A poll: a question with 2–6 choices; everyone votes once (and can change it). */
export async function sendPoll(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("messages", "use");
    const channel = chatChannel(fd.get("channel"));
    if (!canPostChannel(viewer.isParent, channel)) return fail("You can't post in this chat.");
    const question = f.str(fd, "question")?.slice(0, 200);
    if (!question) return fail("What's the question?", "question");
    const options = fd
      .getAll("option")
      .map((o) => String(o).trim().slice(0, 80))
      .filter(Boolean)
      .slice(0, 6);
    if (new Set(options.map((o) => o.toLowerCase())).size < 2) return fail("Add at least two different choices.", "option");
    await db.insert(familyMessages).values({
      familyId: viewer.family.id,
      memberId: viewer.member.id,
      channel,
      kind: "poll",
      body: question,
      poll: { question, options: options.map((text, i) => ({ id: String(i + 1), text })) },
    });
    pushChat(viewer.family.id, viewer.member, channel, `📊 Poll: ${question}`);
    await chatChanged(viewer);
    return ok("Poll posted.");
  });
}

export async function votePoll(fd: FormData) {
  const viewer = await requireModule("messages", "use");
  const m = await visibleMessage(viewer, String(fd.get("id") ?? ""));
  const option = String(fd.get("option") ?? "");
  if (m.kind !== "poll" || !m.poll?.options.some((o) => o.id === option)) return;
  const [mine] = await db.select().from(pollVotes).where(and(eq(pollVotes.messageId, m.id), eq(pollVotes.memberId, viewer.member.id)));
  if (mine?.optionId === option) await db.delete(pollVotes).where(and(eq(pollVotes.messageId, m.id), eq(pollVotes.memberId, viewer.member.id)));
  else
    await db
      .insert(pollVotes)
      .values({ messageId: m.id, memberId: viewer.member.id, familyId: viewer.family.id, optionId: option })
      .onConflictDoUpdate({ target: [pollVotes.messageId, pollVotes.memberId], set: { optionId: option, createdAt: new Date() } });
  revalidatePath("/messages");
}

/** Share a calendar event in the chat (shows as an event card). Only events the whole family can see. */
export async function shareEvent(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("messages", "use");
    const channel = chatChannel(fd.get("channel"));
    if (!canPostChannel(viewer.isParent, channel)) return fail("You can't post in this chat.");
    const eventId = String(fd.get("eventId") ?? "");
    if (!uuidOk(eventId)) return fail("Choose an event.", "eventId");
    const [ev] = await db
      .select({ id: calendarEvents.id, title: calendarEvents.title })
      .from(calendarEvents)
      .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.familyId, viewer.family.id), eq(calendarEvents.visibility, "family")));
    if (!ev) return fail("Choose an event the whole family can see.", "eventId");
    await db.insert(familyMessages).values({ familyId: viewer.family.id, memberId: viewer.member.id, channel, kind: "event", eventId: ev.id, body: f.str(fd, "note")?.slice(0, 500) ?? null });
    pushChat(viewer.family.id, viewer.member, channel, `📅 ${ev.title}`);
    await chatChanged(viewer);
    return ok("Event shared.");
  });
}

/** Add or remove your emoji reaction. */
export async function toggleReaction(fd: FormData) {
  const viewer = await requireModule("messages", "use");
  const m = await visibleMessage(viewer, String(fd.get("id") ?? ""));
  const emoji = String(fd.get("emoji") ?? "");
  if (![...REACTIONS, ...EMOJI].includes(emoji)) return;
  const removed = await db
    .delete(messageReactions)
    .where(and(eq(messageReactions.messageId, m.id), eq(messageReactions.memberId, viewer.member.id), eq(messageReactions.emoji, emoji)))
    .returning();
  if (!removed.length) await db.insert(messageReactions).values({ messageId: m.id, memberId: viewer.member.id, familyId: viewer.family.id, emoji }).onConflictDoNothing();
  revalidatePath("/messages");
}

/** Pin or unpin (parents, or whoever wrote it). */
export async function togglePin(fd: FormData) {
  const viewer = await requireModule("messages", "use");
  const m = await visibleMessage(viewer, String(fd.get("id") ?? ""));
  if (!viewer.isParent && m.memberId !== viewer.member.id) throw new AuthorizationError("Only parents can pin other people's messages.");
  await db
    .update(familyMessages)
    .set(m.pinnedAt ? { pinnedAt: null, pinnedByMemberId: null } : { pinnedAt: new Date(), pinnedByMemberId: viewer.member.id })
    .where(eq(familyMessages.id, m.id));
  revalidatePath("/messages");
}

export async function deleteMessage(fd: FormData) {
  const viewer = await requireModule("messages", "use");
  const m = await visibleMessage(viewer, String(fd.get("id") ?? ""));
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
  // Private albums: only the person who made them.
  if (!a || (a.private && a.createdByMemberId !== viewer.member.id)) throw new AuthorizationError("Album not found.");
  if (change && a.createdByMemberId !== viewer.member.id && !viewer.can("photos", "edit")) throw new AuthorizationError("Only the person who made this album (or a parent) can change it.");
  return { viewer, a };
}

export async function saveAlbum(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("photos", "use");
    const id = f.str(fd, "id");
    const title = f.str(fd, "title");
    if (!title) return fail("Name the album.", "title");
    const owner = f.str(fd, "ownerMemberId");
    const values = {
      title: title.slice(0, 120),
      description: f.str(fd, "description"),
      eventDate: f.date(fd, "eventDate"),
      ownerMemberId: owner ? ((await familyMemberIds(viewer.family.id, [owner]))[0] ?? null) : null,
      private: f.bool(fd, "private"),
    };
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
    const videos = await familyVideos(viewer.family.id, f.list(fd, "videoIds"));
    if (!ids.length && !videos.length) return fail("Choose at least one photo or video.", "photos");
    const caption = f.str(fd, "caption")?.slice(0, 200) ?? null;
    const milestone = f.str(fd, "milestone")?.slice(0, 120) ?? null;
    // Date order: when each photo was taken (camera data), else now.
    const taken = new Map((await db.select({ id: files.id, at: files.takenAt }).from(files).where(inArray(files.id, ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]))).map((r) => [r.id, r.at]));
    await db.insert(entityPhotos).values([
      ...ids.map((fileId) => ({ familyId: viewer.family.id, entityType: "album", entityId: a.id, fileId, caption, milestone, mediaType: "photo", takenAt: taken.get(fileId) ?? new Date(), createdByMemberId: viewer.member.id })),
      ...videos.map((fileId) => ({ familyId: viewer.family.id, entityType: "album", entityId: a.id, fileId, caption, milestone, mediaType: "video", takenAt: new Date(), createdByMemberId: viewer.member.id })),
    ]);
    await db.update(photoAlbums).set({ updatedAt: new Date() }).where(eq(photoAlbums.id, a.id));
    revalidatePath("/photos", "layout");
    revalidatePath("/memories", "layout");
    const n = ids.length + videos.length;
    return ok(`${n} ${videos.length && !ids.length ? "video" : "item"}${n === 1 ? "" : "s"} added.`);
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
