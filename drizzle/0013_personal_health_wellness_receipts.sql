CREATE TABLE "grocery_receipt_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_id" uuid NOT NULL,
	"name" text NOT NULL,
	"quantity" numeric,
	"unit" text,
	"price_cents" integer,
	"category" text,
	"location" text,
	"expires_on" date,
	"added_to_pantry" boolean DEFAULT false NOT NULL,
	"inventory_item_id" uuid,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grocery_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"owner_member_id" uuid,
	"created_by_member_id" uuid,
	"store" text,
	"date" date,
	"total_cents" integer,
	"image_file_id" uuid,
	"notes" text,
	"transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "period_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"date" date NOT NULL,
	"flow" text,
	"symptoms" text[] DEFAULT '{}' NOT NULL,
	"feelings" text[] DEFAULT '{}' NOT NULL,
	"mood_intensity" smallint,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_health_profiles" (
	"member_id" uuid PRIMARY KEY NOT NULL,
	"family_id" uuid NOT NULL,
	"period_enabled" boolean DEFAULT false NOT NULL,
	"typical_cycle_length" smallint DEFAULT 28 NOT NULL,
	"typical_period_length" smallint DEFAULT 5 NOT NULL,
	"custom_symptoms" text[] DEFAULT '{}' NOT NULL,
	"custom_feelings" text[] DEFAULT '{}' NOT NULL,
	"custom_self_care" text[] DEFAULT '{}' NOT NULL,
	"reminders" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "privacy_settings" (
	"member_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"category" text NOT NULL,
	"audience" text DEFAULT 'private' NOT NULL,
	"member_ids" uuid[] DEFAULT '{}' NOT NULL,
	"options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "privacy_settings_member_id_category_pk" PRIMARY KEY("member_id","category")
);
--> statement-breakpoint
CREATE TABLE "quote_favorites" (
	"member_id" uuid NOT NULL,
	"quote_id" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_favorites_member_id_quote_id_pk" PRIMARY KEY("member_id","quote_id")
);
--> statement-breakpoint
CREATE TABLE "wellness_check_ins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"date" date NOT NULL,
	"mood" text,
	"feelings" text[] DEFAULT '{}' NOT NULL,
	"intensity" text,
	"self_care" text[] DEFAULT '{}' NOT NULL,
	"note" text,
	"shared" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wellness_goal_marks" (
	"goal_id" uuid NOT NULL,
	"date" date NOT NULL,
	CONSTRAINT "wellness_goal_marks_goal_id_date_pk" PRIMARY KEY("goal_id","date")
);
--> statement-breakpoint
CREATE TABLE "wellness_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"title" text NOT NULL,
	"kind" text DEFAULT 'custom' NOT NULL,
	"self_care_key" text,
	"times_per_week" smallint DEFAULT 3 NOT NULL,
	"shared" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "family_members" ADD COLUMN "parent_access" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "food_journal_entries" ADD COLUMN "meal" text;--> statement-breakpoint
ALTER TABLE "food_journal_entries" ADD COLUMN "time" text;--> statement-breakpoint
ALTER TABLE "food_journal_entries" ADD COLUMN "portion" text;--> statement-breakpoint
ALTER TABLE "food_journal_entries" ADD COLUMN "hunger" smallint;--> statement-breakpoint
ALTER TABLE "food_journal_entries" ADD COLUMN "fullness" smallint;--> statement-breakpoint
ALTER TABLE "food_journal_entries" ADD COLUMN "feelings" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "details" jsonb;--> statement-breakpoint
ALTER TABLE "grocery_receipt_items" ADD CONSTRAINT "grocery_receipt_items_receipt_id_grocery_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."grocery_receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grocery_receipt_items" ADD CONSTRAINT "grocery_receipt_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grocery_receipts" ADD CONSTRAINT "grocery_receipts_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grocery_receipts" ADD CONSTRAINT "grocery_receipts_owner_member_id_family_members_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grocery_receipts" ADD CONSTRAINT "grocery_receipts_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grocery_receipts" ADD CONSTRAINT "grocery_receipts_image_file_id_files_id_fk" FOREIGN KEY ("image_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_days" ADD CONSTRAINT "period_days_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_days" ADD CONSTRAINT "period_days_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_health_profiles" ADD CONSTRAINT "personal_health_profiles_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_health_profiles" ADD CONSTRAINT "personal_health_profiles_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_settings" ADD CONSTRAINT "privacy_settings_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_settings" ADD CONSTRAINT "privacy_settings_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_favorites" ADD CONSTRAINT "quote_favorites_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wellness_check_ins" ADD CONSTRAINT "wellness_check_ins_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wellness_check_ins" ADD CONSTRAINT "wellness_check_ins_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wellness_goal_marks" ADD CONSTRAINT "wellness_goal_marks_goal_id_wellness_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."wellness_goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wellness_goals" ADD CONSTRAINT "wellness_goals_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wellness_goals" ADD CONSTRAINT "wellness_goals_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "grocery_receipt_items_receipt_idx" ON "grocery_receipt_items" USING btree ("receipt_id");--> statement-breakpoint
CREATE INDEX "grocery_receipts_family_idx" ON "grocery_receipts" USING btree ("family_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "period_days_member_date_idx" ON "period_days" USING btree ("member_id","date");--> statement-breakpoint
CREATE INDEX "privacy_settings_family_idx" ON "privacy_settings" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wellness_check_ins_member_date_idx" ON "wellness_check_ins" USING btree ("member_id","date");--> statement-breakpoint
CREATE INDEX "wellness_goals_member_idx" ON "wellness_goals" USING btree ("member_id");--> statement-breakpoint
-- Keep existing choices: "Share my fitness" covered fitness and the food journal.
INSERT INTO "privacy_settings" ("member_id", "family_id", "category", "audience")
SELECT m."id", m."family_id", c.category, 'parents'
FROM "family_members" m CROSS JOIN (VALUES ('fitness'), ('food')) AS c(category)
WHERE m."share_fitness"
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "food_journal_entries" SET "meal" = "slot"::text WHERE "meal" IS NULL;
