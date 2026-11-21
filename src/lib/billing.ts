import "server-only";
import { cache } from "react";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { families, familyBilling, familyMembers, platformSettings, users } from "@/db/schema";
import { hasAccessStatus, type BillingStatus, type Plan } from "../../supabase/functions/_shared/billing-core";
import { tierOf } from "./plan-tiers";
import { stripeConfigured } from "./stripe";

export type { BillingStatus, Plan };


/** Platform admins: comma-separated emails in PLATFORM_ADMIN_EMAILS (set in Netlify). */
export const platformAdminEmails = () =>
  (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
export const isPlatformAdmin = (email: string | null | undefined) => !!email && platformAdminEmails().includes(email.toLowerCase());

const DEFAULTS = { id: "default", brandName: "Family Bubble", monthlyPriceCents: 1299, yearlyPriceCents: 12999, currency: "usd", trialDays: 7, billingEnabled: true };

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
 * A family's billing state and plan tier.
 *
 * Everyone can use the app: families without a paid plan are on Free (the
 * everyday family hub). `premium` is true when payments aren't set up yet,
 * or the family is complimentary, active, in a Stripe trial, or past_due
 * (while Stripe retries the card), or inside its no-card free trial
 * (`trialDays` from when the family was created; tier "trial").
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
  const paid = hasAccessStatus(status);
  const [fam] = await db.select({ createdAt: families.createdAt }).from(families).where(eq(families.id, familyId));
  const { tier, trialEndsAt, trialDaysLeft } = tierOf({ billingOn, paid, familyCreatedAt: fam?.createdAt ?? new Date(0), trialDays: settings.trialDays });
  // A paid plan started during the free trial only charges once the trial's days are over.
  const stripeTrialUsed = !!row?.trialEndsAt || !!row?.stripeSubscriptionId;
  return {
    status,
    row: row ?? null,
    billingOn,
    settings,
    /** Premium (paid, complimentary, payments off, or in the free trial). */
    premium: tier !== "free",
    /** A paid or complimentary plan (not the no-card trial). */
    paid: !billingOn || paid,
    tier,
    trialEndsAt,
    trialDaysLeft,
    /** Days of trial to give a new Stripe subscription, so subscribing early never cuts the trial short. */
    stripeTrialDays: stripeTrialUsed ? 0 : trialDaysLeft,
  };
});