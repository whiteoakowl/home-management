import "server-only";
import { cache } from "react";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { familyBilling, familyMembers, platformSettings, users } from "@/db/schema";
import { stripe, stripeConfigured, type StripeSubscription } from "./stripe";

export type Plan = "monthly" | "yearly";
export type BillingStatus = "none" | "trialing" | "active" | "past_due" | "canceled" | "complimentary";

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
 * trialing, active → yes; past_due → yes (Stripe is retrying the card) with a
 * warning; none / canceled → no (they choose a plan first).
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
  const hasAccess = !billingOn || ["complimentary", "trialing", "active", "past_due"].includes(status);
  return { status, row: row ?? null, hasAccess, billingOn, settings, trialUsed: !!row?.trialEndsAt || !!row?.stripeSubscriptionId };
});

/** Copy a Stripe subscription onto the family's billing row. */
export async function applySubscription(familyId: string, sub: StripeSubscription) {
  const status: BillingStatus =
    sub.status === "trialing" ? "trialing" : sub.status === "active" ? "active" : sub.status === "past_due" || sub.status === "unpaid" ? "past_due" : "canceled";
  const interval = sub.items?.data?.[0]?.price?.recurring?.interval;
  const values = {
    status,
    plan: interval === "year" ? "yearly" : interval === "month" ? "monthly" : null,
    stripeCustomerId: sub.customer,
    stripeSubscriptionId: sub.id,
    trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
  };
  const [existing] = await db.select().from(familyBilling).where(eq(familyBilling.familyId, familyId));
  // A complimentary family stays free even if a test subscription exists.
  if (existing?.status === "complimentary") return;
  await db
    .insert(familyBilling)
    .values({ familyId, ...values })
    .onConflictDoUpdate({ target: familyBilling.familyId, set: { ...values, updatedAt: new Date() } });
}

/** Re-read a family's subscription from Stripe (after checkout, or when the webhook is late). */
export async function syncFromStripe(familyId: string, subscriptionId: string) {
  const sub = await stripe<StripeSubscription>("GET", `/subscriptions/${subscriptionId}`);
  if (sub.metadata?.familyId && sub.metadata.familyId !== familyId) return;
  await applySubscription(familyId, sub);
}
