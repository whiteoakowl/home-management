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
  ...timestamps,
});

/** A family's subscription. One row per family. */
export const familyBilling = pgTable("family_billing", {
  familyId: uuid("family_id")
    .primaryKey()
    .references(() => families.id, { onDelete: "cascade" }),
  /** none | trialing | active | past_due | canceled | complimentary */
  status: text("status").notNull().default("none"),
  plan: text("plan"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
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
