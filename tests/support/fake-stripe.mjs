/**
 * A small in-memory stand-in for the Stripe API, for tests only. It speaks
 * the same REST shapes the billing engine uses (customers, SetupIntents,
 * prices, subscriptions, schedules, invoices) and records the webhook events
 * Stripe would send. Test helpers live under /test/…:
 *   POST /test/confirm_setup   {client_secret, card: "ok"|"decline"|"3ds"}  (what the Payment Element does)
 *   POST /test/confirm_payment {client_secret, fail?}                       (3-D Secure completed in the browser)
 *   POST /test/advance                                                       (jump to the end of every period: renew, convert trials, end cancelled plans, apply schedules)
 *   GET  /test/events?after=N                                                (webhook events since N)
 * Run standalone: node tests/support/run-fake-stripe.mjs [port]
 */
import http from "node:http";

export function createFakeStripe() {
  let seq = 1000;
  const id = (p) => `${p}_${(seq++).toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  let clock = Math.floor(Date.now() / 1000);
  const DAY = 86400;
  const db = { customers: {}, pms: {}, setupIntents: {}, products: {}, prices: {}, subs: {}, invoices: {}, pis: {}, schedules: {} };
  const events = [];
  const emit = (type, object) => events.push({ id: id("evt"), type, created: clock, data: { object: JSON.parse(JSON.stringify(object)) } });

  const err = (status, message, code, extra = {}) => ({ status, body: { error: { message, code, type: "card_error", ...extra } } });
  const notFound = (what) => err(404, `No such ${what}`, "resource_missing");
  const periodEnd = (start, interval) => start + (interval === "year" ? 365 : 30) * DAY;
  const pmFor = (sub) => sub.default_payment_method ?? db.customers[sub.customer]?.invoice_settings?.default_payment_method ?? null;

  /** Bill a subscription: make an invoice and try the card. */
  function charge(sub, amount, reason, start, end) {
    const pmId = pmFor(sub);
    const behavior = pmId ? db.pms[pmId]?.behavior : "decline";
    const inv = {
      id: id("in"), object: "invoice", customer: sub.customer, subscription: sub.id, status: "open", amount_due: amount, amount_paid: 0, currency: sub.items.data[0].price.currency,
      billing_reason: reason, created: clock, number: `FB-${seq}`, hosted_invoice_url: `https://invoice.stripe.test/${seq}`, invoice_pdf: `https://invoice.stripe.test/${seq}.pdf`,
      subscription_details: { metadata: sub.metadata }, lines: { data: [{ period: { start, end }, description: `${sub.items.data[0].price.nickname ?? "Plan"}` }] }, payment_intent: null,
    };
    const pi = { id: id("pi"), object: "payment_intent", status: "succeeded", client_secret: "", last_payment_error: null, invoice: inv.id, amount };
    pi.client_secret = `${pi.id}_secret_x`;
    db.pis[pi.id] = pi;
    inv.payment_intent = pi.id;
    db.invoices[inv.id] = inv;
    if (amount <= 0 || behavior === "ok") {
      pi.status = "succeeded";
      inv.status = "paid";
      inv.amount_paid = Math.max(0, amount);
      emit("invoice.paid", inv);
    } else if (behavior === "3ds") {
      pi.status = "requires_action";
      emit("invoice.payment_action_required", inv);
    } else {
      pi.status = "requires_payment_method";
      pi.last_payment_error = { message: "Your card was declined.", code: "card_declined" };
      emit("invoice.payment_failed", inv);
    }
    sub.latest_invoice = inv.id;
    return inv;
  }

  function expand(obj, paths = []) {
    const out = JSON.parse(JSON.stringify(obj));
    const lookup = (v) => (typeof v !== "string" ? v : v.startsWith("pm_") ? db.pms[v] : v.startsWith("sub_sched_") ? db.schedules[v] : v.startsWith("in_") ? db.invoices[v] : v.startsWith("pi_") ? db.pis[v] : v.startsWith("cus_") ? db.customers[v] : v.startsWith("price_") ? db.prices[v] : v);
    for (const p of paths) {
      const parts = p.split(".");
      let cur = out;
      for (let i = 0; i < parts.length && cur; i++) {
        const k = parts[i];
        if (cur[k] == null) break;
        if (typeof cur[k] === "string") cur[k] = JSON.parse(JSON.stringify(lookup(cur[k]) ?? cur[k]));
        cur = cur[k];
      }
    }
    return out;
  }

  function subPublic(sub) {
    const { _pendingPrice, ...rest } = sub;
    return rest;
  }

  function route(method, path, q, body) {
    const p = path.replace(/^\/v1/, "");
    const exp = [...(q.expand ?? []), ...(body.expand ?? [])];
    let m;
    // Customers
    if (method === "POST" && p === "/customers") {
      const c = { id: id("cus"), object: "customer", email: body.email, name: body.name, metadata: body.metadata ?? {}, invoice_settings: { default_payment_method: null } };
      db.customers[c.id] = c;
      return { body: c };
    }
    if ((m = p.match(/^\/customers\/([^/]+)$/))) {
      const c = db.customers[m[1]];
      if (!c) return notFound("customer");
      if (method === "POST") {
        if (body.invoice_settings?.default_payment_method) c.invoice_settings.default_payment_method = body.invoice_settings.default_payment_method;
        emit("customer.updated", c);
      }
      return { body: expand(c, exp) };
    }
    // SetupIntents
    if (method === "POST" && p === "/setup_intents") {
      const si = { id: id("seti"), object: "setup_intent", customer: body.customer, status: "requires_payment_method", payment_method: null, usage: body.usage, metadata: body.metadata ?? {} };
      si.client_secret = `${si.id}_secret_x`;
      db.setupIntents[si.id] = si;
      return { body: si };
    }
    if ((m = p.match(/^\/setup_intents\/([^/]+)$/))) return db.setupIntents[m[1]] ? { body: db.setupIntents[m[1]] } : notFound("setup_intent");
    if ((m = p.match(/^\/payment_methods\/([^/]+)$/))) return db.pms[m[1]] ? { body: db.pms[m[1]] } : notFound("payment_method");
    // Products & prices
    if ((m = p.match(/^\/products\/([^/]+)$/))) return db.products[m[1]] ? { body: db.products[m[1]] } : notFound("product");
    if (method === "POST" && p === "/products") {
      db.products[body.id] = { id: body.id, name: body.name };
      return { body: db.products[body.id] };
    }
    if (method === "GET" && p === "/prices") {
      const keys = q.lookup_keys ?? [];
      return { body: { data: Object.values(db.prices).filter((x) => keys.includes(x.lookup_key) && x.active) } };
    }
    if (method === "POST" && p === "/prices") {
      const pr = { id: id("price"), object: "price", product: body.product, unit_amount: Number(body.unit_amount), currency: body.currency, recurring: { interval: body.recurring.interval }, lookup_key: body.lookup_key, nickname: body.nickname, active: true };
      db.prices[pr.id] = pr;
      return { body: pr };
    }
    if ((m = p.match(/^\/prices\/([^/]+)$/))) return db.prices[m[1]] ? { body: db.prices[m[1]] } : notFound("price");
    // Subscriptions
    if (method === "POST" && p === "/subscriptions") {
      const price = db.prices[body.items[0].price];
      if (!price) return notFound("price");
      const sub = {
        id: id("sub"), object: "subscription", customer: body.customer, metadata: body.metadata ?? {}, status: "active", cancel_at_period_end: false, canceled_at: null, ended_at: null,
        items: { data: [{ id: id("si"), price }] }, default_payment_method: body.default_payment_method ?? null, schedule: null, latest_invoice: null, pending_update: null, trial_end: null,
        current_period_start: clock, current_period_end: periodEnd(clock, price.recurring.interval),
      };
      db.subs[sub.id] = sub;
      if (body.trial_period_days) {
        sub.status = "trialing";
        sub.trial_end = clock + Number(body.trial_period_days) * DAY;
        sub.current_period_end = sub.trial_end;
        charge(sub, 0, "subscription_create", clock, sub.trial_end);
      } else {
        const inv = charge(sub, price.unit_amount, "subscription_create", sub.current_period_start, sub.current_period_end);
        if (inv.status !== "paid") sub.status = "incomplete";
      }
      emit("customer.subscription.created", subPublic(sub));
      return { body: expand(subPublic(sub), exp) };
    }
    if ((m = p.match(/^\/subscriptions\/([^/]+)$/))) {
      const sub = db.subs[m[1]];
      if (!sub) return notFound("subscription");
      if (method === "DELETE") {
        sub.status = sub.status === "incomplete" ? "incomplete_expired" : "canceled";
        sub.canceled_at = sub.ended_at = clock;
        emit("customer.subscription.deleted", subPublic(sub));
        return { body: subPublic(sub) };
      }
      if (method === "POST") {
        if (sub.schedule && "cancel_at_period_end" in body) return err(400, "This subscription is managed by a subscription schedule.", "resource_missing");
        if ("cancel_at_period_end" in body) sub.cancel_at_period_end = body.cancel_at_period_end === "true";
        if (body.default_payment_method) sub.default_payment_method = body.default_payment_method;
        if (body.items?.[0]?.price) {
          const next = db.prices[body.items[0].price];
          const cur = sub.items.data[0].price;
          if (sub.status === "trialing" || body.proration_behavior === "none") sub.items.data[0].price = next;
          else if (next.recurring.interval !== cur.recurring.interval) {
            // Interval change: bill now (new price minus unused time), new period starts now.
            const unused = Math.round((cur.unit_amount * (sub.current_period_end - clock)) / (sub.current_period_end - sub.current_period_start));
            const amount = next.unit_amount - unused;
            const prev = { price: cur, start: sub.current_period_start, end: sub.current_period_end };
            sub.items.data[0].price = next;
            sub.current_period_start = clock;
            sub.current_period_end = periodEnd(clock, next.recurring.interval);
            const inv = charge(sub, amount, "subscription_update", sub.current_period_start, sub.current_period_end);
            if (inv.status !== "paid" && body.payment_behavior === "pending_if_incomplete") {
              sub.items.data[0].price = prev.price;
              sub.current_period_start = prev.start;
              sub.current_period_end = prev.end;
              sub.pending_update = { subscription_items: [{ price: next.id }] };
            }
          } else sub.items.data[0].price = next;
        }
        emit("customer.subscription.updated", subPublic(sub));
      }
      return { body: expand(subPublic(sub), exp) };
    }
    // Subscription schedules
    if (method === "POST" && p === "/subscription_schedules") {
      const sub = db.subs[body.from_subscription];
      if (sub.schedule) return err(400, "Subscription already has a schedule.", "resource_already_exists");
      const sch = { id: id("sub_sched"), object: "subscription_schedule", subscription: sub.id, status: "active", end_behavior: "release", phases: [{ start_date: sub.current_period_start, end_date: sub.current_period_end, items: [{ price: sub.items.data[0].price.id, quantity: 1 }] }] };
      db.schedules[sch.id] = sch;
      sub.schedule = sch.id;
      return { body: sch };
    }
    if ((m = p.match(/^\/subscription_schedules\/([^/]+)(\/release)?$/))) {
      const sch = db.schedules[m[1]];
      if (!sch) return notFound("subscription_schedule");
      if (m[2]) {
        if (sch.status !== "active") return err(400, "Schedule is not active.", "schedule_not_active");
        sch.status = "released";
        sch.released_subscription = sch.subscription;
        db.subs[sch.subscription].schedule = null;
        emit("subscription_schedule.released", sch);
        return { body: sch };
      }
      if (method === "POST") {
        sch.phases = body.phases.map((ph) => ({ start_date: ph.start_date ? Number(ph.start_date) : null, end_date: ph.end_date ? Number(ph.end_date) : null, items: ph.items.map((it) => ({ price: it.price, quantity: 1 })) }));
        sch.phases[1].start_date = sch.phases[0].end_date;
        emit("subscription_schedule.updated", sch);
      }
      return { body: expand(sch, exp) };
    }
    // Invoices
    if (method === "GET" && p === "/invoices") {
      const list = Object.values(db.invoices).filter((i) => i.customer === q.customer && (!q.status || i.status === q.status)).sort((a, b) => b.created - a.created);
      return { body: { data: list.slice(0, Number(q.limit ?? 10)) } };
    }
    if ((m = p.match(/^\/invoices\/([^/]+)(\/pay)?$/))) {
      const inv = db.invoices[m[1]];
      if (!inv) return notFound("invoice");
      if (m[2]) {
        const sub = db.subs[inv.subscription];
        const behavior = db.pms[pmFor(sub)]?.behavior ?? "decline";
        const pi = db.pis[inv.payment_intent];
        if (behavior === "3ds") {
          pi.status = "requires_action";
          return err(402, "This payment requires authentication.", "invoice_payment_intent_requires_action");
        }
        if (behavior !== "ok") return err(402, "Your card was declined.", "card_declined");
        pi.status = "succeeded";
        pi.last_payment_error = null;
        inv.status = "paid";
        inv.amount_paid = inv.amount_due;
        if (sub.status === "past_due" || sub.status === "unpaid" || sub.status === "incomplete") sub.status = "active";
        emit("invoice.paid", inv);
        emit("customer.subscription.updated", subPublic(sub));
      }
      return { body: expand(inv, exp) };
    }
    return err(404, `Fake Stripe doesn't implement ${method} ${p}`, "not_implemented");
  }

  /** Move to the end of every period: trials convert, plans renew (or fail), cancellations end, schedules switch. */
  function advance() {
    const subs = Object.values(db.subs).filter((s) => ["trialing", "active", "past_due"].includes(s.status));
    clock = Math.max(...subs.map((s) => s.current_period_end), clock) + 60;
    for (const sub of subs) {
      if (sub.cancel_at_period_end) {
        sub.status = "canceled";
        sub.canceled_at = sub.ended_at = clock;
        emit("customer.subscription.deleted", subPublic(sub));
        continue;
      }
      if (sub.schedule) {
        const sch = db.schedules[sub.schedule];
        const next = sch.phases[1];
        if (next) sub.items.data[0].price = db.prices[next.items[0].price];
        sch.status = "released";
        sch.released_subscription = sub.id;
        sub.schedule = null;
        emit("subscription_schedule.released", sch);
      }
      const price = sub.items.data[0].price;
      sub.current_period_start = sub.current_period_end;
      sub.current_period_end = periodEnd(sub.current_period_start, price.recurring.interval);
      const inv = charge(sub, price.unit_amount, "subscription_cycle", sub.current_period_start, sub.current_period_end);
      sub.status = inv.status === "paid" ? "active" : "past_due";
      emit("customer.subscription.updated", subPublic(sub));
    }
  }

  function test(path, body) {
    if (path === "/test/confirm_setup") {
      const si = Object.values(db.setupIntents).find((s) => s.client_secret === body.client_secret);
      if (!si) return { status: 404, body: { error: { message: "No such setup intent" } } };
      if (body.card === "fail") return { body: { error: { message: "Your card was declined.", code: "card_declined" } } };
      const card = { ok: { brand: "visa", last4: "4242" }, decline: { brand: "visa", last4: "0341" }, "3ds": { brand: "mastercard", last4: "3155" } }[body.card ?? "ok"];
      const pm = { id: id("pm"), object: "payment_method", type: "card", customer: si.customer, card: { ...card, exp_month: 12, exp_year: 2030 }, behavior: body.card ?? "ok" };
      db.pms[pm.id] = pm;
      si.status = "succeeded";
      si.payment_method = pm.id;
      return { body: { id: si.id, status: "succeeded", payment_method: pm.id } };
    }
    if (path === "/test/confirm_payment") {
      const pi = Object.values(db.pis).find((x) => x.client_secret === body.client_secret);
      if (!pi) return { status: 404, body: { error: { message: "No such payment intent" } } };
      if (body.fail) return { body: { error: { message: "Authentication failed." } } };
      pi.status = "succeeded";
      const inv = db.invoices[pi.invoice];
      inv.status = "paid";
      inv.amount_paid = inv.amount_due;
      const sub = db.subs[inv.subscription];
      if (sub.pending_update) {
        sub.items.data[0].price = db.prices[sub.pending_update.subscription_items[0].price];
        sub.current_period_start = clock;
        sub.current_period_end = periodEnd(clock, sub.items.data[0].price.recurring.interval);
        sub.pending_update = null;
      }
      if (["incomplete", "past_due", "unpaid"].includes(sub.status)) sub.status = "active";
      emit("invoice.paid", inv);
      emit("customer.subscription.updated", subPublic(sub));
      return { body: { paymentIntent: { id: pi.id, status: "succeeded" } } };
    }
    if (path === "/test/advance") {
      advance();
      return { body: { clock } };
    }
    if (path === "/test/set_card_behavior") {
      for (const pm of Object.values(db.pms)) if (pm.customer === body.customer) pm.behavior = body.behavior;
      return { body: { ok: true } };
    }
    return { status: 404, body: { error: { message: "unknown test endpoint" } } };
  }

  return { route, test, events, db, get clock() { return clock; } };
}

