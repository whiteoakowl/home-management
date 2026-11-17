import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { familyMembers, recordAccess } from "@/db/schema";
import type { Viewer } from "./dal";

/**
 * Whose work schedules the viewer may see. Each person chooses: the whole
 * family, selected people, "Parents & me", or "Only me" (nobody else, parents
 * included). You always see your own.
 */
export async function visibleWorkers(viewer: Viewer): Promise<Set<string>> {
  const [members, shared] = await Promise.all([
    db.select({ id: familyMembers.id, vis: familyMembers.workVisibility }).from(familyMembers).where(eq(familyMembers.familyId, viewer.family.id)),
    db
      .select({ id: recordAccess.entityId })
      .from(recordAccess)
      .where(and(eq(recordAccess.familyId, viewer.family.id), eq(recordAccess.entityType, "work_schedule"), eq(recordAccess.memberId, viewer.member.id))),
  ]);
  const sharedWithMe = new Set(shared.map((s) => s.id));
  return new Set(
    members
      .filter((m) => m.id === viewer.member.id || m.vis === "family" || (m.vis === "parents" && viewer.isParent) || (m.vis === "selected" && sharedWithMe.has(m.id)))
      .map((m) => m.id),
  );
}

/** The viewer's own choice, for the "Who sees my schedule" form. */
export async function myWorkSharing(viewer: Viewer) {
  const rows = await db
    .select({ memberId: recordAccess.memberId })
    .from(recordAccess)
    .where(and(eq(recordAccess.familyId, viewer.family.id), eq(recordAccess.entityType, "work_schedule"), eq(recordAccess.entityId, viewer.member.id)));
  return { visibility: viewer.member.workVisibility, memberIds: rows.map((r) => r.memberId) };
}
