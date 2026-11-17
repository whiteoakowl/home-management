ALTER TYPE "public"."entity_type" ADD VALUE IF NOT EXISTS 'plan';--> statement-breakpoint
ALTER TYPE "public"."app_module" ADD VALUE IF NOT EXISTS 'plans';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"kind" text DEFAULT 'itinerary' NOT NULL,
	"title" text NOT NULL,
	"date" date,
	"start_time" time,
	"end_date" date,
	"end_time" time,
	"location" text,
	"from_place" text,
	"to_place" text,
	"provider" text,
	"confirmation" text,
	"phone" text,
	"link" text,
	"cost_cents" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"title" text NOT NULL,
	"kind" text DEFAULT 'vacation' NOT NULL,
	"destination" text,
	"description" text,
	"start_date" date,
	"end_date" date,
	"member_ids" uuid[] DEFAULT '{}' NOT NULL,
	"image_file_id" uuid,
	"savings_goal_id" uuid,
	"budget_cents" integer,
	"visibility" "visibility" DEFAULT 'family' NOT NULL,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "families" ALTER COLUMN "enabled_modules" SET DEFAULT '{"calendar","house","cleaning","projects","info","chores","lists","kitchen","meals","recipes","shopping","garden","farm","journal","goals","fitness","budget","reports","medical","pets","witchcraft","maintenance","library","pool","dance","work","vehicles","plans"}';--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "plans" ADD CONSTRAINT "plans_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "plans" ADD CONSTRAINT "plans_image_file_id_files_id_fk" FOREIGN KEY ("image_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "plans" ADD CONSTRAINT "plans_savings_goal_id_goals_id_fk" FOREIGN KEY ("savings_goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "plans" ADD CONSTRAINT "plans_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plan_items_plan_idx" ON "plan_items" USING btree ("plan_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plans_family_idx" ON "plans" USING btree ("family_id","start_date");--> statement-breakpoint
-- Turn Plans on for existing families (parents can switch it off in Settings).
UPDATE "families" SET "enabled_modules" = array_append("enabled_modules", 'plans') WHERE NOT ('plans' = ANY("enabled_modules"));--> statement-breakpoint
-- Members who saved calendar categories before Plans existed see it too.
UPDATE "family_members" SET "calendar_layers" = array_append("calendar_layers", 'plans') WHERE "calendar_layers" IS NOT NULL AND NOT ('plans' = ANY("calendar_layers"));
