# Launch checklist: your steps

Everything in the app is built. These are the steps only you can do (they need your accounts and
your payment details). Do them in order. Each one says **where to click** and **what to copy where**.
Tick them off as you go.

> **Where settings go:** "Netlify" below means **Netlify → your site → Site configuration →
> Environment variables → Add a variable**. After adding variables, redeploy:
> **Deploys → Trigger deploy → Deploy site**.

---

## Step 1: Pick your web address (15 min)

A real address (like `app.familybubble.com`) looks trustworthy, and it's needed for email and Apple Pay.

- [ ] Buy a domain (Namecheap, Google Domains/Squarespace, GoDaddy…).
- [ ] **Netlify → Domain management → Add a domain** and follow the steps (it tells you which DNS records to add).
- [ ] In Netlify, add the variable **`SITE_URL`** = `https://your-address.com` (no slash at the end).

## Step 2: Email (for password resets and confirmations) (20 min)

- [ ] Sign up free at **resend.com**.
- [ ] **Resend → Domains → Add domain** → enter your domain → copy the DNS records it shows into your domain
      provider's DNS settings → wait until Resend says **Verified**.
- [ ] **Resend → API Keys → Create API key** (permission: Sending access).
- [ ] In Netlify add:
  - **`RESEND_API_KEY`** = the key (starts with `re_`)
  - **`EMAIL_FROM`** = `Family Bubble <hello@your-address.com>` (use your verified domain)
  - **`EMAIL_REPLY_TO`** (optional) = your support email

## Step 3: Stripe, test mode first (30 min)

Create your account at **stripe.com** if you haven't. Keep the **Test mode** switch (top right) **ON** for this step.

**3a. Keys**
- [ ] **Developers → API keys**. In Netlify add:
  - **`STRIPE_PUBLISHABLE_KEY`** = the **Publishable key** (`pk_test_…`)
  - **`STRIPE_SECRET_KEY`** = the **Secret key** (`sk_test_…`). Never share it or paste it anywhere else.

**3b. Billing settings**
- [ ] **Settings → Billing → Subscriptions and emails** (in newer dashboards: **Billing → Revenue recovery**):
  - **Manage failed payments → Smart Retries: on**; "If all retries for a payment fail": **Cancel the subscription**.
  - **Customer emails:** turn on emails for **successful payments** (receipts), **failed payments**, and
    **upcoming renewals / trial ending**. Stripe sends these; the app doesn't send receipts itself.
- [ ] **Settings → Payment methods → Payment method domains → Add a domain** → your domain (lets Apple Pay and Google Pay appear).
- [ ] (Recommended) **Settings → Tax** → turn on **Stripe Tax** if you need to collect sales tax/VAT.

## Step 4: The webhook (Supabase Edge Function) (20 min)

This is how Stripe tells your app about renewals, failed payments and cancellations.

On your computer, in the project folder, run these one at a time (your **project ref** is in Supabase →
Project Settings → General → Reference ID):

```bash
npx supabase login
```

```bash
npx supabase functions deploy stripe-webhook --project-ref YOUR_PROJECT_REF
```

