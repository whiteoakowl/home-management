import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Minimal Stripe client over its REST API (no SDK). Card details never touch
 * this server: customers pay on Stripe Checkout and manage cards in Stripe's
 * billing portal. Needs STRIPE_SECRET_KEY (server-only) and, for webhooks,
 * STRIPE_WEBHOOK_SECRET.
 */
export const stripeConfigured = () => !!process.env.STRIPE_SECRET_KEY;

type Value = string | number | boolean | undefined | null | Params | (string | Params)[];
interface Params {
  [key: string]: Value;
}

/** Stripe's form encoding: a[b][c]=v, list[0]=v. */
function encode(params: Params, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === "object" ? encode(item, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(item))));
    else if (typeof v === "object") encode(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

export class StripeError extends Error {}

export async function stripe<T = Record<string, unknown>>(method: "GET" | "POST" | "DELETE", path: string, params: Params = {}): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeError("Payments aren't set up yet.");
  const body = encode(params).toString();
  const url = `https://api.stripe.com/v1${path}${method === "GET" && body ? `?${body}` : ""}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded", "Stripe-Version": "2024-06-20" },
      body: method === "GET" ? undefined : body,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    throw new StripeError(`Couldn't reach Stripe: ${e instanceof Error ? e.message : String(e)}`);
  }
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } } & T;
  if (!res.ok) throw new StripeError(json.error?.message ?? `Stripe error ${res.status}`);
  return json;
}

/**
 * Verify a webhook's Stripe-Signature header (HMAC-SHA256 of "t.payload")
 * and its timestamp (5-minute tolerance). Returns false if anything is off.
 */
export function verifyStripeSignature(payload: string, header: string | null, secret: string, now = Date.now()) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]).filter((p) => p.length === 2)) as Record<string, string>;
  const signatures = header
    .split(",")
    .filter((kv) => kv.startsWith("v1="))
    .map((kv) => kv.slice(3));
  const t = Number(parts.t);
  if (!t || !signatures.length) return false;
  if (Math.abs(now / 1000 - t) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return signatures.some((sig) => sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
}

export type StripeSubscription = {
  id: string;
  customer: string;
  status: "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "incomplete" | "incomplete_expired" | "paused";
  trial_end: number | null;
  current_period_end: number | null;
  cancel_at_period_end: boolean;
  metadata: Record<string, string>;
  items?: { data: { price?: { recurring?: { interval?: string } } }[] };
};
