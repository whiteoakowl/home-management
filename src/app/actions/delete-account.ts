"use server";

import { redirect } from "next/navigation";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { families, familyBilling, familyMembers, files, users } from "@/db/schema";
import { destroySession, verifyPassword } from "@/lib/auth/session";
import { fail, type ActionState } from "@/lib/action-state";
import { getViewer } from "@/lib/dal";
import { rateLimit, TOO_MANY } from "@/lib/rate-limit";
import { removeKeys } from "@/lib/housekeeping";
import { stripe, stripeConfigured } from "@/lib/stripe";
import { f } from "@/lib/records";

/**
 * Permanently delete the family (account holder only, with their password
 * and the family's name typed in): ends the Stripe subscription right away
 * so nothing more is charged, erases stored photos and documents, the
 * family's records, and the logins that belong only to this family.
 */
export async function deleteFamilyAccount(_: ActionState, fd: FormData): Promise<ActionState> {
  const viewer = await getViewer({ allowOnboarding: true });
  if (!viewer.isOwner) return fail("Only the family's account holder can delete the account.");
  if (!(await rateLimit(`delete:${viewer.user.id}`, 5, 3600))) return fail(TOO_MANY);
  if ((f.str(fd, "familyName") ?? "").trim().toLowerCase() !== viewer.family.name.trim().toLowerCase()) return fail(`Type your family's name ("${viewer.family.name}") to confirm.`, "familyName");
  const [u] = await db.select().from(users).where(eq(users.id, viewer.user.id));
  if (!u || !(await verifyPassword(String(fd.get("password") ?? ""), u.passwordHash))) return fail("That password isn't right.", "password");

  const familyId = viewer.family.id;
  // Work out everything first, so a problem stops us before anything is cancelled or deleted.
  const [billing] = await db.select().from(familyBilling).where(eq(familyBilling.familyId, familyId));
  const stored = await db.select({ key: files.storageKey, thumb: files.thumbnailKey }).from(files).where(eq(files.familyId, familyId));
  const logins = (await db.select({ userId: familyMembers.userId }).from(familyMembers).where(eq(familyMembers.familyId, familyId))).map((r) => r.userId).filter((x): x is string => !!x);
  // Logins that belong only to this family.
  const onlyHere = logins.length
    ? (
        await db
          .select({ id: users.id })
          .from(users)
          .where(and(inArray(users.id, logins), sql`not exists (select 1 from family_members m where m.user_id = ${users.id} and m.family_id <> ${familyId})`))
      ).map((r) => r.id)
    : [];

  // 1. Stop billing now.
  if (billing?.stripeSubscriptionId && stripeConfigured() && !["canceled", "expired", "complimentary"].includes(billing.status)) {
    try {
      await stripe("DELETE", `/subscriptions/${billing.stripeSubscriptionId}`);
    } catch (e) {
      console.error("Couldn't cancel the subscription while deleting the family:", e);
      return fail("We couldn't cancel your subscription with the payment service, so nothing was deleted. Please try again in a moment.");
    }
  }
  // 2. The family and its records (and logins only it used), in one transaction.
  await db.transaction(async (tx) => {
    await tx.delete(families).where(eq(families.id, familyId));
    if (onlyHere.length) await tx.delete(users).where(inArray(users.id, onlyHere));
  });
  // 3. Stored files (photos, documents): best effort, after the records are gone.
  await removeKeys([...stored.flatMap((f) => [f.key, f.thumb].filter((k): k is string => !!k)), `${familyId}/exports/latest.json.gz`]).catch(() => null);
  await destroySession().catch(() => null);
  redirect("/welcome?deleted=1");
}