- [ ] In Stripe (test mode): **Developers → Webhooks → Add endpoint** (newer dashboards: **Workbench → Webhooks → Add destination**):
  - **Endpoint URL:** `https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`
  - **Events:** click "Select events" and add these 20:
    `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`,
    `customer.subscription.paused`, `customer.subscription.resumed`, `customer.subscription.trial_will_end`,
    `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, `invoice.finalized`,
    `invoice.updated`, `invoice.voided`, `invoice.marked_uncollectible`,
    `subscription_schedule.updated`, `subscription_schedule.released`, `subscription_schedule.canceled`,
    `subscription_schedule.completed`, `customer.updated`, `payment_method.attached`, `payment_method.updated`
  - Save, then **reveal the Signing secret** (`whsec_…`) and copy it.
- [ ] Give the function its two secrets (replace the values):

```bash
npx supabase secrets set --project-ref YOUR_PROJECT_REF STRIPE_SECRET_KEY=sk_test_YOUR_KEY STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET
```

- [ ] Also add **`STRIPE_WEBHOOK_SECRET`** in Netlify (same `whsec_…`), then **redeploy** the site.

## Step 5: Admin access and a test run (20 min)

- [ ] In Netlify add **`PLATFORM_ADMIN_EMAILS`** = your sign-in email (your account must already exist). Redeploy.
- [ ] Sign in → avatar menu → **Admin**: check the prices ($4.99 / $49) and trial (7 days) and that
      "Charge for the app" is on. Your own family stays free automatically.
- [ ] Open the site in a **private window** → **Start free trial** → create a test family → on the plan
      page use Stripe's test card **4242 4242 4242 4242**, any future date, any CVC, any ZIP.
- [ ] In that test family: **Settings → Subscription & billing**. Try **Switch to yearly**, **Update payment
      method**, **Cancel**, **Resume**. Everything should update within seconds.
- [ ] Also try card **4000 0025 0000 3155** (asks for bank confirmation) and **4000 0000 0000 0341**
      (saves, then fails at the first charge).
- [ ] In Stripe → **Developers → Webhooks → your endpoint**, deliveries should show **200 OK**.
- [ ] Open `https://your-address.com/api/health` while signed in: everything should say ok.
- [ ] When done, delete the test family (Settings → Your family's data → Delete).

## Step 6: Supabase safety (5 min)

- [ ] **Supabase → Database → Backups:** for a paying business, use the **Pro plan** (daily backups;
      consider Point-in-Time Recovery).
- [ ] **Supabase → Advisors → Security Advisor:** should show no errors (the app locks every table).

## Step 7: Legal and business (your timing)

- [ ] Have a lawyer review **/terms** and **/privacy-policy** (children can have accounts: ask about **COPPA**
      in the US and **GDPR** if you sell in Europe). Tell me any wording changes.
- [ ] Decide the business name/entity and a support email; I'll put them on the website and in the Terms.

## Step 8: Go live (15 min)

- [ ] In Stripe, finish **Activate account** (business details and bank account for payouts).
- [ ] Turn **Test mode OFF** and repeat **Step 3a** with the **live** keys (`pk_live_…`, `sk_live_…`) in Netlify.
- [ ] Repeat the **Step 4 webhook** in live mode (live mode has its own endpoint and its own `whsec_…`), and
      run the `supabase secrets set` command again with the live values.
- [ ] Redeploy. Do one real subscription with your own card, then cancel it in the app.
- [ ] Tell me **"push"**: I'll publish all the finished work to your live site (nothing is pushed until you say so).

## Later (optional)

- **App Store / Google Play:** needs Apple ($99/year) and Google ($25 once) developer accounts and a Mac.
  Families can already install the app from the browser ("Get the app" on the sign-in page).
- **Two-step sign-in**, **error alerts** (e.g. Sentry): see `docs/SECURITY.md`.

---

### All settings in one place (Netlify → Environment variables)

| Variable | What to put | Needed |
|---|---|---|
| `DATABASE_URL` | Supabase connection string (already set) | yes |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Photo storage (already set) | yes |
| `SITE_URL` | `https://your-address.com` | yes |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_…` then `pk_live_…` | yes |
| `STRIPE_SECRET_KEY` | `sk_test_…` then `sk_live_…` | yes |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from the webhook | yes |
| `PLATFORM_ADMIN_EMAILS` | your email | yes |
| `RESEND_API_KEY` | `re_…` | yes |
| `EMAIL_FROM` | `Family Bubble <hello@your-address.com>` | yes |
| `EMAIL_REPLY_TO` | your support email | optional |
| `HEALTH_CHECK_KEY` | any long random text, to open `/api/health?key=…` | optional |

**Supabase Edge Function secrets** (set with `npx supabase secrets set`): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
