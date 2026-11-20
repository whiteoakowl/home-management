/**
 * End-to-end check of the Supabase Edge Function `stripe-webhook`, run in
 * Deno against a fake Stripe and a local, migrated Postgres:
 *   TEST_DATABASE_URL=postgres://… npx tsx tests/edge-webhook.e2e.mts
 * Needs Deno installed.
 */
import pg from "pg";
import { spawn } from "node:child_process";
import { createStripe, ensureCustomer, ensurePrices, createSetupIntent, startSubscription, signStripePayload } from "../supabase/functions/_shared/billing-core";
import { startFakeStripe } from "./support/fake-stripe.mjs";

const DB = process.env.TEST_DATABASE_URL;
if (!DB) throw new Error("Set TEST_DATABASE_URL");
const { url, server } = await startFakeStripe();
const pool = new pg.Pool({ connectionString: DB });
const ctx = { db: { query: async (t: string, p: unknown[] = []) => (await pool.query(t, p)).rows as never[] }, stripe: createStripe("sk_test_fake", url) };
await pool.query("update platform_settings set stripe_prices_key = null where id = 'default'");
const fam = (await pool.query("insert into families (name, timezone) values ('Edge Test', 'UTC') returning id")).rows[0].id;
const deno = spawn("deno", ["run", "--allow-net", "--allow-env", "--allow-read", "supabase/functions/stripe-webhook/index.ts"], {
  env: { ...process.env, SUPABASE_DB_URL: DB, STRIPE_SECRET_KEY: "sk_test_fake", STRIPE_WEBHOOK_SECRET: "whsec_edge", STRIPE_API_BASE: url, PORT: "8787", DENO_NO_UPDATE_CHECK: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});
let log = ""; deno.stdout.on("data", (d) => (log += d)); deno.stderr.on("data", (d) => (log += d));
for (let i = 0; i < 60 && !/Listening/.test(log); i++) await new Promise((r) => setTimeout(r, 500));
const fn = "http://127.0.0.1:8000";
try {
  console.log("edge started:", /Listening/.test(log));
  const prices = await ensurePrices(ctx, { brandName: "Family Bubble", monthlyPriceCents: 499, yearlyPriceCents: 4900, currency: "usd" });
  const customerId = await ensureCustomer(ctx, fam, { email: "edge@example.com", name: "Edge" });
  const secret = await createSetupIntent(ctx, fam, customerId);
  const si = await (await fetch(`${url}/test/confirm_setup`, { method: "POST", body: JSON.stringify({ client_secret: secret, card: "ok" }) })).json();
  // Start the subscription, then wipe our row so only the Edge Function can restore it.
  await startSubscription(ctx, { familyId: fam, customerId, setupIntentId: si.id, plan: "monthly", prices, trialDays: 7 });
  await pool.query("update family_billing set status = 'none', plan = null, pm_last4 = null where family_id = $1", [fam]);
  await fetch(`${url}/test/advance`, { method: "POST", body: "{}" });
  const events = await (await fetch(`${url}/test/events?after=0`)).json();
  const statuses: number[] = [];
  for (const e of events) {
    const body = JSON.stringify(e);
    const r = await fetch(fn, { method: "POST", headers: { "stripe-signature": await signStripePayload(body, "whsec_edge") }, body });
    statuses.push(r.status);
  }
  console.log("events sent:", events.length, "responses:", [...new Set(statuses)].join(","));
  const row = (await pool.query("select status, plan, pm_brand, pm_last4 from family_billing where family_id = $1", [fam])).rows[0];
  console.log("family_billing after edge webhooks:", JSON.stringify(row));
  console.log("invoices stored:", (await pool.query("select count(*)::int n from billing_invoices where family_id = $1", [fam])).rows[0].n);
  const bad = await fetch(fn, { method: "POST", headers: { "stripe-signature": "t=1,v1=deadbeef" }, body: JSON.stringify(events[0]) });
  console.log("forged signature ->", bad.status);
  const stale = JSON.stringify(events[0]);
  const old = await fetch(fn, { method: "POST", headers: { "stripe-signature": await signStripePayload(stale, "whsec_edge", Math.floor(Date.now() / 1000) - 3600) }, body: stale });
  console.log("hour-old signature ->", old.status);
  const dup = await fetch(fn, { method: "POST", headers: { "stripe-signature": await signStripePayload(stale, "whsec_edge") }, body: stale });
  console.log("replayed event ->", dup.status, JSON.stringify(await dup.json()));
  console.log("GET ->", (await fetch(fn)).status);
} finally {
  deno.kill();
  await pool.query("delete from families where id = $1", [fam]);
  await pool.query("update platform_settings set stripe_prices_key = null where id = 'default'");
  await pool.end();
  server.close();
  if (!/Listening/.test(log)) console.log(log.slice(-1500));
}
