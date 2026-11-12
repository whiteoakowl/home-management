import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { familyMembers, recordAccess, recurrenceRules, type Visibility } from "@/db/schema";
import type { Rule } from "./recurrence";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;
type EntityType = (typeof recordAccess.$inferInsert)["entityType"];

// ─── Form parsing helpers ────────────────────────────────────────────────────

export const f = {
  str: (fd: FormData, k: string) => {
    const v = fd.get(k);
    const s = typeof v === "string" ? v.trim() : "";
    return s || null;
  },
  num: (fd: FormData, k: string) => {
    const v = fd.get(k);
    if (v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  },
  int: (fd: FormData, k: string) => {
    const n = f.num(fd, k);
    return n === null ? null : Math.round(n);
  },
  cents: (fd: FormData, k: string) => {
    const n = f.num(fd, k);
    return n === null ? null : Math.round(n * 100);
  },
  bool: (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true",
  list: (fd: FormData, k: string) =>
    fd
      .getAll(k)
      .map((v) => String(v).trim())
      .filter(Boolean),
  /** Comma/newline separated text → array */
  split: (fd: FormData, k: string) =>
    String(fd.get(k) ?? "")
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean),
  date: (fd: FormData, k: string) => {
    const s = f.str(fd, k);
    return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  },
};

// ─── Recurrence rules ────────────────────────────────────────────────────────

/** Insert/replace a rule. Returns its id, or null when rule is null (and deletes old). */
export async function upsertRule(tx: Tx, familyId: string, rule: Rule | null, existingId?: string | null) {
  if (!rule) {
    if (existingId) await tx.delete(recurrenceRules).where(and(eq(recurrenceRules.id, existingId), eq(recurrenceRules.familyId, familyId)));
    return null;
  }
  const values = {
    familyId,
    freq: rule.freq,
    interval: rule.interval,
    byWeekday: rule.byWeekday ?? null,
    byMonthDay: rule.byMonthDay ?? null,
    byMonth: rule.byMonth ?? null,
    startsOn: rule.startsOn,
    until: rule.until ?? null,
    count: rule.count ?? null,
  };
  if (existingId) {
    await tx.update(recurrenceRules).set(values).where(and(eq(recurrenceRules.id, existingId), eq(recurrenceRules.familyId, familyId)));
    return existingId;
  }
  const [row] = await tx.insert(recurrenceRules).values(values).returning({ id: recurrenceRules.id });
  return row!.id;
}

export async function loadRules(ids: (string | null)[]) {
  const clean = [...new Set(ids.filter((x): x is string => !!x))];
  if (!clean.length) return new Map<string, Rule & { enabled: boolean }>();
  const rows = await db.select().from(recurrenceRules).where(inArray(recurrenceRules.id, clean));
  return new Map(rows.map((r) => [r.id, { ...r, freq: r.freq, interval: r.interval } as Rule & { enabled: boolean }]));
}

// ─── Record visibility ───────────────────────────────────────────────────────

/** Reads visibility + selected members from a VisibilityField. */
export function visibilityFromForm(fd: FormData): { visibility: Visibility; memberIds: string[] } {
  const v = String(fd.get("visibility") ?? "family");
  const visibility = (["family", "private", "selected"].includes(v) ? v : "family") as Visibility;
  return { visibility, memberIds: visibility === "selected" ? f.list(fd, "visibleTo") : [] };
}

/** Replace the explicit share list for a record. Only family members are accepted. */
export async function saveRecordAccess(
  tx: Tx,
  familyId: string,
  entityType: EntityType,
  entityId: string,
  memberIds: string[],
) {
  await tx.delete(recordAccess).where(and(eq(recordAccess.entityType, entityType), eq(recordAccess.entityId, entityId)));
  if (!memberIds.length) return;
  const valid = await tx
    .select({ id: familyMembers.id })
    .from(familyMembers)
    .where(and(eq(familyMembers.familyId, familyId), inArray(familyMembers.id, memberIds)));
  if (valid.length) await tx.insert(recordAccess).values(valid.map((m) => ({ familyId, entityType, entityId, memberId: m.id })));
}

export async function getRecordAccess(entityType: EntityType, entityIds: string[]) {
  if (!entityIds.length) return new Map<string, string[]>();
  const rows = await db
    .select({ entityId: recordAccess.entityId, memberId: recordAccess.memberId })
    .from(recordAccess)
    .where(and(eq(recordAccess.entityType, entityType), inArray(recordAccess.entityId, entityIds)));
  const map = new Map<string, string[]>();
  for (const r of rows) map.set(r.entityId, [...(map.get(r.entityId) ?? []), r.memberId]);
  return map;
}

/** Validate that a member id (from a form) belongs to the family. */
export async function familyMemberIdOrNull(familyId: string, id: string | null) {
  if (!id) return null;
  const [m] = await db
    .select({ id: familyMembers.id })
    .from(familyMembers)
    .where(and(eq(familyMembers.id, id), eq(familyMembers.familyId, familyId)));
  return m?.id ?? null;
}

export async function familyMemberIds(familyId: string, ids: string[]) {
  if (!ids.length) return [];
  const rows = await db
    .select({ id: familyMembers.id })
    .from(familyMembers)
    .where(and(eq(familyMembers.familyId, familyId), inArray(familyMembers.id, ids)));
  return rows.map((r) => r.id);
}
