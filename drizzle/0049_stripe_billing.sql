CREATE TABLE IF NOT EXISTS "billing_invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"family_id" uuid NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"number" text,
	"status" text,
	"amount_due" integer DEFAULT 0 NOT NULL,
	"amount_paid" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"description" text,
	"billing_reason" text,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"hosted_invoice_url" text,
	"invoice_pdf" text,
	"invoice_created_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "family_billing" ADD COLUMN IF NOT EXISTS "stripe_status" text;--> statement-breakpoint
ALTER TABLE "family_billing" ADD COLUMN IF NOT EXISTS "stripe_price_id" text;--> statement-breakpoint
ALTER TABLE "family_billing" ADD COLUMN IF NOT EXISTS "price_cents" integer;--> statement-breakpoint
ALTER TABLE "family_billing" ADD COLUMN IF NOT EXISTS "currency" text;--> statement-breakpoint
ALTER TABLE "family_billing" ADD COLUMN IF NOT EXISTS "current_period_start" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "family_billing" ADD COLUMN IF NOT EXISTS "canceled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "family_billing" ADD COLUMN IF NOT EXISTS "ended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "family_billing" ADD COLUMN IF NOT EXISTS "pm_brand" text;--> statement-breakpoint
ALTER TABLE "family_billing" ADD COLUMN IF NOT EXISTS "pm_last4" text;--> statement-breakpoint
ALTER TABLE "family_billing" ADD COLUMN IF NOT EXISTS "pm_exp_month" integer;--> statement-breakpoint
ALTER TABLE "family_billing" ADD COLUMN IF NOT EXISTS "pm_exp_year" integer;--> statement-breakpoint
ALTER TABLE "family_billing" ADD COLUMN IF NOT EXISTS "pending_plan" text;--> statement-breakpoint
ALTER TABLE "family_billing" ADD COLUMN IF NOT EXISTS "pending_plan_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "family_billing" ADD COLUMN IF NOT EXISTS "stripe_schedule_id" text;--> statement-breakpoint
ALTER TABLE "family_billing" ADD COLUMN IF NOT EXISTS "latest_invoice_id" text;--> statement-breakpoint
ALTER TABLE "family_billing" ADD COLUMN IF NOT EXISTS "last_payment_error" text;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "stripe_product_id" text;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "stripe_monthly_price_id" text;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "stripe_yearly_price_id" text;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "stripe_prices_key" text;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_invoices_family_idx" ON "billing_invoices" USING btree ("family_id","invoice_created_at");--> statement-breakpoint
-- Supabase hardening: no direct access to app tables through Supabase's public API keys.
-- The app (and the stripe-webhook Edge Function) connect as the tables' owner, which RLS doesn't restrict.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tableowner = current_user LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated';
  END IF;
END $$;
