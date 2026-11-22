import "server-only";
import { and, asc, eq, gte, inArray, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { faithHolidays, faithPractices, faithTexts } from "@/db/schema";
import type { Viewer } from "./dal";
import { holidaysBetween, type Faith, type Holiday } from "./faith-calendar";
import { PRACTICES, TEXTS, textByKey, type TextDef } from "./faith-config";

/** The member's practice checklist for a faith; the built-in list is copied in the first time. */
export async function practicesFor(viewer: Viewer, faith: Faith) {
  const where = and(eq(faithPractices.memberId, viewer.member.id), eq(faithPractices.faith, faith));
  let rows = await db.select().from(faithPractices).where(where).orderBy(asc(faithPractices.sort), asc(faithPractices.createdAt));
  if (!rows.length) {
    await db
      .insert(faithPractices)
      .values(PRACTICES[faith].map((p, i) => ({ familyId: viewer.family.id, memberId: viewer.member.id, faith, name: p.name, emoji: p.emoji, unit: p.unit ?? null, builtinKey: p.key, sort: i })))
      .onConflictDoNothing();
    rows = await db.select().from(faithPractices).where(where).orderBy(asc(faithPractices.sort), asc(faithPractices.createdAt));
  }
  return rows;
}

export type AnyText = TextDef & { custom?: boolean; id?: string };

/** Built-in texts of a faith plus the member's own. */
export async function textsFor(viewer: Viewer, faith: Faith): Promise<AnyText[]> {
  const mine = await db.select().from(faithTexts).where(and(eq(faithTexts.memberId, viewer.member.id), eq(faithTexts.faith, faith))).orderBy(asc(faithTexts.createdAt));
  return [...TEXTS[faith], ...mine.map((t) => ({ key: t.id, id: t.id, title: t.title, group: "My books", sections: t.sections, sectionLabel: t.sectionLabel, custom: true }))];
}

/** A text the member may track: a built-in, or their own. */
export async function findText(viewer: Viewer, key: string): Promise<(AnyText & { faith: Faith }) | null> {
  const built = textByKey(key);
  if (built) {
    const faith = (Object.keys(TEXTS) as Faith[]).find((f) => TEXTS[f].some((t) => t.key === key))!;
    return { ...built, faith };
  }
  if (!/^[0-9a-f-]{36}$/i.test(key)) return null;
  const [t] = await db.select().from(faithTexts).where(and(eq(faithTexts.id, key), eq(faithTexts.memberId, viewer.member.id)));
  return t ? { key: t.id, id: t.id, title: t.title, group: "My books", sections: t.sections, sectionLabel: t.sectionLabel, custom: true, faith: t.faith as Faith } : null;
}

export type FamilyHoliday = Holiday & { id?: string; custom?: boolean; adjusted?: boolean; notes?: string | null };

/**
 * Holidays of a faith between two dates, with the family's own days added and
 * any one-year date changes applied.
 */
export async function familyHolidays(familyId: string, faiths: Faith[], from: string, to: string): Promise<FamilyHoliday[]> {
  if (!faiths.length) return [];
  const rows = await db
    .select()
    .from(faithHolidays)
    .where(and(eq(faithHolidays.familyId, familyId), inArray(faithHolidays.faith, faiths), or(eq(faithHolidays.yearly, true), and(gte(faithHolidays.date, `${Number(from.slice(0, 4)) - 1}-01-01`), lte(faithHolidays.date, `${Number(to.slice(0, 4)) + 1}-12-31`)))));
  const out: FamilyHoliday[] = [];
  for (const faith of faiths) {
    const mine = rows.filter((r) => r.faith === faith);
    const fy = Number(from.slice(0, 4)),
      ty = Number(to.slice(0, 4));
    // Built-ins, widened a year each way so an adjusted date can move into range.
    for (const h of holidaysBetween(faith, `${fy - 1}-12-01`, `${ty + 1}-01-31`)) {
      const adj = mine.find((r) => r.holidayKey === h.key && r.date.slice(0, 4) === h.date.slice(0, 4) && !r.yearly);
      const moved: FamilyHoliday = adj ? { ...h, date: adj.date, endDate: h.endDate ? shift(h.endDate, days(h.date, adj.date)) : undefined, adjusted: true, id: adj.id, notes: adj.notes } : h;
      if ((moved.endDate ?? moved.date) >= from && moved.date <= to) out.push(moved);
    }
    for (const r of mine.filter((r) => !r.holidayKey)) {
      const dates = r.yearly ? Array.from({ length: ty - fy + 1 }, (_, i) => `${fy + i}${r.date.slice(4)}`) : [r.date];
      for (const d of dates) if (d >= from && d <= to) out.push({ faith, key: `custom:${r.id}`, name: r.name, date: d, emoji: r.emoji ?? "⭐", about: r.notes ?? "", id: r.id, custom: true, notes: r.notes, major: true });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const shift = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** Current streak (consecutive days ending today or yesterday) from a set of dates. */
export function streak(dates: Set<string>, today: string) {
  let d = dates.has(today) ? today : shift(today, -1);
  let n = 0;
  while (dates.has(d)) {
    n++;
    d = shift(d, -1);
  }
  return n;
}
