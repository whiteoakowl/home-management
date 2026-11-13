import "server-only";
import { and, asc, desc, eq, gte, inArray, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { allergies, calendarEvents, familyMembers, foodRestrictions, medicalConditions, medicalDocuments, medicalProfiles, medications, recordAccess } from "@/db/schema";
import type { Viewer } from "./dal";
import { expandKeyword, ingredientMatches } from "./allergen-groups";
import type { MedicalKind } from "./medical-config";

export const MEDICAL_TABLES = {
  profile: medicalProfiles,
  allergy: allergies,
  restriction: foodRestrictions,
  condition: medicalConditions,
  medication: medications,
  document: medicalDocuments,
} as const;

/** All medical tables share the owner columns; use one shape for generic queries. */
export const medTable = (kind: MedicalKind) => MEDICAL_TABLES[kind] as unknown as typeof allergies;

/**
 * Medical privacy: parents see everything; a member sees records about
 * themselves, records shared with the family, and records shared with them.
 */
export function medicalVisible(viewer: Viewer, t: { id: PgColumn; memberId: PgColumn; visibility: PgColumn; createdByMemberId: PgColumn }): SQL {
  if (viewer.isParent) return sql`true`;
  return or(
    eq(t.memberId, viewer.member.id),
    eq(t.createdByMemberId, viewer.member.id),
    sql`${t.visibility} = 'family'`,
    and(
      sql`${t.visibility} = 'selected'`,
      inArray(t.id, db.select({ id: recordAccess.entityId }).from(recordAccess).where(and(eq(recordAccess.entityType, "medical"), eq(recordAccess.memberId, viewer.member.id)))),
    ),
  )!;
}

export async function listMedical<K extends MedicalKind>(viewer: Viewer, kind: K, memberId?: string) {
  const t = medTable(kind);
  const rows = await db
    .select({ r: t, memberName: familyMembers.displayName, memberColor: familyMembers.color })
    .from(t)
    .innerJoin(familyMembers, eq(familyMembers.id, t.memberId))
    .where(and(eq(t.familyId, viewer.family.id), medicalVisible(viewer, t), memberId ? eq(t.memberId, memberId) : undefined))
    .orderBy(asc(familyMembers.displayName), desc(t.updatedAt));
  return rows as unknown as { r: (typeof MEDICAL_TABLES)[K]["$inferSelect"]; memberName: string; memberColor: string }[];
}

export type DietWarning = {
  ingredient: string;
  member: string;
  memberId: string;
  source: "allergy" | "restriction";
  label: string;
  severity: string | null;
  kind: string;
};

/**
 * Load every allergy trigger / restricted food the viewer may see and return
 * a matcher. Matching is deliberately generous; callers never claim a recipe
 * is safe, only that no recorded conflicts were found.
 */
export async function dietChecker(viewer: Viewer) {
  if (!viewer.can("medical")) return null;
  const [alls, rests] = await Promise.all([listMedical(viewer, "allergy"), listMedical(viewer, "restriction")]);
  const rules = [
    ...alls
      .filter(({ r }) => r.type === "food" || r.type === "other" || r.triggers.length)
      .map(({ r, memberName }) => ({ keys: [r.name, ...r.triggers].flatMap(expandKeyword), w: { member: memberName, memberId: r.memberId, source: "allergy" as const, label: r.name, severity: r.severity, kind: r.type } })),
    ...rests.map(({ r, memberName }) => ({ keys: [r.title, ...r.foods].flatMap(expandKeyword), w: { member: memberName, memberId: r.memberId, source: "restriction" as const, label: r.title, severity: null, kind: r.kind } })),
  ];
  return {
    hasRules: rules.length > 0,
    check(ingredients: string[]): DietWarning[] {
      const out: DietWarning[] = [];
      for (const ing of ingredients) for (const rule of rules) if (rule.keys.some((k) => ingredientMatches(ing, k))) out.push({ ingredient: ing, ...rule.w });
      return out;
    },
  };
}

export async function dietWarnings(viewer: Viewer, ingredients: string[]) {
  const c = await dietChecker(viewer);
  return c ? c.check(ingredients) : [];
}

/** One record the viewer may see (and therefore edit, given medical edit access). */
export async function getMedicalRecord<K extends MedicalKind>(viewer: Viewer, kind: K, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const t = medTable(kind);
  const [row] = await db
    .select()
    .from(t)
    .where(and(eq(t.id, id), eq(t.familyId, viewer.family.id), medicalVisible(viewer, t)));
  return (row ?? null) as unknown as (typeof MEDICAL_TABLES)[K]["$inferSelect"] | null;
}

/**
 * Files attached to medical records are only served to people who may see
 * the record. Returns true when the file is not a medical file at all.
 */
export async function canReadMedicalFile(viewer: Viewer, fileId: string) {
  const [a] = await db.select({ id: allergies.id }).from(allergies).where(and(eq(allergies.fileId, fileId), eq(allergies.familyId, viewer.family.id)));
  const [d] = await db.select({ id: medicalDocuments.id }).from(medicalDocuments).where(and(eq(medicalDocuments.fileId, fileId), eq(medicalDocuments.familyId, viewer.family.id)));
  if (!a && !d) return true;
  if (!viewer.can("medical")) return false;
  if (a && (await getMedicalRecord(viewer, "allergy", a.id))) return true;
  if (d && (await getMedicalRecord(viewer, "document", d.id))) return true;
  return false;
}

/** Medical appointments (calendar events with source 'medical') visible to the viewer. */
export async function medicalAppointments(viewer: Viewer, opts: { from?: Date; memberId?: string } = {}) {
  const rows = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.familyId, viewer.family.id),
        eq(calendarEvents.source, "medical"),
        opts.from ? gte(calendarEvents.startsAt, opts.from) : undefined,
        opts.memberId ? eq(calendarEvents.sourceId, opts.memberId) : undefined,
        viewer.isParent
          ? undefined
          : or(
              eq(calendarEvents.sourceId, viewer.member.id),
              eq(calendarEvents.createdByMemberId, viewer.member.id),
              sql`${calendarEvents.visibility} = 'family'`,
              inArray(calendarEvents.id, db.select({ id: recordAccess.entityId }).from(recordAccess).where(and(eq(recordAccess.entityType, "event"), eq(recordAccess.memberId, viewer.member.id)))),
            ),
      ),
    )
    .orderBy(asc(calendarEvents.startsAt));
  return rows;
}
