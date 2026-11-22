"use server";

import { revalidatePath } from "next/cache";
import { getPlatformSettings, familyAccess } from "@/lib/billing";
import { requireParent, type Viewer } from "@/lib/dal";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { billingCtx, stripeConfigured } from "@/lib/stripe";
import {
  BillingError,
  cancelSubscription as cancelFlow,
  changePlan as changePlanFlow,
  createSetupIntent,
  ensureCustomer,
  ensurePrices,
  payOpenInvoice as payFlow,
  resumeSubscription as resumeFlow,
  startSubscription as startFlow,
  syncSubscription,
  updatePaymentMethod as updatePmFlow,
  type FlowResult,
  type Plan,
} from "../../../supabase/functions/_shared/billing-core";

/**
 * In-app subscription management. Only the family's account holder (the
 * person who created the account) can pay, change plans or cancel; these
 * work even when the family has no active plan yet (that's how they get one).
 * Card details go from the browser straight to Stripe (Payment Element).
 */
async function accountHolder(): Promise<Viewer> {
  const viewer = await requireParent();
  if (!viewer.isOwner) throw new BillingError("Only the family's account holder can manage the subscription.");
  if (!stripeConfigured()) throw new BillingError("Payments aren't set up yet.");
  return viewer;
}

const done = (r: FlowResult) => {
  revalidatePath("/", "layout");
  return r;
};
const fail = (e: unknown): FlowResult => {
  if (e instanceof BillingError || (e as { userFacing?: boolean })?.userFacing) return { ok: false, message: (e as Error).message };
  console.error("Billing action failed:", e);
  return { ok: false, message: "Something went wrong with billing. Please try again." };
};
const asPlan = (v: unknown): Plan => (v === "yearly" ? "yearly" : "monthly");

/**
 * Step 1 of paying or changing a card: a SetupIntent client secret for the
 * Payment Element. Rate limited to stop card-testing abuse.
 */
export async function beginCardSetup(): Promise<{ ok: true; clientSecret: string } | { ok: false; message: string }> {
  try {
    const viewer = await accountHolder();
    if (!(await rateLimit(`setup:${viewer.family.id}`, 12, 3600)) || !(await rateLimit(`setup-ip:${await clientIp()}`, 20, 3600)))
      return { ok: false, message: "Too many attempts. Please wait a little and try again." };
    const ctx = billingCtx();
    const customerId = await ensureCustomer(ctx, viewer.family.id, { email: viewer.user.email, name: `${viewer.family.name} family (${viewer.user.name})` });
    return { ok: true, clientSecret: await createSetupIntent(ctx, viewer.family.id, customerId) };
  } catch (e) {
    return fail(e) as { ok: false; message: string };
  }
}

/** Step 2 for new subscribers: start the plan with the card just saved. */
export async function subscribe(plan: Plan, setupIntentId: string): Promise<FlowResult> {
  try {
    const viewer = await accountHolder();
    const ctx = billingCtx();
    const settings = await getPlatformSettings();
    const { stripeTrialDays } = await familyAccess(viewer.family.id);
    const prices = await ensurePrices(ctx, settings);
    const customerId = await ensureCustomer(ctx, viewer.family.id, { email: viewer.user.email, name: `${viewer.family.name} family (${viewer.user.name})` });
    return done(await startFlow(ctx, { familyId: viewer.family.id, customerId, setupIntentId: String(setupIntentId), plan: asPlan(plan), prices, trialDays: stripeTrialDays }));
  } catch (e) {
    return fail(e);
  }
}

/** Monthly ↔ yearly (yearly → monthly waits for the end of the paid year). */
export async function changePlan(plan: Plan): Promise<FlowResult> {
  try {
    const viewer = await accountHolder();
    const ctx = billingCtx();
    const prices = await ensurePrices(ctx, await getPlatformSettings());
    return done(await changePlanFlow(ctx, { familyId: viewer.family.id, plan: asPlan(plan), prices }));
  } catch (e) {
    return fail(e);
  }
}

export async function cancelSubscription(reason: string | null): Promise<FlowResult> {
  try {
    const viewer = await accountHolder();
    return done(await cancelFlow(billingCtx(), { familyId: viewer.family.id, reason: reason ? String(reason).slice(0, 500) : null }));
  } catch (e) {
    return fail(e);
  }
}

export async function resumeSubscription(): Promise<FlowResult> {
  try {
    const viewer = await accountHolder();
    return done(await resumeFlow(billingCtx(), { familyId: viewer.family.id }));
  } catch (e) {
    return fail(e);
  }
}

/** Use the card just saved in the Payment Element (and retry a failed payment). */
export async function updatePaymentMethod(setupIntentId: string): Promise<FlowResult> {
  try {
    const viewer = await accountHolder();
    const ctx = billingCtx();
    const { row } = await familyAccess(viewer.family.id);
    if (!row?.stripeCustomerId) return { ok: false, message: "Your family doesn't have a subscription yet." };
    return done(await updatePmFlow(ctx, { familyId: viewer.family.id, customerId: row.stripeCustomerId, setupIntentId: String(setupIntentId) }));
  } catch (e) {
    return fail(e);
  }
}

export async function payNow(): Promise<FlowResult> {
  try {
    const viewer = await accountHolder();
    if (!(await rateLimit(`paynow:${viewer.family.id}`, 6, 3600))) return { ok: false, message: "Too many attempts. Please wait a little and try again." };
    return done(await payFlow(billingCtx(), { familyId: viewer.family.id }));
  } catch (e) {
    return fail(e);
  }
}

/** After the bank confirmed a payment in the browser: read the result from Stripe straight away. */
export async function refreshSubscription(): Promise<FlowResult> {
  try {
    const viewer = await requireParent();
    const { row } = await familyAccess(viewer.family.id);
    if (!row?.stripeSubscriptionId || !stripeConfigured()) return { ok: true, message: "" };
    const { status } = await syncSubscription(billingCtx(), row.stripeSubscriptionId, viewer.family.id);
    return done({ ok: true, message: "", status });
  } catch (e) {
    return fail(e);
  }
}
