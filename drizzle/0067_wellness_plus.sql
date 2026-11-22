CREATE TABLE IF NOT EXISTS "wellness_sleep" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"date" date NOT NULL,
	"bed_time" time,
	"wake_time" time,
	"quality" smallint,
	"awakenings" smallint,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "personal_health_profiles" ADD COLUMN IF NOT EXISTS "bedtime_reminder" time;--> statement-breakpoint
ALTER TABLE "personal_health_profiles" ADD COLUMN IF NOT EXISTS "bedtime_reminder_on" date;--> statement-breakpoint
ALTER TABLE "personal_health_profiles" ADD COLUMN IF NOT EXISTS "sleep_goal_hours" numeric DEFAULT '8' NOT NULL;--> statement-breakpoint
ALTER TABLE "wellness_check_ins" ADD COLUMN IF NOT EXISTS "energy" smallint;--> statement-breakpoint
ALTER TABLE "wellness_check_ins" ADD COLUMN IF NOT EXISTS "stress" smallint;--> statement-breakpoint
ALTER TABLE "wellness_check_ins" ADD COLUMN IF NOT EXISTS "sleep_quality" smallint;--> statement-breakpoint
ALTER TABLE "wellness_check_ins" ADD COLUMN IF NOT EXISTS "answers" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "wellness_goals" ADD COLUMN IF NOT EXISTS "cadence" text DEFAULT 'weekly' NOT NULL;--> statement-breakpoint
ALTER TABLE "wellness_goals" ADD COLUMN IF NOT EXISTS "reminder_time" time;--> statement-breakpoint
ALTER TABLE "wellness_goals" ADD COLUMN IF NOT EXISTS "last_reminder_on" date;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wellness_sleep" ADD CONSTRAINT "wellness_sleep_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wellness_sleep" ADD CONSTRAINT "wellness_sleep_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wellness_sleep_member_date_idx" ON "wellness_sleep" USING btree ("member_id","date");--> statement-breakpoint
ALTER TABLE "wellness_sleep" ENABLE ROW LEVEL SECURITY;
