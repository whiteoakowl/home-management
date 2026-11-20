import "server-only";
import { cache } from "react";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { familyBilling, familyMembers, platformSettings, users } from "@/db/schema";
import { hasAccessStatus, type BillingStatus, type Plan } from "../../supabase/functions/_shared/billing-core";
import { stripeConfigured } from "./stripe";

export type { BillingStatus, Plan };


/** Platform admins: comma-separated emails in PLATFORM_ADMIN_EMAILS (set in Netlify). */
export const platformAdminEmails = () =>
  (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
export const isPlatformAdmin = (email: string | null | undefined) => !!email && platformAdminEmails().includes(email.toLowerCase());

const DEFAULTS = { id: "default", brandName: "Family Bubble", monthlyPriceCents: 499, yearlyPriceCents: 4900, currency: "usd", trialDays: 7, billingEnabled: true };

/** Service-wide settings (brand, prices, trial). Falls back to defaults before the first migration. */
export const getPlatformSettings = cache(async () => {
  try {
    const [row] = await db.select().from(platformSettings).where(eq(platformSettings.id, "default"));
    return row ?? { ...DEFAULTS, createdAt: new Date(), updatedAt: new Date() };
  } catch {
    return { ...DEFAULTS, createdAt: new Date(), updatedAt: new Date() };
  }
});

export const getBrand = async () => (await getPlatformSettings()).brandName;

export const formatPrice = (cents: number, currency = "usd") => new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

/**
 * A family's billing state and whether it may use the app.
 * Access: billing switched off or Stripe not set up yet → yes; complimentary,
 * trialing (with a card on file), active → yes; past_due → yes while Stripe
 * retries the card (with a warning); anything else (none, incomplete, unpaid,
 * canceled, expired, paused) → no: they choose a plan or fix the payment.
 * Families that include a platform admin are complimentary automatically.
 */
export const familyAccess = cache(async (familyId: string) => {
  const settings = await getPlatformSettings();
  let [row] = await db.select().from(familyBilling).where(eq(familyBilling.familyId, familyId));
  if (!row || row.status === "none") {
    const admins = platformAdminEmails();
    if (admins.length) {
      const [adminMember] = await db
        .select({ id: familyMembers.id })
        .from(familyMembers)
        .innerJoin(users, eq(users.id, familyMembers.userId))
        .where(and(eq(familyMembers.familyId, familyId), inArray(users.email, admins)))
        .limit(1);
      if (adminMember) {
        [row] = await db
          .insert(familyBilling)
          .values({ familyId, status: "complimentary", compNote: "Owner's family" })
          .onConflictDoUpdate({ target: familyBilling.familyId, set: { status: "complimentary", compNote: "Owner's family" } })
          .returning();
      }
    }
  }
  const status = (row?.status ?? "none") as BillingStatus;
  const billingOn = settings.billingEnabled && stripeConfigured();
  const hasAccess = !billingOn || hasAccessStatus(status);
  return { status, row: row ?? null, hasAccess, billingOn, settings, trialUsed: !!row?.trialEndsAt || !!row?.stripeSubscriptionId };
});
