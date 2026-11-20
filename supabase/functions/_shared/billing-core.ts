/**
 * Family Bubble billing engine (Stripe Billing + Postgres/Supabase).
 *
 * Plain TypeScript with no runtime-specific imports: it uses only `fetch`,
 * WebCrypto and a tiny `Db` adapter, so the SAME code runs in
 *   • the Supabase Edge Function `stripe-webhook` (Deno), and
 *   • the Next.js app (server actions and the backup webhook route).
 *
 * Card details never pass through here: the browser sends them straight to
 * Stripe (Payment Element). We only keep Stripe ids plus the card's brand,
 * last 4 digits and expiry, which PCI DSS allows.
 */

// ─── Adapters ────────────────────────────────────────────────────────────────

/** Run a parameterized SQL statement ($1, $2…) and return its rows. */
export type Db = { query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> };

export type StripeParams = { [key: string]: StripeValue };
type StripeValue = string | number | boolean | null | undefined | StripeParams | (string | number | StripeParams)[];
export type StripeFn = <T = Record<string, unknown>>(method: "GET" | "POST" | "DELETE", path: string, params?: StripeParams, opts?: { idempotencyKey?: string }) => Promise<T>;

export type BillingCtx = { db: Db; stripe: StripeFn };

export class StripeError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly status?: number,
    readonly declineCode?: string,
  ) {
    super(message);
  }
}

/** The Stripe API version this code is written against (sent with every request). */
export const STRIPE_API_VERSION = "2024-06-20";

/** Stripe's form encoding: a[b][c]=v, list[0]=v. */
export function encodeParams(params: StripeParams, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === "object" ? encodeParams(item, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(item))));
    else if (typeof v === "object") encodeParams(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

/** A Stripe REST client for a secret key. `base` is only overridden in tests. */
export function createStripe(secretKey: string, base = "https://api.stripe.com"): StripeFn {
  return async <T,>(method: "GET" | "POST" | "DELETE", path: string, params: StripeParams = {}, opts: { idempotencyKey?: string } = {}) => {
    const body = encodeParams(params).toString();
    const url = `${base}/v1${path}${method !== "POST" && body ? `${path.includes("?") ? "&" : "?"}${body}` : ""}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Stripe-Version": STRIPE_API_VERSION,
          ...(opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : {}),
        },
        body: method === "POST" ? body : undefined,
        signal: AbortSignal.timeout(20_000),
      });
    } catch (e) {
      throw new StripeError(`Couldn't reach Stripe: ${e instanceof Error ? e.message : String(e)}`, "network_error");
    }
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: string; decline_code?: string } } & T;
    if (!res.ok) throw new StripeError(json.error?.message ?? `Stripe error ${res.status}`, json.error?.code, res.status, json.error?.decline_code);
    return json;
  };
}

// ─── Webhook signatures (WebCrypto: works in Deno and Node) ───────────────────

