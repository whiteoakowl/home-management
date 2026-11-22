CREATE TABLE IF NOT EXISTS "baby_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"baby_id" uuid NOT NULL,
	"kind" text DEFAULT 'custom' NOT NULL,
	"title" text NOT NULL,
	"mode" text DEFAULT 'time' NOT NULL,
	"interval_minutes" integer,
	"time" time,
	"days" smallint[] DEFAULT '{}' NOT NULL,
	"at" timestamp with time zone,
	"member_ids" uuid[] DEFAULT '{}' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_sent_at" timestamp with time zone,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "baby_supplies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"baby_id" uuid,
	"kind" text DEFAULT 'other' NOT NULL,
	"name" text NOT NULL,
	"quantity" numeric DEFAULT '0' NOT NULL,
	"unit" text,
	"low_at" numeric,
	"location" text,
	"pumped_at" timestamp with time zone,
	"expires_on" date,
	"used_at" timestamp with time zone,
	"notes" text,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "babies" ADD COLUMN IF NOT EXISTS "allergies" text;--> statement-breakpoint
ALTER TABLE "babies" ADD COLUMN IF NOT EXISTS "conditions" text;--> statement-breakpoint
ALTER TABLE "babies" ADD COLUMN IF NOT EXISTS "doctor_name" text;--> statement-breakpoint
ALTER TABLE "babies" ADD COLUMN IF NOT EXISTS "doctor_phone" text;--> statement-breakpoint
ALTER TABLE "babies" ADD COLUMN IF NOT EXISTS "clinic" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "baby_reminders" ADD CONSTRAINT "baby_reminders_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "baby_reminders" ADD CONSTRAINT "baby_reminders_baby_id_babies_id_fk" FOREIGN KEY ("baby_id") REFERENCES "public"."babies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "baby_reminders" ADD CONSTRAINT "baby_reminders_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "baby_supplies" ADD CONSTRAINT "baby_supplies_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "baby_supplies" ADD CONSTRAINT "baby_supplies_baby_id_babies_id_fk" FOREIGN KEY ("baby_id") REFERENCES "public"."babies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "baby_supplies" ADD CONSTRAINT "baby_supplies_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "baby_reminders_baby_idx" ON "baby_reminders" USING btree ("baby_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "baby_reminders_enabled_idx" ON "baby_reminders" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "baby_supplies_family_idx" ON "baby_supplies" USING btree ("family_id","kind");--> statement-breakpoint
ALTER TABLE "baby_reminders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "baby_supplies" ENABLE ROW LEVEL SECURITY;