/** Parse Stripe's form encoding (a[b][0][c]=v) into nested objects/arrays. */
export function parseForm(text) {
  const out = {};
  for (const [rawKey, value] of new URLSearchParams(text)) {
    const keys = rawKey.split(/\[|\]/).filter((k) => k !== "");
    let cur = out;
    keys.forEach((k, i) => {
      const last = i === keys.length - 1;
      const nextIsIndex = !last && /^\d+$/.test(keys[i + 1]);
      if (last) cur[k] = value;
      else cur = cur[k] ??= nextIsIndex ? [] : {};
    });
  }
  return out;
}

export function startFakeStripe(port = 0) {
  const fake = createFakeStripe();
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const url = new URL(req.url, "http://x");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "*");
      if (req.method === "OPTIONS") return res.end();
      let r;
      try {
        if (url.pathname.startsWith("/test/")) r = url.pathname === "/test/events" ? { body: fake.events.slice(Number(url.searchParams.get("after") ?? 0)) } : fake.test(url.pathname, raw ? JSON.parse(raw) : {});
        else r = fake.route(req.method, url.pathname, parseForm(url.search.slice(1)), parseForm(raw));
      } catch (e) {
        r = { status: 500, body: { error: { message: String(e?.stack ?? e) } } };
      }
      res.statusCode = r.status ?? 200;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(r.body));
    });
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({ fake, server, url: `http://127.0.0.1:${server.address().port}` })));
}
