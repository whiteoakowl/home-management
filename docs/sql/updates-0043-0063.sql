-- Database updates 0043–0063 (Family Chat, plans & billing, sports, binder, calendar sync, faith, reading log…).
-- Safe to run more than once: anything that already exists is skipped.
-- Paste everything into Supabase → SQL Editor → Run (choose "Run and enable RLS" if asked).

-- 0043_chore_teams.sql
ALTER TABLE "chore_occurrences" ADD COLUMN IF NOT EXISTS "assignee_ids" uuid[] DEFAULT '{}' NOT NULL;
ALTER TABLE "chore_occurrences" ADD COLUMN IF NOT EXISTS "awarded_member_ids" uuid[] DEFAULT '{}' NOT NULL;
ALTER TABLE "chores" ADD COLUMN IF NOT EXISTS "assignee_ids" uuid[] DEFAULT '{}' NOT NULL;
-- Existing single assignments become one-person teams (nothing is reassigned).
UPDATE "chores" SET "assignee_ids" = ARRAY["default_assignee_id"] WHERE "default_assignee_id" IS NOT NULL AND cardinality("assignee_ids") = 0;
UPDATE "chore_occurrences" SET "assignee_ids" = ARRAY["assignee_id"] WHERE "assignee_id" IS NOT NULL AND cardinality("assignee_ids") = 0;
-- 0044_platform_billing.sql
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
);
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
);
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
);
DO $$ BEGIN ALTER TABLE "family_billing" ADD CONSTRAINT "family_billing_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "feedback" ADD CONSTRAINT "feedback_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "feedback" ADD CONSTRAINT "feedback_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "feedback_status_idx" ON "feedback" USING btree ("status","created_at");
INSERT INTO "platform_settings" ("id") VALUES ('default') ON CONFLICT DO NOTHING;
-- 0045_sports.sql
ALTER TYPE "public"."app_module" ADD VALUE IF NOT EXISTS 'sports' BEFORE 'work';
CREATE TABLE IF NOT EXISTS "sport_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"kind" text DEFAULT 'game' NOT NULL,
	"opponent" text,
	"date" date NOT NULL,
	"arrive_time" time,
	"start_time" time,
	"location" text,
	"home_away" text,
	"our_score" integer,
	"their_score" integer,
	"outcome" text,
	"details" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "sport_practices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time,
	"location" text,
	"starts_on" date,
	"ends_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "sport_stat_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "sport_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"sport" text NOT NULL,
	"sport_name" text,
	"name" text NOT NULL,
	"season" text,
	"league" text,
	"position" text,
	"jersey_number" text,
	"coach" text,
	"coach_contact" text,
	"custom_stats" text[] DEFAULT '{}' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "families" ALTER COLUMN "enabled_modules" SET DEFAULT '{"calendar","house","cleaning","projects","info","chores","lists","kitchen","meals","recipes","shopping","garden","farm","journal","goals","fitness","budget","reports","medical","pets","witchcraft","maintenance","library","pool","dance","sports","work","vehicles","plans"}';
