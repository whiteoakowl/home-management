CREATE TABLE IF NOT EXISTS "family_billing" (
	"family_id" uuid PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'none' NOT NULL,
	"plan" text,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"trial_ends_at" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"comp_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid,
	"member_id" uuid,
	"kind" text DEFAULT 'idea' NOT NULL,
	"rating" integer,
	"message" text NOT NULL,
	"page" text,
	"contact_email" text,
	"status" text DEFAULT 'new' NOT NULL,
	"admin_note" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"brand_name" text DEFAULT 'Family Bubble' NOT NULL,
	"monthly_price_cents" integer DEFAULT 499 NOT NULL,
	"yearly_price_cents" integer DEFAULT 4900 NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"trial_days" integer DEFAULT 7 NOT NULL,
	"billing_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "family_billing" ADD CONSTRAINT "family_billing_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "feedback" ADD CONSTRAINT "feedback_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "feedback" ADD CONSTRAINT "feedback_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_status_idx" ON "feedback" USING btree ("status","created_at");--> statement-breakpoint
INSERT INTO "platform_settings" ("id") VALUES ('default') ON CONFLICT DO NOTHING;
