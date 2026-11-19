import { applySubscription } from "@/lib/billing";
import { stripe, verifyStripeSignature, type StripeSubscription } from "@/lib/stripe";

/**
 * Stripe → app: keeps each family's subscription status current (trial
 * started, trial converted, card failed, cancelled). Configure in Stripe →
 * Developers → Webhooks with this URL and the events below; put the signing
 * secret in STRIPE_WEBHOOK_SECRET.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook not configured", { status: 503 });
  const payload = await req.text();
  if (!verifyStripeSignature(payload, req.headers.get("stripe-signature"), secret)) return new Response("Bad signature", { status: 400 });
  const event = JSON.parse(payload) as { type: string; data: { object: Record<string, unknown> } };
  const obj = event.data.object;
  try {
    if (event.type === "checkout.session.completed") {
      const familyId = obj.client_reference_id as string | null;
      const subId = obj.subscription as string | null;
      if (familyId && subId) {
        const sub = await stripe<StripeSubscription>("GET", `/subscriptions/${subId}`);
        await applySubscription(familyId, sub);
      }
    } else if (event.type.startsWith("customer.subscription.")) {
      const sub = obj as unknown as StripeSubscription;
      const familyId = sub.metadata?.familyId;
      if (familyId) await applySubscription(familyId, event.type === "customer.subscription.deleted" ? { ...sub, status: "canceled" } : sub);
    }
  } catch (e) {
    console.error("stripe webhook", event.type, (e as Error).message);
    return new Response("Error", { status: 500 });
  }
  return Response.json({ received: true });
}