const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Check a Stripe-Signature header (HMAC-SHA256 of "t.payload", 5-minute tolerance). */
export async function verifyStripeSignature(payload: string, header: string | null, secret: string, nowMs = Date.now()) {
  if (!header || !secret) return false;
  const parts = header.split(",").map((kv) => kv.split("=") as [string, string]);
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || !signatures.length || Math.abs(nowMs / 1000 - t) > 300) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = toHex(await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${payload}`)));
  return signatures.some((s) => safeEqual(s, expected));
}

/** Build a valid Stripe-Signature header (used by tests and local tools). */
export async function signStripePayload(payload: string, secret: string, t = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return `t=${t},v1=${toHex(await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${payload}`)))}`;
}

// ─── Statuses ────────────────────────────────────────────────────────────────

export type Plan = "monthly" | "yearly";
/**
 * Our status for a family. Stripe's status, except a trial without a saved
 * card counts as "incomplete" (no access until a card is on file).
 */
export type BillingStatus = "none" | "trialing" | "active" | "past_due" | "unpaid" | "incomplete" | "canceled" | "expired" | "paused" | "complimentary";
/** Statuses that may use the app. past_due = Stripe is retrying a failed renewal (grace period). */
export const ACCESS_STATUSES: readonly BillingStatus[] = ["complimentary", "trialing", "active", "past_due"];
export const hasAccessStatus = (s: string) => (ACCESS_STATUSES as readonly string[]).includes(s);
/** A subscription that's still running (can change plan, cancel, update card). */
export const LIVE_STRIPE = ["trialing", "active", "past_due", "unpaid", "incomplete", "paused"];

export function appStatus(stripeStatus: string, hasPaymentMethod: boolean): BillingStatus {
  switch (stripeStatus) {
    case "trialing":
      return hasPaymentMethod ? "trialing" : "incomplete";
    case "active":
    case "past_due":
    case "unpaid":
    case "incomplete":
    case "canceled":
    case "paused":
      return stripeStatus;
    case "incomplete_expired":
      return "expired";
    default:
      return "canceled";
  }
}

// ─── Stripe object shapes (just the fields we use) ───────────────────────────

type Card = { brand?: string; last4?: string; exp_month?: number; exp_year?: number };
export type StripePaymentMethod = { id: string; customer?: string | null; card?: Card | null; type?: string };
type Price = { id: string; unit_amount: number | null; currency: string; recurring?: { interval?: string } | null; lookup_key?: string | null; active?: boolean };
type PaymentIntent = { id: string; status: string; client_secret: string; last_payment_error?: { message?: string } | null };
type Invoice = {
  id: string;
  customer: string;
  subscription?: string | null;
  number?: string | null;
  status?: string | null;
  amount_due: number;
  amount_paid: number;
  currency: string;
  description?: string | null;
  billing_reason?: string | null;
  created: number;
  hosted_invoice_url?: string | null;
  invoice_pdf?: string | null;
  payment_intent?: string | PaymentIntent | null;
  subscription_details?: { metadata?: Record<string, string> | null } | null;
  lines?: { data?: { period?: { start: number; end: number }; description?: string | null }[] };
};
type Schedule = { id: string; status?: string; phases: { start_date: number; end_date: number | null; items: { price: string | Price }[] }[] };
export type StripeSubscription = {
  id: string;
  status: string;
  customer: string;
  metadata?: Record<string, string> | null;
  items: { data: { id: string; price: Price }[] };
  current_period_start?: number | null;
  current_period_end?: number | null;
  trial_end?: number | null;
  cancel_at_period_end?: boolean;
  canceled_at?: number | null;
  ended_at?: number | null;
  default_payment_method?: string | StripePaymentMethod | null;
  schedule?: string | Schedule | null;
  latest_invoice?: string | (Invoice & { payment_intent?: PaymentIntent | string | null }) | null;
  pending_update?: unknown;
};
type Customer = { id: string; deleted?: boolean; metadata?: Record<string, string>; invoice_settings?: { default_payment_method?: string | StripePaymentMethod | null } };

const ts = (s: number | null | undefined) => (s ? new Date(s * 1000).toISOString() : null);
const intervalPlan = (interval: string | undefined | null): Plan | null => (interval === "year" ? "yearly" : interval === "month" ? "monthly" : null);

// ─── Database helpers ────────────────────────────────────────────────────────

export type BillingRow = {
  family_id: string;
  status: string;
  plan: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_schedule_id: string | null;
  trial_ends_at: Date | string | null;
};

export async function billingRow(db: Db, familyId: string) {
  const [row] = await db.query<BillingRow>("select family_id, status, plan, stripe_customer_id, stripe_subscription_id, stripe_schedule_id, trial_ends_at from family_billing where family_id = $1", [familyId]);
  return row ?? null;
}

async function familyForCustomer(db: Db, customerId: string) {
  const [row] = await db.query<{ family_id: string }>("select family_id from family_billing where stripe_customer_id = $1 limit 1", [customerId]);
  return row?.family_id ?? null;
}

async function familyExists(db: Db, familyId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(familyId)) return false;
  const [row] = await db.query<{ n: number }>("select count(*)::int as n from families where id = $1", [familyId]);
  return !!row?.n;
}

// ─── Sync: Stripe → database ─────────────────────────────────────────────────

/** Read a subscription (with its card, schedule and latest invoice) and copy it onto the family's row. */
export async function syncSubscription(ctx: BillingCtx, subscriptionId: string, hintFamilyId?: string) {
  const sub = await ctx.stripe<StripeSubscription>("GET", `/subscriptions/${subscriptionId}`, {
    expand: ["default_payment_method", "schedule", "latest_invoice.payment_intent"],
  });
  return applySubscription(ctx, sub, hintFamilyId);
}

export async function applySubscription(ctx: BillingCtx, sub: StripeSubscription, hintFamilyId?: string) {
  const { db, stripe } = ctx;
  let familyId = sub.metadata?.familyId ?? hintFamilyId ?? (await familyForCustomer(db, sub.customer));
  if (!familyId || !(await familyExists(db, familyId))) return { familyId: null, status: null as BillingStatus | null };
  if (hintFamilyId && sub.metadata?.familyId && sub.metadata.familyId !== hintFamilyId) return { familyId: null, status: null };
  familyId = String(familyId);

  // The card: the subscription's own, else the customer's default.
  let pm: StripePaymentMethod | null = typeof sub.default_payment_method === "object" ? (sub.default_payment_method ?? null) : null;
  if (!pm && typeof sub.default_payment_method === "string") pm = await stripe<StripePaymentMethod>("GET", `/payment_methods/${sub.default_payment_method}`);
  if (!pm) {
    const cust = await stripe<Customer>("GET", `/customers/${sub.customer}`, { expand: ["invoice_settings.default_payment_method"] });
    const d = cust.invoice_settings?.default_payment_method;
    pm = typeof d === "object" ? (d ?? null) : d ? await stripe<StripePaymentMethod>("GET", `/payment_methods/${d}`) : null;
  }

  const item = sub.items.data[0];
  const price = item?.price;
  const status = appStatus(sub.status, !!pm);

  // A plan change waiting for the end of the period (annual → monthly).
  let pendingPlan: Plan | null = null;
  let pendingAt: string | null = null;
  let scheduleId: string | null = null;
  const sched = typeof sub.schedule === "object" ? sub.schedule : sub.schedule ? await stripe<Schedule>("GET", `/subscription_schedules/${sub.schedule}`) : null;
  if (sched && (!sched.status || sched.status === "active" || sched.status === "not_started")) {
    scheduleId = sched.id;
    const next = sched.phases.find((p) => p.start_date > Math.floor(Date.now() / 1000) - 60 && p.start_date >= (sub.current_period_end ?? 0) - 60);
    const nextPrice = next?.items[0]?.price;
    if (next && nextPrice) {
      const p = typeof nextPrice === "object" ? nextPrice : await stripe<Price>("GET", `/prices/${nextPrice}`);
      if (p.id !== price?.id) {
        pendingPlan = intervalPlan(p.recurring?.interval);
        pendingAt = ts(next.start_date);
      }
    }
  }

  // Why the last payment failed (shown with "Update card").
  const inv = typeof sub.latest_invoice === "object" ? sub.latest_invoice : null;
  const pi = inv && typeof inv.payment_intent === "object" ? inv.payment_intent : null;
  const lastError = status === "past_due" || status === "unpaid" || status === "incomplete" ? (pi?.last_payment_error?.message ?? (pi?.status === "requires_action" ? "Your bank needs you to confirm this payment." : null)) : null;

  const [existing] = await db.query<{ status: string; stripe_subscription_id: string | null }>("select status, stripe_subscription_id from family_billing where family_id = $1", [familyId]);
  // Free families stay free; and a finished old subscription never overwrites a newer live one.
  if (existing?.status === "complimentary") return { familyId, status: "complimentary" as BillingStatus };
  if (existing?.stripe_subscription_id && existing.stripe_subscription_id !== sub.id && !LIVE_STRIPE.includes(sub.status) && hasAccessStatus(existing.status)) return { familyId, status: existing.status as BillingStatus };

  const values: Record<string, unknown> = {
    status,
    stripe_status: sub.status,
    plan: intervalPlan(price?.recurring?.interval),
    stripe_customer_id: sub.customer,
    stripe_subscription_id: sub.id,
    stripe_price_id: price?.id ?? null,
    price_cents: price?.unit_amount ?? null,
    currency: price?.currency ?? null,
    trial_ends_at: ts(sub.trial_end),
    current_period_start: ts(sub.current_period_start),
    current_period_end: ts(sub.current_period_end),
    cancel_at_period_end: !!sub.cancel_at_period_end,
    canceled_at: ts(sub.canceled_at),
    ended_at: ts(sub.ended_at),
    pm_brand: pm?.card?.brand ?? (pm ? (pm.type ?? null) : null),
    pm_last4: pm?.card?.last4 ?? null,
    pm_exp_month: pm?.card?.exp_month ?? null,
    pm_exp_year: pm?.card?.exp_year ?? null,
    pending_plan: pendingPlan,
    pending_plan_at: pendingAt,
    stripe_schedule_id: scheduleId,
    latest_invoice_id: inv?.id ?? (typeof sub.latest_invoice === "string" ? sub.latest_invoice : null),
    last_payment_error: lastError,
  };
  const cols = Object.keys(values);
  await db.query(
    `insert into family_billing (family_id, ${cols.join(", ")}, updated_at) values ($1, ${cols.map((_, i) => `$${i + 2}`).join(", ")}, now())
     on conflict (family_id) do update set ${cols.map((c) => `${c} = excluded.${c}`).join(", ")}, updated_at = now()
     where family_billing.status <> 'complimentary'`,
    [familyId, ...cols.map((c) => values[c])],
  );
  return { familyId, status };
}

/** Save (or update) one invoice in billing history. */
export async function saveInvoice(ctx: BillingCtx, invoice: Invoice, hintFamilyId?: string) {
  const { db } = ctx;
  const familyId = invoice.subscription_details?.metadata?.familyId ?? hintFamilyId ?? (await familyForCustomer(db, invoice.customer));
  if (!familyId || !(await familyExists(db, familyId))) return null;
  if (invoice.status === "draft") return null;
  const line = invoice.lines?.data?.[0];
  await db.query(
    `insert into billing_invoices (id, family_id, stripe_customer_id, stripe_subscription_id, number, status, amount_due, amount_paid, currency, description, billing_reason, period_start, period_end, hosted_invoice_url, invoice_pdf, invoice_created_at, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, now())
     on conflict (id) do update set status = excluded.status, amount_due = excluded.amount_due, amount_paid = excluded.amount_paid, number = excluded.number,
       hosted_invoice_url = excluded.hosted_invoice_url, invoice_pdf = excluded.invoice_pdf, description = excluded.description, updated_at = now()`,
    [
      invoice.id,
      familyId,
      invoice.customer,
      invoice.subscription ?? null,
      invoice.number ?? null,
      invoice.status ?? null,
      invoice.amount_due,
      invoice.amount_paid,
      invoice.currency,
      invoice.description ?? line?.description ?? null,
      invoice.billing_reason ?? null,
      ts(line?.period?.start),
      ts(line?.period?.end),
      invoice.hosted_invoice_url ?? null,
      invoice.invoice_pdf ?? null,
      ts(invoice.created),
    ],
  );
  return familyId;
}

/** Load the last 24 invoices from Stripe into billing history (first visit, or if a webhook was missed). */
export async function backfillInvoices(ctx: BillingCtx, familyId: string, customerId: string) {
  const list = await ctx.stripe<{ data: Invoice[] }>("GET", "/invoices", { customer: customerId, limit: 24 });
  for (const inv of list.data) await saveInvoice(ctx, inv, familyId);
  return list.data.length;
}

// ─── Webhook events ──────────────────────────────────────────────────────────

export type StripeEvent = { id: string; type: string; data: { object: Record<string, unknown> } };

/** The events to subscribe the webhook endpoint to (Stripe Dashboard → Webhooks). */
export const WEBHOOK_EVENTS = [
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "customer.subscription.trial_will_end",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "invoice.finalized",
  "invoice.updated",
  "invoice.voided",
  "invoice.marked_uncollectible",
  "subscription_schedule.updated",
  "subscription_schedule.released",
  "subscription_schedule.canceled",
  "subscription_schedule.completed",
  "customer.updated",
  "payment_method.attached",
  "payment_method.updated",
] as const;

/**
 * Process one verified webhook event. Idempotent: each event id is handled
 * once, and every handler re-reads the current state from Stripe, so events
 * arriving late or out of order can't leave stale data behind.
 */
export async function handleStripeEvent(ctx: BillingCtx, event: StripeEvent) {
  const { db } = ctx;
  const [seen] = await db.query<{ id: string }>("select id from stripe_events where id = $1", [event.id]);
  if (seen) return "duplicate";
  const obj = event.data.object as Record<string, unknown>;
  const t = event.type;

  if (t.startsWith("customer.subscription.")) {
    await syncSubscription(ctx, String(obj.id));
  } else if (t.startsWith("invoice.")) {
    const invoice = obj as unknown as Invoice;
    await saveInvoice(ctx, invoice);
    if (invoice.subscription) await syncSubscription(ctx, invoice.subscription);
  } else if (t.startsWith("subscription_schedule.")) {
    const subId = (obj.subscription as string | null) ?? (obj.released_subscription as string | null);
    if (subId) await syncSubscription(ctx, subId);
  } else if (t === "customer.updated" || t.startsWith("payment_method.")) {
    const customerId = t === "customer.updated" ? String(obj.id) : (obj.customer as string | null);
    if (customerId) {
      const [row] = await db.query<{ stripe_subscription_id: string | null }>("select stripe_subscription_id from family_billing where stripe_customer_id = $1 limit 1", [customerId]);
      if (row?.stripe_subscription_id) await syncSubscription(ctx, row.stripe_subscription_id);
    }
  }
  await db.query("insert into stripe_events (id, type) values ($1, $2) on conflict (id) do nothing", [event.id, t]);
  return "processed";
}

// ─── Prices (from the admin's settings) ──────────────────────────────────────

export const PRODUCT_ID = "family_bubble_subscription";
export type PriceSettings = { brandName: string; monthlyPriceCents: number; yearlyPriceCents: number; currency: string };

/**
 * Make sure Stripe has a Product and active monthly/yearly Prices matching
 * the admin's prices. Prices can't be edited in Stripe, so a new price makes
 * new Price objects (looked up by lookup_key); existing subscribers keep
 * theirs. Ids are cached in platform_settings.
 */
export async function ensurePrices(ctx: BillingCtx, s: PriceSettings) {
  const { db, stripe } = ctx;
  const cur = s.currency.toLowerCase();
  const key = `${s.monthlyPriceCents}/${s.yearlyPriceCents}/${cur}`;
  const [cached] = await db.query<{ stripe_prices_key: string | null; stripe_monthly_price_id: string | null; stripe_yearly_price_id: string | null }>(
    "select stripe_prices_key, stripe_monthly_price_id, stripe_yearly_price_id from platform_settings where id = 'default'",
  );
  if (cached?.stripe_prices_key === key && cached.stripe_monthly_price_id && cached.stripe_yearly_price_id) {
    // Still there and active? (Not after switching test → live keys, or archiving a price in the Dashboard.)
    const ok = async (id: string) => {
      try {
        return !!(await stripe<Price>("GET", `/prices/${id}`)).active;
      } catch (e) {
        if (e instanceof StripeError && e.status === 404) return false;
        throw e;
      }
    };
    if ((await ok(cached.stripe_monthly_price_id)) && (await ok(cached.stripe_yearly_price_id))) return { monthly: cached.stripe_monthly_price_id, yearly: cached.stripe_yearly_price_id };
  }

  try {
    await stripe("GET", `/products/${PRODUCT_ID}`);
  } catch (e) {
    if (!(e instanceof StripeError) || e.status !== 404) throw e;
    await stripe("POST", "/products", { id: PRODUCT_ID, name: s.brandName, description: "Family subscription: every feature for the whole family." }, { idempotencyKey: `product-${PRODUCT_ID}` });
  }
  const price = async (interval: "month" | "year", cents: number) => {
    const lookup = `fb_${interval}_${cents}_${cur}`;
    const found = await stripe<{ data: Price[] }>("GET", "/prices", { lookup_keys: [lookup], active: true, limit: 1 });
    if (found.data[0]) return found.data[0].id;
    const created = await stripe<Price>(
      "POST",
      "/prices",
      { product: PRODUCT_ID, unit_amount: cents, currency: cur, recurring: { interval }, lookup_key: lookup, nickname: `${s.brandName} ${interval === "year" ? "yearly" : "monthly"}` },
      { idempotencyKey: `price-${lookup}` },
    );
    return created.id;
  };
  const monthly = await price("month", s.monthlyPriceCents);
  const yearly = await price("year", s.yearlyPriceCents);
  await db.query(
    "update platform_settings set stripe_product_id = $1, stripe_monthly_price_id = $2, stripe_yearly_price_id = $3, stripe_prices_key = $4 where id = 'default'",
    [PRODUCT_ID, monthly, yearly, key],
  );
  return { monthly, yearly };
}

// ─── Customer & cards ────────────────────────────────────────────────────────

export async function ensureCustomer(ctx: BillingCtx, familyId: string, owner: { email: string; name: string }) {
  const row = await billingRow(ctx.db, familyId);
  if (row?.stripe_customer_id) {
    const c = await ctx.stripe<Customer>("GET", `/customers/${row.stripe_customer_id}`).catch(() => null);
    if (c && !c.deleted) return c.id;
  }
  const c = await ctx.stripe<Customer>("POST", "/customers", { email: owner.email, name: owner.name, metadata: { familyId } }, { idempotencyKey: `customer-${familyId}-${row?.stripe_customer_id ?? "new"}` });
  await ctx.db.query(
    "insert into family_billing (family_id, stripe_customer_id, updated_at) values ($1, $2, now()) on conflict (family_id) do update set stripe_customer_id = excluded.stripe_customer_id, updated_at = now()",
    [familyId, c.id],
  );
  return c.id;
}

/** A SetupIntent: the Payment Element uses its client secret to save a card on Stripe, off this server. */
export async function createSetupIntent(ctx: BillingCtx, familyId: string, customerId: string) {
  const si = await ctx.stripe<{ id: string; client_secret: string }>("POST", "/setup_intents", {
    customer: customerId,
    usage: "off_session",
    payment_method_types: ["card"],
    metadata: { familyId },
  });
  return si.client_secret;
}

/** The card saved by a confirmed SetupIntent, after checking it belongs to this family's customer. */
async function confirmedCard(ctx: BillingCtx, customerId: string, setupIntentId: string) {
  if (!/^seti_[A-Za-z0-9]+$/.test(setupIntentId)) throw new BillingError("That payment didn't go through. Please try again.");
  const si = await ctx.stripe<{ status: string; customer: string | null; payment_method: string | null }>("GET", `/setup_intents/${setupIntentId}`);
  if (si.customer !== customerId || si.status !== "succeeded" || !si.payment_method) throw new BillingError("Your card wasn't saved. Please try again.");
  await ctx.stripe("POST", `/customers/${customerId}`, { invoice_settings: { default_payment_method: si.payment_method } });
  return si.payment_method;
}

/** Something the person can fix (shown to them as is). */
export class BillingError extends Error {
  readonly userFacing = true;
}

export type FlowResult = { ok: true; message: string; status?: BillingStatus | null; clientSecret?: string } | { ok: false; message: string; clientSecret?: string };

const live = (status: string) => ["trialing", "active", "past_due", "unpaid"].includes(status);

/** What a failed/declined Stripe call means for the person. */
function declined(e: unknown): FlowResult {
  if (e instanceof BillingError) return { ok: false, message: e.message };
  if (e instanceof StripeError) {
    if (e.code === "card_declined" || e.code === "expired_card" || e.code === "incorrect_cvc" || e.code === "insufficient_funds" || e.code === "processing_error")
      return { ok: false, message: `${e.message} Please try another card.` };
    if (e.code === "network_error") return { ok: false, message: "We couldn't reach the payment service. Please try again in a moment." };
    console.error("Stripe error", e.code, e.message);
    return { ok: false, message: "The payment service couldn't complete this. Please try again." };
  }
  throw e;
}

// ─── Flows (called by the app's server actions after sign-in checks) ─────────

/**
 * Start a subscription with the card the Payment Element just saved.
 * New families get the free trial (no charge until it ends); families that
 * had one before pay now. If the bank wants 3-D Secure, returns a client
 * secret for the browser to finish (stripe.handleNextAction).
 */
export async function startSubscription(
  ctx: BillingCtx,
  args: { familyId: string; customerId: string; setupIntentId: string; plan: Plan; prices: { monthly: string; yearly: string }; trialDays: number },
): Promise<FlowResult> {
  try {
    const row = await billingRow(ctx.db, args.familyId);
    if (row?.status === "complimentary") return { ok: false, message: "Your family already uses the app free of charge." };
    if (row?.stripe_subscription_id && live(row.status)) return { ok: false, message: "Your family already has a subscription. You can change it on the Subscription page." };
    // An earlier attempt whose first payment never completed: replace it.
    if (row?.stripe_subscription_id && row.status === "incomplete") await ctx.stripe("DELETE", `/subscriptions/${row.stripe_subscription_id}`).catch(() => null);
    const trialUsed = !!row?.trial_ends_at || !!row?.stripe_subscription_id;
    const pm = await confirmedCard(ctx, args.customerId, args.setupIntentId);
    const sub = await ctx.stripe<StripeSubscription>(
      "POST",
      "/subscriptions",
      {
        customer: args.customerId,
        items: [{ price: args.plan === "yearly" ? args.prices.yearly : args.prices.monthly }],
        default_payment_method: pm,
        metadata: { familyId: args.familyId },
        payment_behavior: "allow_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        ...(!trialUsed && args.trialDays > 0 ? { trial_period_days: args.trialDays, trial_settings: { end_behavior: { missing_payment_method: "cancel" } } } : {}),
        expand: ["latest_invoice.payment_intent", "default_payment_method"],
      },
      { idempotencyKey: `subscribe-${args.setupIntentId}-${args.plan}` },
    );
    const { status } = await applySubscription(ctx, sub, args.familyId);
    const pi = typeof sub.latest_invoice === "object" && sub.latest_invoice && typeof sub.latest_invoice.payment_intent === "object" ? sub.latest_invoice.payment_intent : null;
    if (sub.status === "incomplete" && pi?.status === "requires_action") return { ok: true, message: "Confirm the payment with your bank.", status, clientSecret: pi.client_secret };
    if (sub.status === "incomplete") return { ok: false, message: pi?.last_payment_error?.message ? `${pi.last_payment_error.message} Please try another card.` : "The payment didn't go through. Please try another card." };
    return { ok: true, message: sub.status === "trialing" ? "Your free trial has started." : "You're subscribed. Thank you!", status };
  } catch (e) {
    return declined(e);
  }
}

/** Load the family's live subscription, or explain why there isn't one. */
async function liveSubscription(ctx: BillingCtx, familyId: string) {
  const row = await billingRow(ctx.db, familyId);
  if (!row?.stripe_subscription_id) throw new BillingError("Your family doesn't have a subscription yet.");
  const sub = await ctx.stripe<StripeSubscription>("GET", `/subscriptions/${row.stripe_subscription_id}`, { expand: ["schedule"] });
  if (sub.metadata?.familyId && sub.metadata.familyId !== familyId) throw new BillingError("Subscription not found.");
  if (!LIVE_STRIPE.includes(sub.status)) throw new BillingError("Your subscription has ended. Choose a plan to start again.");
  return { row, sub };
}

async function releaseSchedule(ctx: BillingCtx, sub: StripeSubscription) {
  const id = typeof sub.schedule === "object" ? sub.schedule?.id : sub.schedule;
  if (id) await ctx.stripe("POST", `/subscription_schedules/${id}/release`).catch((e) => {
    if (!(e instanceof StripeError) || e.status !== 400) throw e; // already released
  });
}

/**
 * Switch between monthly and yearly.
 *  • During the trial: switches right away; nothing is charged until the trial ends.
 *  • Monthly → yearly: right away; the unused part of the month is credited
 *    and the yearly price is charged now (only applied if the payment succeeds).
 *  • Yearly → monthly: at the end of the paid year (nobody loses paid time).
 */
export async function changePlan(ctx: BillingCtx, args: { familyId: string; plan: Plan; prices: { monthly: string; yearly: string } }): Promise<FlowResult> {
  try {
    const { sub } = await liveSubscription(ctx, args.familyId);
    const item = sub.items.data[0]!;
    const current = intervalPlan(item.price.recurring?.interval);
    const target = args.plan === "yearly" ? args.prices.yearly : args.prices.monthly;
    if (sub.cancel_at_period_end) return { ok: false, message: "Your plan is set to end. Resume it first, then change plans." };
    if (sub.status === "past_due" || sub.status === "unpaid" || sub.status === "incomplete") return { ok: false, message: "Please fix the payment problem first (update your card or pay the open invoice)." };

    // Asking for the plan you're on: just drop any pending switch.
    if (current === args.plan) {
      await releaseSchedule(ctx, sub);
      await syncSubscription(ctx, sub.id, args.familyId);
      return { ok: true, message: `You'll stay on the ${args.plan} plan.` };
    }
    await releaseSchedule(ctx, sub);

    if (sub.status === "trialing") {
      await ctx.stripe("POST", `/subscriptions/${sub.id}`, { items: [{ id: item.id, price: target }], proration_behavior: "none" });
      await syncSubscription(ctx, sub.id, args.familyId);
      return { ok: true, message: `Switched to the ${args.plan} plan. Your trial continues; the first charge is when it ends.` };
    }

    if (args.plan === "yearly") {
      const updated = await ctx.stripe<StripeSubscription>("POST", `/subscriptions/${sub.id}`, {
        items: [{ id: item.id, price: target }],
        proration_behavior: "always_invoice",
        payment_behavior: "pending_if_incomplete",
        expand: ["latest_invoice.payment_intent"],
      });
      await syncSubscription(ctx, sub.id, args.familyId);
      const pi = typeof updated.latest_invoice === "object" && updated.latest_invoice && typeof updated.latest_invoice.payment_intent === "object" ? updated.latest_invoice.payment_intent : null;
      if (updated.pending_update && pi?.status === "requires_action") return { ok: true, message: "Confirm the payment with your bank to finish switching.", clientSecret: pi.client_secret };
      if (updated.pending_update) return { ok: false, message: "The payment for the yearly plan didn't go through, so you're still on monthly. Update your card and try again." };
      return { ok: true, message: "You're on the yearly plan now. Unused time on your monthly plan was credited." };
    }

    // Yearly → monthly at the end of the paid period.
    const schedule = await ctx.stripe<Schedule>("POST", "/subscription_schedules", { from_subscription: sub.id });
    const phase = schedule.phases[0]!;
    await ctx.stripe("POST", `/subscription_schedules/${schedule.id}`, {
      end_behavior: "release",
      proration_behavior: "none",
      phases: [
        { items: [{ price: item.price.id, quantity: 1 }], start_date: phase.start_date, end_date: sub.current_period_end ?? phase.end_date ?? undefined },
        { items: [{ price: target, quantity: 1 }], iterations: 1 },
      ],
    });
    await syncSubscription(ctx, sub.id, args.familyId);
    return { ok: true, message: `You'll switch to monthly when your current year ends${sub.current_period_end ? ` on ${new Date(sub.current_period_end * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : ""}.` };
  } catch (e) {
    return declined(e);
  }
}

/** Cancel at the end of the paid period (or trial): no more charges, access until then. */
export async function cancelSubscription(ctx: BillingCtx, args: { familyId: string; reason?: string | null }): Promise<FlowResult> {
  try {
    const { sub } = await liveSubscription(ctx, args.familyId);
    await releaseSchedule(ctx, sub);
    const updated = await ctx.stripe<StripeSubscription>("POST", `/subscriptions/${sub.id}`, {
      cancel_at_period_end: true,
      ...(args.reason ? { cancellation_details: { comment: args.reason.slice(0, 500) } } : {}),
    });
    await syncSubscription(ctx, sub.id, args.familyId);
    const end = updated.status === "trialing" ? updated.trial_end : updated.current_period_end;
    return { ok: true, message: `Your subscription is cancelled. You can keep using the app until ${end ? new Date(end * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "the end of this period"}, and you won't be charged again.` };
  } catch (e) {
    return declined(e);
  }
}

export async function resumeSubscription(ctx: BillingCtx, args: { familyId: string }): Promise<FlowResult> {
  try {
    const { sub } = await liveSubscription(ctx, args.familyId);
    await ctx.stripe("POST", `/subscriptions/${sub.id}`, { cancel_at_period_end: false });
    await syncSubscription(ctx, sub.id, args.familyId);
    return { ok: true, message: "Welcome back! Your subscription will renew as usual." };
  } catch (e) {
    return declined(e);
  }
}

/** Use the card just saved by the Payment Element from now on, and retry a failed payment. */
export async function updatePaymentMethod(ctx: BillingCtx, args: { familyId: string; customerId: string; setupIntentId: string }): Promise<FlowResult> {
  try {
    const pm = await confirmedCard(ctx, args.customerId, args.setupIntentId);
    const row = await billingRow(ctx.db, args.familyId);
    if (row?.stripe_subscription_id) {
      const sub = await ctx.stripe<StripeSubscription>("GET", `/subscriptions/${row.stripe_subscription_id}`);
      if (LIVE_STRIPE.includes(sub.status)) await ctx.stripe("POST", `/subscriptions/${sub.id}`, { default_payment_method: pm });
      if (sub.status === "past_due" || sub.status === "unpaid" || sub.status === "incomplete") {
        const paid = await payOpenInvoice(ctx, { familyId: args.familyId });
        if (!paid.ok || paid.clientSecret) return paid;
        return { ok: true, message: "Card updated and your payment went through. Thank you!" };
      }
      await syncSubscription(ctx, sub.id, args.familyId);
    }
    return { ok: true, message: "Your payment method is updated." };
  } catch (e) {
    return declined(e);
  }
}

/** Retry the open (failed) invoice now with the saved card. */
export async function payOpenInvoice(ctx: BillingCtx, args: { familyId: string }): Promise<FlowResult> {
  try {
    const row = await billingRow(ctx.db, args.familyId);
    if (!row?.stripe_customer_id) return { ok: false, message: "There's nothing to pay." };
    const open = await ctx.stripe<{ data: Invoice[] }>("GET", "/invoices", { customer: row.stripe_customer_id, status: "open", limit: 1 });
    const inv = open.data[0];
    if (!inv) {
      if (row.stripe_subscription_id) await syncSubscription(ctx, row.stripe_subscription_id, args.familyId);
      return { ok: true, message: "There's nothing to pay right now." };
    }
    try {
      const paid = await ctx.stripe<Invoice>("POST", `/invoices/${inv.id}/pay`, { off_session: true });
      await saveInvoice(ctx, paid, args.familyId);
    } catch (e) {
      if (e instanceof StripeError && (e.code === "invoice_payment_intent_requires_action" || e.code === "authentication_required")) {
        const full = await ctx.stripe<Invoice>("GET", `/invoices/${inv.id}`, { expand: ["payment_intent"] });
        const pi = typeof full.payment_intent === "object" ? full.payment_intent : null;
        if (pi?.client_secret) return { ok: true, message: "Confirm the payment with your bank.", clientSecret: pi.client_secret };
      }
      throw e;
    }
    if (row.stripe_subscription_id) await syncSubscription(ctx, row.stripe_subscription_id, args.familyId);
    return { ok: true, message: "Payment received. Thank you!" };
  } catch (e) {
    return declined(e);
  }
}
