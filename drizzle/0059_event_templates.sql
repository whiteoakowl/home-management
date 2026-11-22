CREATE TABLE IF NOT EXISTS "event_reminders_sent" (
	"event_id" uuid NOT NULL,
	"occurs_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_reminders_sent_event_id_occurs_at_pk" PRIMARY KEY("event_id","occurs_at")
);--> statement-breakpoint
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
);--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "event_reminders_sent" ADD CONSTRAINT "event_reminders_sent_event_id_calendar_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "event_templates" ADD CONSTRAINT "event_templates_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "event_templates" ADD CONSTRAINT "event_templates_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "event_templates" ADD CONSTRAINT "event_templates_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_reminders_sent_at_idx" ON "event_reminders_sent" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_templates_family_idx" ON "event_templates" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_starts_idx" ON "calendar_events" USING btree ("starts_at");