DO $$ BEGIN ALTER TABLE "sport_games" ADD CONSTRAINT "sport_games_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "sport_games" ADD CONSTRAINT "sport_games_team_id_sport_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."sport_teams"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "sport_practices" ADD CONSTRAINT "sport_practices_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "sport_practices" ADD CONSTRAINT "sport_practices_team_id_sport_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."sport_teams"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "sport_stat_lines" ADD CONSTRAINT "sport_stat_lines_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "sport_stat_lines" ADD CONSTRAINT "sport_stat_lines_game_id_sport_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."sport_games"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "sport_stat_lines" ADD CONSTRAINT "sport_stat_lines_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "sport_teams" ADD CONSTRAINT "sport_teams_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "sport_teams" ADD CONSTRAINT "sport_teams_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "sport_games_family_idx" ON "sport_games" USING btree ("family_id","date");
CREATE INDEX IF NOT EXISTS "sport_practices_family_idx" ON "sport_practices" USING btree ("family_id");
CREATE INDEX IF NOT EXISTS "sport_stats_game_idx" ON "sport_stat_lines" USING btree ("game_id");
CREATE INDEX IF NOT EXISTS "sport_teams_member_idx" ON "sport_teams" USING btree ("member_id");
-- Existing families get Sports switched on (the account owner can turn it off in Settings → Sections).
UPDATE "families" SET "enabled_modules" = array_append("enabled_modules", 'sports') WHERE NOT ('sports' = ANY("enabled_modules"));
-- 0046_family_hub.sql
ALTER TYPE "public"."app_module" ADD VALUE IF NOT EXISTS 'messages';
ALTER TYPE "public"."app_module" ADD VALUE IF NOT EXISTS 'contacts';
ALTER TYPE "public"."app_module" ADD VALUE IF NOT EXISTS 'photos';
CREATE TABLE IF NOT EXISTS "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'friends' NOT NULL,
	"relationship" text,
	"phone" text,
	"alt_phone" text,
	"email" text,
	"address" text,
	"birthday" date,
	"notes" text,
	"favorite" boolean DEFAULT false NOT NULL,
	"private" boolean DEFAULT false NOT NULL,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "family_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid,
	"body" text,
	"file_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "message_reads" (
	"member_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_reads_member_id_family_id_pk" PRIMARY KEY("member_id","family_id")
);
CREATE TABLE IF NOT EXISTS "photo_albums" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"event_date" date,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "families" ALTER COLUMN "enabled_modules" SET DEFAULT '{"calendar","house","cleaning","projects","info","chores","lists","kitchen","meals","recipes","shopping","garden","farm","journal","goals","fitness","budget","reports","medical","pets","witchcraft","maintenance","library","pool","dance","sports","work","vehicles","plans","messages","contacts","photos"}';
DO $$ BEGIN ALTER TABLE "contacts" ADD CONSTRAINT "contacts_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "contacts" ADD CONSTRAINT "contacts_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "family_messages" ADD CONSTRAINT "family_messages_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "family_messages" ADD CONSTRAINT "family_messages_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "family_messages" ADD CONSTRAINT "family_messages_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "photo_albums" ADD CONSTRAINT "photo_albums_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "photo_albums" ADD CONSTRAINT "photo_albums_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "contacts_family_idx" ON "contacts" USING btree ("family_id");
CREATE INDEX IF NOT EXISTS "family_messages_family_idx" ON "family_messages" USING btree ("family_id","created_at");
CREATE INDEX IF NOT EXISTS "photo_albums_family_idx" ON "photo_albums" USING btree ("family_id");
-- Existing families get the Family Hub sections switched on (the owner can turn them off in Settings → Sections).
UPDATE "families" SET "enabled_modules" = array_append("enabled_modules", 'messages') WHERE NOT ('messages' = ANY("enabled_modules"));
UPDATE "families" SET "enabled_modules" = array_append("enabled_modules", 'contacts') WHERE NOT ('contacts' = ANY("enabled_modules"));
UPDATE "families" SET "enabled_modules" = array_append("enabled_modules", 'photos') WHERE NOT ('photos' = ANY("enabled_modules"));
-- 0047_wishlists_reviews.sql
CREATE TABLE IF NOT EXISTS "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid,
	"member_id" uuid,
	"rating" integer NOT NULL,
	"title" text,
	"body" text NOT NULL,
	"display_name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "wishlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"title" text NOT NULL,
	"link" text,
	"price_cents" integer,
	"priority" smallint DEFAULT 2 NOT NULL,
	"details" text,
	"occasion" text DEFAULT 'Holidays' NOT NULL,
	"claimed_by_member_id" uuid,
	"purchased" boolean DEFAULT false NOT NULL,
	"received" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "reviews" ADD CONSTRAINT "reviews_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "reviews" ADD CONSTRAINT "reviews_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_claimed_by_member_id_family_members_id_fk" FOREIGN KEY ("claimed_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "reviews_status_idx" ON "reviews" USING btree ("status");
