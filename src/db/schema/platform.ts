import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { families, familyMembers } from "./core";

/**
 * Settings for the whole service (one row, id = 'default'), edited by the
 * platform admins (emails in PLATFORM_ADMIN_EMAILS): brand name, prices and
 * trial length. Prices are what new subscribers pay; existing subscriptions
 * keep the price they signed up at (Stripe's rule).
 */
export const platformSettings = pgTable("platform_settings", {
  id: text("id").primaryKey().default("default"),
  brandName: text("brand_name").notNull().default("Family Bubble"),
  monthlyPriceCents: integer("monthly_price_cents").notNull().default(499),
  yearlyPriceCents: integer("yearly_price_cents").notNull().default(4900),
  currency: text("currency").notNull().default("usd"),
  trialDays: integer("trial_days").notNull().default(7),
  /** Off = everyone uses the app free (billing switched off). */
  billingEnabled: boolean("billing_enabled").notNull().default(true),
  /** Stripe Product / Price ids made from the prices above (Prices can't change, so new prices get new ids). */
  stripeProductId: text("stripe_product_id"),
  stripeMonthlyPriceId: text("stripe_monthly_price_id"),
  stripeYearlyPriceId: text("stripe_yearly_price_id"),
  /** "monthlyCents/yearlyCents/currency" the cached price ids were made for. */
  stripePricesKey: text("stripe_prices_key"),
  ...timestamps,
});

/**
 * A family's subscription (one row per family), kept in step with Stripe by
 * the webhook (Supabase Edge Function `stripe-webhook`) and after each
 * in-app action. Never holds card numbers: only the card's brand, last 4
 * digits and expiry, for display.
 */
export const familyBilling = pgTable("family_billing", {
  familyId: uuid("family_id")
    .primaryKey()
    .references(() => families.id, { onDelete: "cascade" }),
  /** none | trialing | active | past_due | unpaid | incomplete | canceled | expired | paused | complimentary */
  status: text("status").notNull().default("none"),
  /** Stripe's own status, as last seen. */
  stripeStatus: text("stripe_status"),
  plan: text("plan"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  priceCents: integer("price_cents"),
  currency: text("currency"),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  /** Card shown on the billing page (no card numbers are ever stored). */
  pmBrand: text("pm_brand"),
  pmLast4: text("pm_last4"),
  pmExpMonth: integer("pm_exp_month"),
  pmExpYear: integer("pm_exp_year"),
  /** A switch waiting for the end of the period (yearly → monthly), via a Stripe subscription schedule. */
  pendingPlan: text("pending_plan"),
  pendingPlanAt: timestamp("pending_plan_at", { withTimezone: true }),
  stripeScheduleId: text("stripe_schedule_id"),
  latestInvoiceId: text("latest_invoice_id"),
  /** Why the last payment failed (cleared once paid). */
  lastPaymentError: text("last_payment_error"),
  /** Why a family is free (set by an admin). */
  compNote: text("comp_note"),
  ...timestamps,
});

/** Feedback sent from inside the app; read by platform admins. */
export const feedback = pgTable(
  "feedback",
  {
    id: id(),
    familyId: uuid("family_id").references(() => families.id, { onDelete: "set null" }),
    memberId: uuid("member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    /** idea | problem | praise | question | other */
    kind: text("kind").notNull().default("idea"),
    rating: integer("rating"),
    message: text("message").notNull(),
    page: text("page"),
    contactEmail: text("contact_email"),
    /** new | read | done */
    status: text("status").notNull().default("new"),
    adminNote: text("admin_note"),
    meta: jsonb("meta").$type<Record<string, string>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [index("feedback_status_idx").on(t.status, t.createdAt)],
);

/**
 * Customer reviews written in the app. Platform admins approve them before
 * they appear on the public Reviews page.
 */
export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    familyId: uuid("family_id").references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    rating: integer("rating").notNull(),
    title: text("title"),
    body: text("body").notNull(),
    /** How the reviewer is shown publicly, e.g. "Sarah, mom of three". */
    displayName: text("display_name").notNull(),
    /** pending | approved | hidden */
    status: text("status").notNull().default("pending"),
    featured: boolean("featured").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("reviews_status_idx").on(t.status)],
);

/** Fixed-window counters for rate limiting (sign-in attempts, sign-ups, contact form…). */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
  count: integer("count").notNull().default(0),
});

/** Billing history: one row per Stripe invoice (receipts link to Stripe's hosted PDF). */
export const billingInvoices = pgTable(
  "billing_invoices",
  {
    /** Stripe invoice id (in_…). */
    id: text("id").primaryKey(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    number: text("number"),
    /** open | paid | void | uncollectible */
    status: text("status"),
    amountDue: integer("amount_due").notNull().default(0),
    amountPaid: integer("amount_paid").notNull().default(0),
    currency: text("currency").notNull().default("usd"),
    description: text("description"),
    billingReason: text("billing_reason"),
    periodStart: timestamp("period_start", { withTimezone: true }),
    periodEnd: timestamp("period_end", { withTimezone: true }),
    hostedInvoiceUrl: text("hosted_invoice_url"),
    invoicePdf: text("invoice_pdf"),
    invoiceCreatedAt: timestamp("invoice_created_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("billing_invoices_family_idx").on(t.familyId, t.invoiceCreatedAt)],
);

/** Stripe webhook events already processed (each is handled once). */
export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
