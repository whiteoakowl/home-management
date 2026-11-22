/**
 * Subscription lifecycle, end to end: the real billing engine + a real
 * Postgres database + a fake Stripe (tests/support/fake-stripe.mjs), with
 * webhook events delivered the way Stripe would.
 * Runs only when TEST_DATABASE_URL points at a migrated database, e.g.
 *   TEST_DATABASE_URL=postgres://hearth:hearth@localhost:5432/hearth_merge npm test
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import {
  appStatus,
  cancelSubscription,
  changePlan,
  createSetupIntent,
  createStripe,
  ensureCustomer,
  ensurePrices,
  handleStripeEvent,
  hasAccessStatus,
  payOpenInvoice,
  resumeSubscription,
  signStripePayload,
  startSubscription,
  updatePaymentMethod,
  verifyStripeSignature,
  type BillingCtx,
  type StripeEvent,
} from "../supabase/functions/_shared/billing-core";
import { startFakeStripe } from "./support/fake-stripe.mjs";

const DB_URL = process.env.TEST_DATABASE_URL;

test("signatures: valid accepted, tampered/old/missing rejected", async () => {
  const body = JSON.stringify({ id: "evt_1" });
  const header = await signStripePayload(body, "whsec_test");
  assert.equal(await verifyStripeSignature(body, header, "whsec_test"), true);
  assert.equal(await verifyStripeSignature(body + " ", header, "whsec_test"), false);
  assert.equal(await verifyStripeSignature(body, header, "whsec_other"), false);
  assert.equal(await verifyStripeSignature(body, await signStripePayload(body, "whsec_test", Math.floor(Date.now() / 1000) - 3600), "whsec_test"), false);
  assert.equal(await verifyStripeSignature(body, null, "whsec_test"), false);
});

test("status mapping and access", () => {
  assert.equal(appStatus("trialing", true), "trialing");
  assert.equal(appStatus("trialing", false), "incomplete"); // no card on file, no access
  assert.equal(appStatus("incomplete_expired", false), "expired");
  for (const s of ["trialing", "active", "past_due", "complimentary"]) assert.equal(hasAccessStatus(s), true, s);
  for (const s of ["none", "incomplete", "unpaid", "canceled", "expired", "paused"]) assert.equal(hasAccessStatus(s), false, s);
});

const skip = !DB_URL && "set TEST_DATABASE_URL to run";
let pool: pg.Pool;
let server: { close: () => void };
let fakeUrl: string;
let ctx: BillingCtx;
let familyId: string;
let delivered = 0;

const row = async () => (await pool.query("select * from family_billing where family_id = $1", [familyId])).rows[0];
/** Deliver every new fake-Stripe event through the webhook handler, as Stripe would. */
async function deliver() {
  const events: StripeEvent[] = await (await fetch(`${fakeUrl}/test/events?after=${delivered}`)).json();
  delivered += events.length;
  for (const e of events) {
    const payload = JSON.stringify(e);
    assert.ok(await verifyStripeSignature(payload, await signStripePayload(payload, "whsec_t"), "whsec_t"));
    await handleStripeEvent(ctx, JSON.parse(payload));
  }
  return events.length;
}
const post = (path: string, body: unknown) => fetch(`${fakeUrl}${path}`, { method: "POST", body: JSON.stringify(body) }).then((r) => r.json());
/** What the Payment Element does in the browser: confirm the SetupIntent with a card. */
async function saveCard(card: "ok" | "decline" | "3ds") {
  const customerId = await ensureCustomer(ctx, familyId, { email: "billing-test@example.com", name: "Billing Test" });
  const secret = await createSetupIntent(ctx, familyId, customerId);
  const si = await post("/test/confirm_setup", { client_secret: secret, card });
  return { customerId, setupIntentId: si.id as string };
}
const settings = { brandName: "Family Bubble", monthlyPriceCents: 499, yearlyPriceCents: 4900, currency: "usd" };

