import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { pointeFavorites, pointeShoes } from "@/db/schema";
import type { Viewer } from "./dal";
import { reorderDue, type ReorderDue } from "./dance";
import { formatShortDate } from "./dates";

/** All pairs (newest first) and favourite fits, for some dancers or everyone. */
export async function pointeData(viewer: Viewer, memberIds: string[] | null) {
  const [shoes, favorites] = await Promise.all([
    db
      .select()
      .from(pointeShoes)
      .where(and(eq(pointeShoes.familyId, viewer.family.id), memberIds ? inArray(pointeShoes.memberId, memberIds) : undefined))
      .orderBy(desc(pointeShoes.firstWornOn), desc(pointeShoes.createdAt)),
    db
      .select()
      .from(pointeFavorites)
      .where(and(eq(pointeFavorites.familyId, viewer.family.id), memberIds ? inArray(pointeFavorites.memberId, memberIds) : undefined))
      .orderBy(asc(pointeFavorites.brand)),
  ]);
  return { shoes, favorites };
}

/** Per dancer with any pairs: what they're wearing, spares and when to order next. */
export async function pointeSummary(viewer: Viewer, memberIds: string[] | null, today: string) {
  const { shoes } = await pointeData(viewer, memberIds);
  const byMember = Map.groupBy(shoes, (s) => s.memberId);
  return [...byMember.entries()].map(([memberId, pairs]) => {
    const wearing = pairs.find((p) => p.status === "in_use");
    return {
      memberId,
      inUse: wearing ? [wearing.brand, wearing.model].filter(Boolean).join(" ") : null,
      spares: pairs.filter((p) => p.status === "on_hand").length,
      due: reorderDue(pairs, today),
    };
  });
}

export function reorderText(due: ReorderDue, today: string) {
  if (due.status === "ordered") return "On order";
  if (!due.date || due.date <= today) return "Order now";
  return `Order by ${formatShortDate(due.date)}`;
}
