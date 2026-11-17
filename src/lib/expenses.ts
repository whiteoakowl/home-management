import "server-only";
import { and, eq, ilike, isNull } from "drizzle-orm";
import { db } from "@/db";
import { categories, transactions } from "@/db/schema";
import type { Viewer } from "./dal";

/**
 * Record a cost from another module (vet bill, repair, project purchase,
 * celebration supplies) as a budget expense: one transaction, linked back to
 * its source, so the money is never entered twice.
 */
export async function recordExpense(
  viewer: Viewer,
  e: { name: string; amountCents: number; date: string; categoryName: string; notes?: string | null; repairId?: string; projectId?: string; celebrationId?: string; /** Into the viewer's own My Budget instead of the family budget. */ mine?: boolean },
) {
  const owner = e.mine ? viewer.member.id : null;
  if ((owner ? !viewer.member.privateFinance : !viewer.can("budget", "edit")) || e.amountCents <= 0) return null;
  let [cat] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.familyId, viewer.family.id), eq(categories.domain, "budget"), owner ? eq(categories.ownerMemberId, owner) : isNull(categories.ownerMemberId), ilike(categories.name, e.categoryName)));
  if (!cat) [cat] = await db.insert(categories).values({ familyId: viewer.family.id, domain: "budget", name: e.categoryName, ownerMemberId: owner }).returning({ id: categories.id });
  const [t] = await db
    .insert(transactions)
    .values({
      familyId: viewer.family.id,
      kind: "expense",
      name: e.name.slice(0, 120),
      amountCents: e.amountCents,
      date: e.date,
      categoryId: cat!.id,
      memberId: viewer.member.id,
      notes: e.notes ?? null,
      ownerMemberId: owner,
      repairId: e.repairId,
      projectId: e.projectId,
      celebrationId: e.celebrationId,
    })
    .returning({ id: transactions.id });
  return t!.id;
}
