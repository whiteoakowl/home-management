import "server-only";
import { cache } from "react";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { pregnancies, pregnancyEntries, pregnancyWeekContent, recordAccess } from "@/db/schema";
import { AuthorizationError, visibleTo, type Viewer } from "../dal";
import { todayIn } from "../dates";
import { gestationOn } from "./dates";
import { builtInWeek, mergeWeek } from "./weeks";

export type Pregnancy = typeof pregnancies.$inferSelect;

const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export { isUuid };

/**
 * Pregnancies the viewer may see: their own (they're pregnant or created it),
 * ones shared with them (selected people / "Parents & me" for parents /
 * whole family). Sensitive by default: new pregnancies start as "Parents & me".
 */
export const pregnancyVisible = (viewer: Viewer) =>
  or(visibleTo(viewer, { id: pregnancies.id, visibility: pregnancies.visibility, author: pregnancies.memberId }, "pregnancy"), eq(pregnancies.createdByMemberId, viewer.member.id))!;

export async function listPregnancies(viewer: Viewer) {
  if (!viewer.can("pregnancy")) return [];
  return db
    .select()
    .from(pregnancies)
    .where(and(eq(pregnancies.familyId, viewer.family.id), pregnancyVisible(viewer)))
    .orderBy(sql`case when ${pregnancies.status} = 'active' then 0 when ${pregnancies.status} = 'paused' then 1 else 2 end`, desc(pregnancies.dueDate));
}

/** One pregnancy the viewer may see, or null. Always scoped to the viewer's household. */
export async function getPregnancy(viewer: Viewer, id: unknown) {
  if (!isUuid(id) || !viewer.can("pregnancy")) return null;
  const [p] = await db.select().from(pregnancies).where(and(eq(pregnancies.id, id), eq(pregnancies.familyId, viewer.family.id), pregnancyVisible(viewer)));
  return p ?? null;
}

/** Members a pregnancy is shared with, and which of them may also edit. */
export async function pregnancyAccess(id: string) {
  const rows = await db.select({ memberId: recordAccess.memberId, canEdit: recordAccess.canEdit }).from(recordAccess).where(and(eq(recordAccess.entityType, "pregnancy"), eq(recordAccess.entityId, id)));
  return { shared: rows.map((r) => r.memberId), editors: rows.filter((r) => r.canEdit).map((r) => r.memberId) };
}

/** May the viewer change this pregnancy? The pregnant person, whoever set it up, or people it's shared with "can edit". */
export async function canEditPregnancy(viewer: Viewer, p: Pregnancy) {
  if (!viewer.can("pregnancy", "use")) return false;
  if (p.memberId === viewer.member.id || p.createdByMemberId === viewer.member.id) return true;
  const { editors } = await pregnancyAccess(p.id);
  return editors.includes(viewer.member.id);
}

/** Load a pregnancy for a change; throws if the viewer can't see or change it. */
export async function editablePregnancy(viewer: Viewer, id: unknown) {
  const p = await getPregnancy(viewer, id);
  if (!p) throw new AuthorizationError("Pregnancy not found.");
  if (!(await canEditPregnancy(viewer, p))) throw new AuthorizationError("Only the person who's pregnant (or someone they've let edit) can change this.");
  return p;
}

/** Where the pregnancy is today (null until there's a due date). */
export function currentGestation(viewer: Viewer, p: Pregnancy) {
  if (!p.dueDate) return null;
  const today = p.status === "born" || p.status === "completed" ? (p.endedOn ?? todayIn(viewer.family.timezone)) : todayIn(viewer.family.timezone);
  return gestationOn(p.dueDate, today);
}

/** Week content: built in, with any admin edits on top. Cached per request. */
export const weekContent = cache(async (week: number) => {
  const w = Math.min(42, Math.max(1, Math.round(week)));
  const [row] = await db.select().from(pregnancyWeekContent).where(eq(pregnancyWeekContent.week, w));
  return mergeWeek(builtInWeek(w), row?.data);
});

export const allWeekOverrides = () => db.select().from(pregnancyWeekContent).orderBy(asc(pregnancyWeekContent.week));

/**
 * Photos and documents in a pregnancy are only served to people who may see
 * that pregnancy (checked by the file route).
 */
export async function canReadPregnancyFile(viewer: Viewer, fileId: string) {
  const links = await db.select({ pid: pregnancyEntries.pregnancyId }).from(pregnancyEntries).where(and(eq(pregnancyEntries.fileId, fileId), eq(pregnancyEntries.familyId, viewer.family.id)));
  if (!links.length) return true;
  const ok = await db
    .select({ id: pregnancies.id })
    .from(pregnancies)
    .where(and(inArray(pregnancies.id, links.map((l) => l.pid)), eq(pregnancies.familyId, viewer.family.id), pregnancyVisible(viewer)))
    .limit(1);
  return ok.length > 0 && viewer.can("pregnancy");
}