CREATE INDEX IF NOT EXISTS "wishlist_items_member_idx" ON "wishlist_items" USING btree ("family_id","member_id");
-- 0048_rate_limits.sql
CREATE TABLE IF NOT EXISTS "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
-- 0049_stripe_billing.sql
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
);
CREATE TABLE IF NOT EXISTS "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "family_billing" ADD COLUMN IF NOT EXISTS "stripe_status" text;
ALTER TABLE "family_billing" ADD COLUMN IF NOT EXISTS "stripe_price_id" text;
ALTER TABLE "family_billing" ADD COLUMN IF NOT EXISTS "price_cents" integer;
ALTER TABLE "family_billing" ADD COLUMN IF NOT EXISTS "currency" text;
ALTER TABLE "family_billing" ADD COLUMN IF NOT EXISTS "current_period_start" timestamp with time zone;
ALTER TABLE "family_billing" ADD COLUMN IF NOT EXISTS "canceled_at" timestamp with time zone;
ALTER TABLE "family_billing" ADD COLUMN IF NOT EXISTS "ended_at" timestamp with time zone;
ALTER TABLE "family_billing" ADD COLUMN IF NOT EXISTS "pm_brand" text;
ALTER TABLE "family_billing" ADD COLUMN IF NOT EXISTS "pm_last4" text;
ALTER TABLE "family_billing" ADD COLUMN IF NOT EXISTS "pm_exp_month" integer;
ALTER TABLE "family_billing" ADD COLUMN IF NOT EXISTS "pm_exp_year" integer;
ALTER TABLE "family_billing" ADD COLUMN IF NOT EXISTS "pending_plan" text;
ALTER TABLE "family_billing" ADD COLUMN IF NOT EXISTS "pending_plan_at" timestamp with time zone;
ALTER TABLE "family_billing" ADD COLUMN IF NOT EXISTS "stripe_schedule_id" text;
ALTER TABLE "family_billing" ADD COLUMN IF NOT EXISTS "latest_invoice_id" text;
ALTER TABLE "family_billing" ADD COLUMN IF NOT EXISTS "last_payment_error" text;
ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "stripe_product_id" text;
ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "stripe_monthly_price_id" text;
ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "stripe_yearly_price_id" text;
ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "stripe_prices_key" text;
DO $$ BEGIN ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "billing_invoices_family_idx" ON "billing_invoices" USING btree ("family_id","invoice_created_at");
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
-- 0050_auth_tokens.sql
CREATE TABLE IF NOT EXISTS "auth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"token_hash" text NOT NULL,
	"email" text,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_tokens_token_hash_unique" UNIQUE("token_hash")
);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp with time zone;
DO $$ BEGIN ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "auth_tokens_user_idx" ON "auth_tokens" USING btree ("user_id","kind");
-- Accounts that existed before email verification are treated as verified.
UPDATE "users" SET "email_verified_at" = "created_at" WHERE "email_verified_at" IS NULL;
ALTER TABLE "auth_tokens" ENABLE ROW LEVEL SECURITY;
-- 0051_chat_channels.sql
CREATE TABLE IF NOT EXISTS "message_reactions" (
	"message_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_reactions_message_id_member_id_emoji_pk" PRIMARY KEY("message_id","member_id","emoji")
);
CREATE TABLE IF NOT EXISTS "poll_votes" (
	"message_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"option_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "poll_votes_message_id_member_id_pk" PRIMARY KEY("message_id","member_id")
);
ALTER TABLE "family_messages" ADD COLUMN IF NOT EXISTS "channel" text DEFAULT 'all' NOT NULL;
ALTER TABLE "family_messages" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'text' NOT NULL;
ALTER TABLE "family_messages" ADD COLUMN IF NOT EXISTS "event_id" uuid;
ALTER TABLE "family_messages" ADD COLUMN IF NOT EXISTS "poll" jsonb;
ALTER TABLE "family_messages" ADD COLUMN IF NOT EXISTS "pinned_at" timestamp with time zone;
ALTER TABLE "family_messages" ADD COLUMN IF NOT EXISTS "pinned_by_member_id" uuid;
DO $$ BEGIN ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_message_id_family_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."family_messages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_message_id_family_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."family_messages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "family_messages" ADD CONSTRAINT "family_messages_pinned_by_member_id_family_members_id_fk" FOREIGN KEY ("pinned_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "family_messages_channel_idx" ON "family_messages" USING btree ("family_id","channel","created_at");
ALTER TABLE "message_reactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "poll_votes" ENABLE ROW LEVEL SECURITY;
-- 0052_kid_names.sql
ALTER TABLE "family_members" ADD COLUMN IF NOT EXISTS "kid_name" text;
-- 0053_faith_paths.sql
CREATE TABLE IF NOT EXISTS "faith_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"faith" text NOT NULL,
	"date" date NOT NULL,
	"title" text,
	"reference" text,
	"body" text NOT NULL,
	"shared" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "faith_holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"faith" text NOT NULL,
	"holiday_key" text,
	"name" text NOT NULL,
	"emoji" text,
	"date" date NOT NULL,
	"yearly" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "faith_practice_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"practice_id" uuid NOT NULL,
	"date" date NOT NULL,
	"amount" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "faith_practices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"faith" text NOT NULL,
	"name" text NOT NULL,
	"emoji" text,
	"unit" text,
	"builtin_key" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "faith_prayers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"faith" text NOT NULL,
	"title" text NOT NULL,
	"for_whom" text,
	"details" text,
	"shared" boolean DEFAULT false NOT NULL,
	"answered_on" date,
	"answer_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "faith_reading_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"text_key" text NOT NULL,
	"section" integer NOT NULL,
	"read_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "faith_texts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"faith" text NOT NULL,
	"title" text NOT NULL,
	"section_label" text DEFAULT 'Chapter' NOT NULL,
	"sections" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "family_members" ADD COLUMN IF NOT EXISTS "faith_paths" text[];
DO $$ BEGIN ALTER TABLE "faith_entries" ADD CONSTRAINT "faith_entries_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "faith_entries" ADD CONSTRAINT "faith_entries_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "faith_holidays" ADD CONSTRAINT "faith_holidays_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "faith_holidays" ADD CONSTRAINT "faith_holidays_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "faith_practice_logs" ADD CONSTRAINT "faith_practice_logs_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "faith_practice_logs" ADD CONSTRAINT "faith_practice_logs_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "faith_practice_logs" ADD CONSTRAINT "faith_practice_logs_practice_id_faith_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."faith_practices"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "faith_practices" ADD CONSTRAINT "faith_practices_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "faith_practices" ADD CONSTRAINT "faith_practices_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "faith_prayers" ADD CONSTRAINT "faith_prayers_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "faith_prayers" ADD CONSTRAINT "faith_prayers_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "faith_reading_logs" ADD CONSTRAINT "faith_reading_logs_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "faith_reading_logs" ADD CONSTRAINT "faith_reading_logs_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "faith_texts" ADD CONSTRAINT "faith_texts_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "faith_texts" ADD CONSTRAINT "faith_texts_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "faith_entries_member_idx" ON "faith_entries" USING btree ("member_id","faith","date");
CREATE INDEX IF NOT EXISTS "faith_holidays_family_idx" ON "faith_holidays" USING btree ("family_id","faith");
CREATE UNIQUE INDEX IF NOT EXISTS "faith_practice_logs_uq" ON "faith_practice_logs" USING btree ("practice_id","date");
CREATE INDEX IF NOT EXISTS "faith_practice_logs_member_idx" ON "faith_practice_logs" USING btree ("member_id","date");
CREATE INDEX IF NOT EXISTS "faith_practices_member_idx" ON "faith_practices" USING btree ("member_id","faith");
CREATE INDEX IF NOT EXISTS "faith_prayers_family_idx" ON "faith_prayers" USING btree ("family_id","faith");
CREATE UNIQUE INDEX IF NOT EXISTS "faith_reading_logs_uq" ON "faith_reading_logs" USING btree ("member_id","text_key","section");
CREATE INDEX IF NOT EXISTS "faith_reading_logs_date_idx" ON "faith_reading_logs" USING btree ("member_id","read_on");
CREATE INDEX IF NOT EXISTS "faith_texts_member_idx" ON "faith_texts" USING btree ("member_id");
-- 0054_family_faiths.sql
ALTER TABLE "families" ADD COLUMN IF NOT EXISTS "faith_paths" text[];
-- 0055_push_subscriptions.sql
-- Rows saved before push existed: push follows the in-app choice.
DO $$ BEGIN IF to_regclass('public.push_subscriptions') IS NULL THEN UPDATE "notification_preferences" SET "push" = "in_app"; END IF; END $$;
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"device" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "notification_preferences" ALTER COLUMN "push" SET DEFAULT true;
DO $$ BEGIN ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_uq" ON "push_subscriptions" USING btree ("endpoint");
CREATE INDEX IF NOT EXISTS "push_subscriptions_member_idx" ON "push_subscriptions" USING btree ("member_id");
-- 0056_calendar_sync.sql
CREATE TABLE IF NOT EXISTS "calendar_feeds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"token" text NOT NULL,
	"layers" text[] NOT NULL,
	"only_mine" boolean DEFAULT false NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "calendar_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"color" text DEFAULT 'sky' NOT NULL,
	"shared" boolean DEFAULT true NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fetched_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "calendar_feeds" ADD CONSTRAINT "calendar_feeds_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "calendar_feeds" ADD CONSTRAINT "calendar_feeds_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "calendar_imports" ADD CONSTRAINT "calendar_imports_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "calendar_imports" ADD CONSTRAINT "calendar_imports_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "calendar_feeds_token_uq" ON "calendar_feeds" USING btree ("token");
CREATE UNIQUE INDEX IF NOT EXISTS "calendar_feeds_member_uq" ON "calendar_feeds" USING btree ("member_id");
CREATE INDEX IF NOT EXISTS "calendar_imports_family_idx" ON "calendar_imports" USING btree ("family_id");
-- 0057_storage_indexes.sql
CREATE INDEX IF NOT EXISTS "activity_created_idx" ON "activity_log" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "auth_tokens_expires_idx" ON "auth_tokens" USING btree ("expires_at");
CREATE INDEX IF NOT EXISTS "files_created_idx" ON "files" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "notifications_created_idx" ON "notifications" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "sessions_expires_idx" ON "sessions" USING btree ("expires_at");
-- 0058_family_binder.sql
ALTER TABLE "household_info" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'note' NOT NULL;
ALTER TABLE "household_info" ADD COLUMN IF NOT EXISTS "fields" jsonb DEFAULT '{}'::jsonb NOT NULL;
-- 0059_event_templates.sql
CREATE TABLE IF NOT EXISTS "event_reminders_sent" (
	"event_id" uuid NOT NULL,
	"occurs_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_reminders_sent_event_id_occurs_at_pk" PRIMARY KEY("event_id","occurs_at")
);
CREATE TABLE IF NOT EXISTS "event_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"name" text NOT NULL,
	"title" text NOT NULL,
	"location" text,
	"description" text,
	"category_id" uuid,
	"color" text,
	"start_time" text,
	"duration_min" integer DEFAULT 60 NOT NULL,
	"weekdays" integer[] DEFAULT '{}' NOT NULL,
	"member_ids" uuid[] DEFAULT '{}' NOT NULL,
	"reminder_minutes" integer,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN ALTER TABLE "event_reminders_sent" ADD CONSTRAINT "event_reminders_sent_event_id_calendar_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "event_templates" ADD CONSTRAINT "event_templates_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "event_templates" ADD CONSTRAINT "event_templates_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "event_templates" ADD CONSTRAINT "event_templates_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "event_reminders_sent_at_idx" ON "event_reminders_sent" USING btree ("sent_at");
CREATE INDEX IF NOT EXISTS "event_templates_family_idx" ON "event_templates" USING btree ("family_id");
CREATE INDEX IF NOT EXISTS "events_starts_idx" ON "calendar_events" USING btree ("starts_at");
-- 0060_memories_photos_trips.sql
CREATE TABLE IF NOT EXISTS "plan_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"title" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"date" date,
	"category" text DEFAULT 'other' NOT NULL,
	"paid_by_member_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "family_dates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"kind" text DEFAULT 'anniversary' NOT NULL,
	"title" text NOT NULL,
	"month" smallint NOT NULL,
	"day" smallint NOT NULL,
	"year" smallint,
	"member_ids" uuid[] DEFAULT '{}' NOT NULL,
	"remind_days" integer DEFAULT 7 NOT NULL,
	"notes" text,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "media_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "media_favorites" (
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_favorites_member_id_entity_type_entity_id_pk" PRIMARY KEY("member_id","entity_type","entity_id")
);
CREATE TABLE IF NOT EXISTS "media_reactions" (
	"family_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_reactions_entity_type_entity_id_member_id_emoji_pk" PRIMARY KEY("entity_type","entity_id","member_id","emoji")
);
CREATE TABLE IF NOT EXISTS "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"date" date NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"kind" text DEFAULT 'memory' NOT NULL,
	"member_ids" uuid[] DEFAULT '{}' NOT NULL,
	"place" text,
	"visibility" text DEFAULT 'family' NOT NULL,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "memory_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"memory_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"media_type" text DEFAULT 'photo' NOT NULL,
	"caption" text,
	"sort" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "entity_photos" ADD COLUMN IF NOT EXISTS "media_type" text DEFAULT 'photo' NOT NULL;