before(async () => {
  if (!DB_URL) return;
  pool = new pg.Pool({ connectionString: DB_URL });
  const started = await startFakeStripe();
  server = started.server;
  fakeUrl = started.url;
  ctx = { db: { query: async (t, p = []) => (await pool.query(t, p)).rows }, stripe: createStripe("sk_test_fake", fakeUrl) };
  await pool.query("update platform_settings set stripe_prices_key = null where id = 'default'");
  familyId = (await pool.query("insert into families (name, timezone) values ('Billing Test', 'America/New_York') returning id")).rows[0].id;
});

after(async () => {
  if (!DB_URL) return;
  await pool.query("delete from families where id = $1", [familyId]);
  await pool.query("update platform_settings set stripe_prices_key = null, stripe_monthly_price_id = null, stripe_yearly_price_id = null where id = 'default'");
  await pool.end();
  server.close();
});

test("full subscription lifecycle", { skip }, async (t) => {
  const prices = await ensurePrices(ctx, settings);

  await t.test("prices are created once and reused", async () => {
    assert.deepEqual(await ensurePrices(ctx, settings), prices);
  });

  await t.test("stale cached price ids (e.g. after switching test → live keys) are replaced", async () => {
    await pool.query("update platform_settings set stripe_monthly_price_id = 'price_gone', stripe_yearly_price_id = 'price_gone2' where id = 'default'");
    const fresh = await ensurePrices(ctx, settings);
    assert.equal(fresh.monthly, prices.monthly); // found again by lookup key
    assert.equal(fresh.yearly, prices.yearly);
  });

  await t.test("new family: free trial starts with a card on file, nothing charged", async () => {
    const { customerId, setupIntentId } = await saveCard("ok");
    const r = await startSubscription(ctx, { familyId, customerId, setupIntentId, plan: "monthly", prices, trialDays: 7 });
    assert.equal(r.ok, true, r.message);
    await deliver();
    const b = await row();
    assert.equal(b.status, "trialing");
    assert.equal(b.plan, "monthly");
    assert.equal(b.pm_last4, "4242");
    assert.ok(b.trial_ends_at);
    assert.equal(hasAccessStatus(b.status), true);
  });

  await t.test("can't subscribe twice", async () => {
    const { customerId, setupIntentId } = await saveCard("ok");
    const r = await startSubscription(ctx, { familyId, customerId, setupIntentId, plan: "monthly", prices, trialDays: 7 });
    assert.equal(r.ok, false);
  });

  await t.test("switching plan during the trial keeps the trial", async () => {
    const r = await changePlan(ctx, { familyId, plan: "yearly", prices });
    assert.equal(r.ok, true, r.message);
    assert.equal((await row()).plan, "yearly");
    assert.equal((await row()).status, "trialing");
    await changePlan(ctx, { familyId, plan: "monthly", prices });
  });

  await t.test("trial converts to paid; invoice lands in billing history", async () => {
    await post("/test/advance", {});
    await deliver();
    const b = await row();
    assert.equal(b.status, "active");
    const inv = (await pool.query("select * from billing_invoices where family_id = $1 and status = 'paid' and amount_paid = 499", [familyId])).rows;
    assert.equal(inv.length, 1);
  });

  await t.test("upgrade monthly → yearly now, with credit for unused time", async () => {
    const r = await changePlan(ctx, { familyId, plan: "yearly", prices });
    assert.equal(r.ok, true, r.message);
    await deliver();
    const b = await row();
    assert.equal(b.plan, "yearly");
    assert.equal(b.price_cents, 4900);
    const inv = (await pool.query("select amount_paid from billing_invoices where family_id = $1 and billing_reason = 'subscription_update'", [familyId])).rows[0];
    assert.ok(inv && inv.amount_paid < 4900 && inv.amount_paid >= 4900 - 499, `prorated ${inv?.amount_paid}`);
  });

  await t.test("downgrade yearly → monthly waits for the end of the paid year", async () => {
    const r = await changePlan(ctx, { familyId, plan: "monthly", prices });
    assert.equal(r.ok, true, r.message);
    await deliver();
    let b = await row();
    assert.equal(b.plan, "yearly");
    assert.equal(b.pending_plan, "monthly");
    assert.ok(b.pending_plan_at);
    // Change of mind: stay yearly.
    await changePlan(ctx, { familyId, plan: "yearly", prices });
    await deliver();
    b = await row();
    assert.equal(b.pending_plan, null);
    // Downgrade again and let the year end.
    await changePlan(ctx, { familyId, plan: "monthly", prices });
    await post("/test/advance", {});
    await deliver();
    b = await row();
    assert.equal(b.plan, "monthly");
    assert.equal(b.pending_plan, null);
    assert.equal(b.status, "active");
  });

  await t.test("failed renewal → past_due (grace access) with the reason; new card pays it", async () => {
    await post("/test/set_card_behavior", { customer: (await row()).stripe_customer_id, behavior: "decline" });
    await post("/test/advance", {});
    await deliver();
    let b = await row();
    assert.equal(b.status, "past_due");
    assert.equal(hasAccessStatus(b.status), true);
    assert.match(b.last_payment_error ?? "", /declined/);
    // Retrying with the same card fails clearly.
    const retry = await payOpenInvoice(ctx, { familyId });
    assert.equal(retry.ok, false);
    // A new card fixes it.
    const { customerId, setupIntentId } = await saveCard("ok");
    const r = await updatePaymentMethod(ctx, { familyId, customerId, setupIntentId });
    assert.equal(r.ok, true, r.message);
    await deliver();
    b = await row();
    assert.equal(b.status, "active");
    assert.equal(b.last_payment_error, null);
  });

  await t.test("cancel at period end, resume, cancel again → ends with no access", async () => {
    let r = await cancelSubscription(ctx, { familyId, reason: "Too expensive" });
    assert.equal(r.ok, true, r.message);
    assert.equal((await row()).cancel_at_period_end, true);
    assert.equal(hasAccessStatus((await row()).status), true); // keeps access until the end
    r = await resumeSubscription(ctx, { familyId });
    assert.equal(r.ok, true);
    assert.equal((await row()).cancel_at_period_end, false);
    await cancelSubscription(ctx, { familyId, reason: null });
    await post("/test/advance", {});
    await deliver();
    const b = await row();
    assert.equal(b.status, "canceled");
    assert.equal(hasAccessStatus(b.status), false);
    assert.ok(b.ended_at);
  });

  await t.test("coming back: no second trial; bank confirmation (3-D Secure) then active", async () => {
    const { customerId, setupIntentId } = await saveCard("3ds");
    const r = await startSubscription(ctx, { familyId, customerId, setupIntentId, plan: "yearly", prices, trialDays: 7 });
    assert.equal(r.ok, true, r.message);
    assert.ok(r.clientSecret, "needs the bank's confirmation");
    await deliver();
    assert.equal((await row()).status, "incomplete");
    assert.equal(hasAccessStatus((await row()).status), false);
    await post("/test/confirm_payment", { client_secret: r.clientSecret });
    await deliver();
    const b = await row();
    assert.equal(b.status, "active");
    assert.equal(b.plan, "yearly");
    assert.equal(b.trial_ends_at, null);
  });

  await t.test("webhook events are processed once", async () => {
    const [e] = await (await fetch(`${fakeUrl}/test/events?after=0`)).json();
    assert.equal(await handleStripeEvent(ctx, e), "duplicate");
  });

  await t.test("a declined first payment gives a clear message and no access", async () => {
    await pool.query("update family_billing set status = 'canceled', stripe_subscription_id = null, trial_ends_at = now() where family_id = $1", [familyId]);
    const { customerId, setupIntentId } = await saveCard("decline");
    const r = await startSubscription(ctx, { familyId, customerId, setupIntentId, plan: "monthly", prices, trialDays: 7 });
    assert.equal(r.ok, false);
    assert.match(r.message, /declined/i);
    assert.equal(hasAccessStatus((await row()).status), false);
  });

  await t.test("complimentary families are never overwritten", async () => {
    await pool.query("update family_billing set status = 'complimentary' where family_id = $1", [familyId]);
    await post("/test/advance", {});
    await deliver();
    assert.equal((await row()).status, "complimentary");
  });
});
