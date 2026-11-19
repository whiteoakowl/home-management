"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { familyBilling } from "@/db/schema";
import { familyAccess, type Plan } from "@/lib/billing";
import { requireParent } from "@/lib/dal";
import { stripe, StripeError } from "@/lib/stripe";

async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return process.env.URL && !host ? process.env.URL : `${proto}://${host}`;
}

/**
 * Start (or restart) a subscription on Stripe Checkout. New families get the
 * free trial; the card is collected now and first charged when the trial ends.
 */
export async function startCheckout(fd: FormData) {
  let url: string;
  try {
    url = await checkoutUrl(fd);
  } catch (e) {
    if (e instanceof StripeError) {
      console.error("Stripe checkout failed:", e.message);
      redirect(`/billing?error=${encodeURIComponent("We couldn't reach the payment service. Please try again in a moment.")}`);
    }
    throw e;
  }
  redirect(url);
}

async function checkoutUrl(fd: FormData) {
  const viewer = await requireParent();
  const plan: Plan = fd.get("plan") === "yearly" ? "yearly" : "monthly";
  const { settings, row, trialUsed } = await familyAccess(viewer.family.id);
  let customer = row?.stripeCustomerId ?? null;
  if (!customer) {
    const c = await stripe<{ id: string }>("POST", "/customers", {
      email: viewer.user.email,
      name: `${viewer.family.name} family`,
      metadata: { familyId: viewer.family.id },
    });
    customer = c.id;
    await db
      .insert(familyBilling)
      .values({ familyId: viewer.family.id, stripeCustomerId: customer })
      .onConflictDoUpdate({ target: familyBilling.familyId, set: { stripeCustomerId: customer } });
  }
  const origin = await siteOrigin();
  const session = await stripe<{ url: string }>("POST", "/checkout/sessions", {
    mode: "subscription",
    customer,
    client_reference_id: viewer.family.id,
    payment_method_collection: "always",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: settings.currency,
          unit_amount: plan === "yearly" ? settings.yearlyPriceCents : settings.monthlyPriceCents,
          recurring: { interval: plan === "yearly" ? "year" : "month" },
          product_data: { name: `${settings.brandName} (${plan === "yearly" ? "yearly" : "monthly"})` },
        },
      },
    ],
    subscription_data: {
      metadata: { familyId: viewer.family.id },
      ...(trialUsed || settings.trialDays <= 0 ? {} : { trial_period_days: settings.trialDays }),
    },
    allow_promotion_codes: true,
    success_url: `${origin}/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/billing?canceled=1`,
  });
  return session.url;
}

/** Stripe's billing portal: change card, switch plan, cancel, invoices. */
export async function openBillingPortal() {
  const viewer = await requireParent();
  const { row } = await familyAccess(viewer.family.id);
  if (!row?.stripeCustomerId) redirect("/billing");
  const origin = await siteOrigin();
  let url: string;
  try {
    url = (await stripe<{ url: string }>("POST", "/billing_portal/sessions", { customer: row.stripeCustomerId, return_url: `${origin}/settings/billing` })).url;
  } catch (e) {
    if (e instanceof StripeError) redirect(`/settings/billing?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  redirect(url);
}

