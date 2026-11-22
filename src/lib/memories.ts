import "server-only";
import { and, count, desc, eq, ilike, inArray, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { entityPhotos, familyDates, familyMembers, mediaComments, mediaFavorites, mediaReactions, memories, memoryMedia, photoAlbums, plans, contacts } from "@/db/schema";
import type { Viewer } from "./dal";

/** Memories this person can see: the family's, plus their own private ones. */
export const memoryVisible = (viewer: Viewer): SQL => and(eq(memories.familyId, viewer.family.id), or(eq(memories.visibility, "family"), eq(memories.createdByMemberId, viewer.member.id)))!;

/** Albums this person can see: family albums, plus their own private ones. */
export const albumVisible = (viewer: Viewer): SQL => and(eq(photoAlbums.familyId, viewer.family.id), or(eq(photoAlbums.private, false), eq(photoAlbums.createdByMemberId, viewer.member.id)))!;

export const REACTION_EMOJI = ["❤️", "😂", "😮", "😢", "👏", "🎉"] as const;

/** Can this person see the photo or memory a comment/reaction/favorite is about? */
export async function canSeeEntity(viewer: Viewer, type: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
  if (type === "memory") return (await db.select({ id: memories.id }).from(memories).where(and(eq(memories.id, id), memoryVisible(viewer)))).length > 0;
  if (type === "photo") {
    const [p] = await db.select({ entityType: entityPhotos.entityType, entityId: entityPhotos.entityId }).from(entityPhotos).where(and(eq(entityPhotos.id, id), eq(entityPhotos.familyId, viewer.family.id)));
    if (!p) return false;
    if (p.entityType !== "album") return true;
    return (await db.select({ id: photoAlbums.id }).from(photoAlbums).where(and(eq(photoAlbums.id, p.entityId), albumVisible(viewer)))).length > 0;
  }
  return false;
}

/** Comments, reactions and my favorites for a set of photos or memories. */
export async function socialFor(viewer: Viewer, type: "photo" | "memory", ids: string[]) {
  if (!ids.length) return { comments: [], reactions: [], favorites: new Set<string>() };
  const [comments, reactions, favs] = await Promise.all([
    db
      .select({ id: mediaComments.id, entityId: mediaComments.entityId, body: mediaComments.body, createdAt: mediaComments.createdAt, memberId: mediaComments.memberId, name: familyMembers.displayName, kidName: familyMembers.kidName, role: familyMembers.role, color: familyMembers.color })
      .from(mediaComments)
      .innerJoin(familyMembers, eq(familyMembers.id, mediaComments.memberId))
      .where(and(eq(mediaComments.familyId, viewer.family.id), eq(mediaComments.entityType, type), inArray(mediaComments.entityId, ids)))
      .orderBy(mediaComments.createdAt),
    db.select().from(mediaReactions).where(and(eq(mediaReactions.familyId, viewer.family.id), eq(mediaReactions.entityType, type), inArray(mediaReactions.entityId, ids))),
    db.select({ id: mediaFavorites.entityId }).from(mediaFavorites).where(and(eq(mediaFavorites.memberId, viewer.member.id), eq(mediaFavorites.entityType, type), inArray(mediaFavorites.entityId, ids))),
  ]);
  return { comments, reactions, favorites: new Set(favs.map((f) => f.id)) };
}

export type TimelineItem =
  | { type: "memory"; id: string; date: string; title: string; body: string | null; milestone: boolean; memberIds: string[]; place: string | null; media: { fileId: string; mediaType: string }[]; mine: boolean; private: boolean }
  | { type: "album"; id: string; date: string; title: string; count: number; cover: string | null }
  | { type: "trip"; id: string; date: string; endDate: string | null; title: string; destination: string | null }
  | { type: "photo"; id: string; date: string; title: string; fileId: string; mediaType: string; albumId: string };

/** The family timeline: memories, milestone photos, albums and trips, newest first. */
export async function timeline(viewer: Viewer, opts: { year?: number; q?: string; memberId?: string; milestones?: boolean }) {
  const q = opts.q?.trim() ? `%${opts.q.trim().replace(/[%_\\]/g, "\\$&")}%` : null;
  const inYear = <T extends SQL | undefined>(col: unknown) => (opts.year ? sql`extract(year from ${col}) = ${opts.year}` : undefined) as T;
  const mem = await db
    .select()
    .from(memories)
    .where(
      and(
        memoryVisible(viewer),
        inYear(memories.date),
        opts.milestones ? eq(memories.kind, "milestone") : undefined,
        opts.memberId ? sql`${opts.memberId}::uuid = any(${memories.memberIds})` : undefined,
        q ? or(ilike(memories.title, q), ilike(memories.body, q), ilike(memories.place, q)) : undefined,
      ),
    )
    .orderBy(desc(memories.date), desc(memories.createdAt))
    .limit(300);
  const media = mem.length ? await db.select().from(memoryMedia).where(inArray(memoryMedia.memoryId, mem.map((m) => m.id))).orderBy(memoryMedia.sort, memoryMedia.createdAt) : [];
  const items: TimelineItem[] = mem.map((m) => ({
    type: "memory",
    id: m.id,
    date: m.date,
    title: m.title,
    body: m.body,
    milestone: m.kind === "milestone",
    memberIds: m.memberIds,
    place: m.place,
    media: media.filter((x) => x.memoryId === m.id).map((x) => ({ fileId: x.fileId, mediaType: x.mediaType })),
    mine: m.createdByMemberId === viewer.member.id,
    private: m.visibility === "private",
  }));

  // Milestone photos from albums ("First steps!").
  const albums = await db.select().from(photoAlbums).where(albumVisible(viewer));
  const albumIds = albums.map((a) => a.id);
  if (albumIds.length && !opts.memberId) {
    const ms = await db
      .select()
      .from(entityPhotos)
      .where(and(eq(entityPhotos.entityType, "album"), inArray(entityPhotos.entityId, albumIds), isNotNull(entityPhotos.milestone), q ? ilike(entityPhotos.milestone, q) : undefined))
      .limit(200);
    for (const p of ms) {
      const date = (p.takenAt ?? p.createdAt).toISOString().slice(0, 10);
      if (opts.year && Number(date.slice(0, 4)) !== opts.year) continue;
      items.push({ type: "photo", id: p.id, date, title: p.milestone!, fileId: p.fileId, mediaType: p.mediaType, albumId: p.entityId });
    }
  }
  if (!opts.milestones && !opts.memberId) {
    // Albums (by their date) and trips.
    if (albumIds.length) {
      const [counts, covers] = await Promise.all([
        db.select({ id: entityPhotos.entityId, n: count() }).from(entityPhotos).where(and(eq(entityPhotos.entityType, "album"), inArray(entityPhotos.entityId, albumIds))).groupBy(entityPhotos.entityId),
        db.selectDistinctOn([entityPhotos.entityId], { id: entityPhotos.entityId, fileId: entityPhotos.fileId }).from(entityPhotos).where(and(eq(entityPhotos.entityType, "album"), inArray(entityPhotos.entityId, albumIds), eq(entityPhotos.mediaType, "photo"))).orderBy(entityPhotos.entityId, desc(entityPhotos.createdAt)),
      ]);
      for (const a of albums) {
        const date = a.eventDate ?? a.createdAt.toISOString().slice(0, 10);
        if (opts.year && Number(date.slice(0, 4)) !== opts.year) continue;
        if (q && !a.title.toLowerCase().includes(opts.q!.trim().toLowerCase())) continue;
        items.push({ type: "album", id: a.id, date, title: a.title, count: counts.find((c) => c.id === a.id)?.n ?? 0, cover: covers.find((c) => c.id === a.id)?.fileId ?? null });
      }
    }
    const trips = await db
      .select()
      .from(plans)
      .where(and(eq(plans.familyId, viewer.family.id), isNotNull(plans.startDate), or(eq(plans.visibility, "family"), eq(plans.createdByMemberId, viewer.member.id)), inYear(plans.startDate), q ? or(ilike(plans.title, q), ilike(plans.destination, q)) : undefined));
    for (const t of trips) items.push({ type: "trip", id: t.id, date: t.startDate!, endDate: t.endDate, title: t.title, destination: t.destination });
  }
  return items.sort((a, b) => b.date.localeCompare(a.date));
}

/** Years that have anything on the timeline (for the year picker). */
export async function timelineYears(viewer: Viewer) {
  const rows = await db.execute<{ y: number }>(sql`
    select distinct y from (
      select extract(year from date)::int as y from memories where family_id = ${viewer.family.id}
      union select extract(year from coalesce(event_date, created_at::date))::int from photo_albums where family_id = ${viewer.family.id}
      union select extract(year from start_date)::int from plans where family_id = ${viewer.family.id} and start_date is not null
    ) t where y is not null order by y desc`);
  return rows.rows.map((r) => Number(r.y));
}

// ─── Birthdays & anniversaries ───────────────────────────────────────────────

export type SpecialDate = { key: string; kind: "birthday" | "anniversary" | "other"; title: string; date: string; years: number | null; daysAway: number; who?: string; id?: string; editable?: boolean; notes?: string | null; remindDays?: number; memberIds?: string[] };

const nextOn = (month: number, day: number, today: string) => {
  const y = Number(today.slice(0, 4));
  const fix = (yy: number) => (month === 2 && day === 29 && !(yy % 4 === 0 && (yy % 100 !== 0 || yy % 400 === 0)) ? 28 : day);
  const thisYear = `${y}-${String(month).padStart(2, "0")}-${String(fix(y)).padStart(2, "0")}`;
  return thisYear >= today ? thisYear : `${y + 1}-${String(month).padStart(2, "0")}-${String(fix(y + 1)).padStart(2, "0")}`;
};
const daysFrom = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** Upcoming birthdays (family members and contacts) and anniversaries, soonest first. */
export async function specialDates(viewer: Viewer, today: string): Promise<SpecialDate[]> {
  const [members, cons, dates] = await Promise.all([
    db.select({ id: familyMembers.id, name: familyMembers.displayName, birthday: familyMembers.birthday }).from(familyMembers).where(and(eq(familyMembers.familyId, viewer.family.id), eq(familyMembers.isActive, true), isNotNull(familyMembers.birthday))),
    viewer.can("contacts")
      ? db.select({ id: contacts.id, name: contacts.name, birthday: contacts.birthday }).from(contacts).where(and(eq(contacts.familyId, viewer.family.id), isNotNull(contacts.birthday), or(eq(contacts.private, false), eq(contacts.createdByMemberId, viewer.member.id))))
      : Promise.resolve([]),
    db.select().from(familyDates).where(eq(familyDates.familyId, viewer.family.id)),
  ]);
  const out: SpecialDate[] = [];
  const add = (key: string, kind: SpecialDate["kind"], title: string, month: number, day: number, year: number | null, extra: Partial<SpecialDate> = {}) => {
    const date = nextOn(month, day, today);
    out.push({ key, kind, title, date, years: year ? Number(date.slice(0, 4)) - year : null, daysAway: daysFrom(today, date), ...extra });
  };
  for (const m of members) add(`m:${m.id}`, "birthday", `${m.name.split(" ")[0]}'s birthday`, Number(m.birthday!.slice(5, 7)), Number(m.birthday!.slice(8, 10)), Number(m.birthday!.slice(0, 4)) || null, { who: m.name });
  for (const c of cons) add(`c:${c.id}`, "birthday", `${c.name}'s birthday`, Number(c.birthday!.slice(5, 7)), Number(c.birthday!.slice(8, 10)), Number(c.birthday!.slice(0, 4)) || null, { who: c.name });
  for (const d of dates) add(`d:${d.id}`, d.kind as SpecialDate["kind"], d.title, d.month, d.day, d.year, { id: d.id, editable: viewer.isParent || d.createdByMemberId === viewer.member.id, notes: d.notes, remindDays: d.remindDays, memberIds: d.memberIds });
  return out.sort((a, b) => a.daysAway - b.daysAway || a.title.localeCompare(b.title));
}

export const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;
