import { billingCtx } from "@/lib/stripe";
import { handleStripeEvent, verifyStripeSignature, type StripeEvent } from "../../../../../supabase/functions/_shared/billing-core";

/**
 * Backup webhook endpoint inside the app. The main one is the Supabase Edge
 * Function `stripe-webhook`; both run the same shared billing engine, and
 * events are processed once (stripe_events), so pointing Stripe at either
 * one, or both, is safe.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) return new Response("Webhook not configured", { status: 503 });
  const payload = await req.text();
  if (!(await verifyStripeSignature(payload, req.headers.get("stripe-signature"), secret))) return new Response("Bad signature", { status: 400 });
  let event: StripeEvent;
  try {
    event = JSON.parse(payload);
  } catch {
    return new Response("Bad payload", { status: 400 });
  }
  try {
    const result = await handleStripeEvent(billingCtx(), event);
    return Response.json({ received: true, result });
  } catch (e) {
    console.error("stripe webhook", event.type, event.id, (e as Error).message);
    return new Response("Error", { status: 500 });
  }
}
