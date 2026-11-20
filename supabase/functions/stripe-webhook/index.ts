/**
 * Supabase Edge Function: Stripe → database.
 *
 * Stripe calls this for every subscription, invoice and payment-method event.
 * It verifies Stripe's signature, then updates family_billing,
 * billing_invoices and stripe_events through the shared billing engine
 * (the same code the app uses), so access always matches what Stripe says.
 *
 * Deploy:   supabase functions deploy stripe-webhook --no-verify-jwt
 * Secrets:  supabase secrets set STRIPE_SECRET_KEY=sk_live_… STRIPE_WEBHOOK_SECRET=whsec_…
 * URL:      https://<project-ref>.supabase.co/functions/v1/stripe-webhook
 * SUPABASE_DB_URL is provided by Supabase automatically.
 */
import postgres from "postgres";
import { createStripe, handleStripeEvent, verifyStripeSignature, type Db, type StripeEvent } from "../_shared/billing-core.ts";

const dbUrl = Deno.env.get("SUPABASE_DB_URL");
const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
// Only set in local tests, to point at a fake Stripe.
const stripeBase = Deno.env.get("STRIPE_API_BASE") ?? undefined;

// prepare:false works with Supabase's connection pooler (transaction mode).
const sql = dbUrl ? postgres(dbUrl, { max: 2, prepare: false, idle_timeout: 20 }) : null;
const db: Db | null = sql ? { query: (text, params = []) => sql.unsafe(text, params as never[]) as unknown as Promise<never[]> } : null;
const stripe = stripeKey ? createStripe(stripeKey, stripeBase) : null;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!db || !stripe || !webhookSecret) {
    console.error("stripe-webhook: missing SUPABASE_DB_URL, STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return new Response("Webhook not configured", { status: 503 });
  }
  const payload = await req.text();
  if (!(await verifyStripeSignature(payload, req.headers.get("stripe-signature"), webhookSecret))) return new Response("Bad signature", { status: 400 });
  let event: StripeEvent;
  try {
    event = JSON.parse(payload);
  } catch {
    return new Response("Bad payload", { status: 400 });
  }
  try {
    const result = await handleStripeEvent({ db, stripe }, event);
    return Response.json({ received: true, result });
  } catch (e) {
    // 500 makes Stripe retry later (with backoff, for up to 3 days).
    console.error("stripe-webhook", event.type, event.id, e instanceof Error ? e.message : e);
    return new Response("Error", { status: 500 });
  }
});
