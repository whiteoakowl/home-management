import "server-only";
import { pool } from "@/db";
import { createStripe, StripeError, type BillingCtx, type Db, type StripeFn } from "../../supabase/functions/_shared/billing-core";

/**
 * Stripe for the app (server only). Keys come from environment variables:
 *   STRIPE_SECRET_KEY        secret key (sk_live_… / sk_test_…), server only
 *   STRIPE_PUBLISHABLE_KEY   publishable key (pk_live_… / pk_test_…), sent to the browser for the Payment Element
 *   STRIPE_WEBHOOK_SECRET    signing secret of the webhook endpoint
 * Card details never reach this server: the Payment Element sends them straight to Stripe.
 */
export const stripeConfigured = () => !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_PUBLISHABLE_KEY;
export const stripePublishableKey = () => process.env.STRIPE_PUBLISHABLE_KEY ?? "";

let client: StripeFn | null = null;
/** The Stripe REST client. STRIPE_API_BASE is only for local tests against a fake Stripe. */
export const stripe: StripeFn = (method, path, params, opts) => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeError("Payments aren't set up yet.", "not_configured");
  client ??= createStripe(key, process.env.STRIPE_API_BASE || undefined);
  return client(method, path, params, opts);
};

/** The app's database, in the shape the shared billing engine expects. */
export const billingDb: Db = {
  query: async <T,>(text: string, params: unknown[] = []) => (await pool.query(text, params)).rows as T[],
};

export const billingCtx = (): BillingCtx => ({ db: billingDb, stripe });

export { StripeError };