ALTER TABLE "entity_photos" ADD COLUMN IF NOT EXISTS "taken_at" timestamp with time zone;
ALTER TABLE "entity_photos" ADD COLUMN IF NOT EXISTS "milestone" text;
ALTER TABLE "photo_albums" ADD COLUMN IF NOT EXISTS "owner_member_id" uuid;
ALTER TABLE "photo_albums" ADD COLUMN IF NOT EXISTS "private" boolean DEFAULT false NOT NULL;
ALTER TABLE "photo_albums" ADD COLUMN IF NOT EXISTS "plan_id" uuid;
DO $$ BEGIN ALTER TABLE "plan_expenses" ADD CONSTRAINT "plan_expenses_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "plan_expenses" ADD CONSTRAINT "plan_expenses_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "plan_expenses" ADD CONSTRAINT "plan_expenses_paid_by_member_id_family_members_id_fk" FOREIGN KEY ("paid_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "family_dates" ADD CONSTRAINT "family_dates_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "family_dates" ADD CONSTRAINT "family_dates_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "media_comments" ADD CONSTRAINT "media_comments_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "media_comments" ADD CONSTRAINT "media_comments_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "media_favorites" ADD CONSTRAINT "media_favorites_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "media_favorites" ADD CONSTRAINT "media_favorites_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "media_reactions" ADD CONSTRAINT "media_reactions_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "media_reactions" ADD CONSTRAINT "media_reactions_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "memories" ADD CONSTRAINT "memories_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "memories" ADD CONSTRAINT "memories_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "memory_media" ADD CONSTRAINT "memory_media_memory_id_memories_id_fk" FOREIGN KEY ("memory_id") REFERENCES "public"."memories"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "memory_media" ADD CONSTRAINT "memory_media_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "memory_media" ADD CONSTRAINT "memory_media_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "plan_expenses_plan_idx" ON "plan_expenses" USING btree ("plan_id");
CREATE INDEX IF NOT EXISTS "family_dates_family_idx" ON "family_dates" USING btree ("family_id","month","day");
CREATE INDEX IF NOT EXISTS "media_comments_entity_idx" ON "media_comments" USING btree ("entity_type","entity_id");
CREATE INDEX IF NOT EXISTS "memories_family_date_idx" ON "memories" USING btree ("family_id","date");
CREATE INDEX IF NOT EXISTS "memory_media_memory_idx" ON "memory_media" USING btree ("memory_id");
DO $$ BEGIN ALTER TABLE "photo_albums" ADD CONSTRAINT "photo_albums_owner_member_id_family_members_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "entity_photos_family_taken_idx" ON "entity_photos" USING btree ("family_id","taken_at");
-- Existing photos: date them by when they were added.
UPDATE "entity_photos" SET "taken_at" = "created_at" WHERE "taken_at" IS NULL;
-- 0061_file_taken_at.sql
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "taken_at" timestamp with time zone;
-- 0062_reading_log.sql
CREATE TABLE IF NOT EXISTS "reading_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"status" text DEFAULT 'reading' NOT NULL,
	"started_on" date,
	"finished_on" date,
	"current_page" integer,
	"notes" text,
	"shared" boolean DEFAULT true NOT NULL,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "books" DROP CONSTRAINT IF EXISTS "books_reader_member_id_family_members_id_fk";
DO $$ BEGIN ALTER TABLE "reading_entries" ADD CONSTRAINT "reading_entries_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "reading_entries" ADD CONSTRAINT "reading_entries_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "reading_entries" ADD CONSTRAINT "reading_entries_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "reading_entries" ADD CONSTRAINT "reading_entries_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "reading_entries_book_member_uq" ON "reading_entries" USING btree ("book_id","member_id");
CREATE INDEX IF NOT EXISTS "reading_entries_member_idx" ON "reading_entries" USING btree ("member_id","status");
CREATE INDEX IF NOT EXISTS "reading_entries_family_idx" ON "reading_entries" USING btree ("family_id","status");
-- Keep everyone's reading progress: each book that had a reading status becomes a
-- reading-log entry for its reader (or the book's owner / whoever added it).
-- Shared with the family when the book was a family-visible Family Library book.
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'books' AND column_name = 'status') THEN
INSERT INTO "reading_entries" ("family_id", "book_id", "member_id", "status", "started_on", "finished_on", "current_page", "notes", "shared", "created_by_member_id", "created_at", "updated_at")
SELECT b."family_id", b."id", COALESCE(b."reader_member_id", b."owner_member_id", b."created_by_member_id"),
       b."status", b."started_on", b."finished_on", b."current_page", b."reading_notes",
       (b."owner_member_id" IS NULL AND b."visibility" = 'family'),
       b."created_by_member_id", b."updated_at", b."updated_at"
FROM "books" b
WHERE b."status" <> 'not_started'
  AND COALESCE(b."reader_member_id", b."owner_member_id", b."created_by_member_id") IS NOT NULL
ON CONFLICT DO NOTHING;
END IF; END $$;
ALTER TABLE "books" DROP COLUMN IF EXISTS "status";
ALTER TABLE "books" DROP COLUMN IF EXISTS "reader_member_id";
ALTER TABLE "books" DROP COLUMN IF EXISTS "started_on";
ALTER TABLE "books" DROP COLUMN IF EXISTS "finished_on";
ALTER TABLE "books" DROP COLUMN IF EXISTS "current_page";
ALTER TABLE "books" DROP COLUMN IF EXISTS "reading_notes";
-- 0063_premium_price.sql
ALTER TABLE "platform_settings" ALTER COLUMN "monthly_price_cents" SET DEFAULT 1299;
ALTER TABLE "platform_settings" ALTER COLUMN "yearly_price_cents" SET DEFAULT 12999;
-- New Premium price: $12.99/month, $129.99/year (still editable in Admin afterwards).
UPDATE "platform_settings" SET "monthly_price_cents" = 1299, "yearly_price_cents" = 12999, "updated_at" = now() WHERE "id" = 'default';
