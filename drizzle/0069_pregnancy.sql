ALTER TYPE "public"."entity_type" ADD VALUE IF NOT EXISTS 'pregnancy';--> statement-breakpoint
ALTER TYPE "public"."app_module" ADD VALUE IF NOT EXISTS 'pregnancy' BEFORE 'messages';--> statement-breakpoint
ALTER TYPE "public"."event_source" ADD VALUE IF NOT EXISTS 'pregnancy';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pregnancies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"nickname" text,
	"baby_nickname" text,
	"baby_sex" text DEFAULT 'unknown' NOT NULL,
	"due_date" date,
	"lmp_date" date,
	"conception_date" date,
	"due_source" text DEFAULT 'due' NOT NULL,
	"ivf" jsonb,
	"pregnancy_number" smallint,
	"previous_pregnancies" text,
	"baby_count" smallint DEFAULT 1 NOT NULL,
	"provider" text,
	"provider_phone" text,
	"provider_email" text,
	"provider_address" text,
	"hospital" text,
	"birth_location" text,
	"notes" text,
	"status" text DEFAULT 'active' NOT NULL,
	"ended_on" date,
	"outcome" jsonb,
	"birth_plan" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reminders" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reminder_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"visibility" "visibility" DEFAULT 'parents' NOT NULL,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pregnancy_appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"pregnancy_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"kind" text DEFAULT 'prenatal' NOT NULL,
	"provider" text,
	"tests" text,
	"results" text,
	"follow_up_on" date,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pregnancy_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"pregnancy_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"category" text,
	"title" text,
	"body" text,
	"date" date NOT NULL,
	"week" smallint,
	"mood" text,
	"file_id" uuid,
	"appointment_id" uuid,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pregnancy_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"pregnancy_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"list" text,
	"title" text NOT NULL,
	"status" text,
	"done" boolean DEFAULT false NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL,
	"rating" smallint,
	"notes" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"appointment_id" uuid,
	"due_on" date,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pregnancy_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"pregnancy_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"amount" numeric,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pregnancy_week_content" (
	"week" smallint PRIMARY KEY NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "families" ALTER COLUMN "enabled_modules" SET DEFAULT '{"calendar","house","cleaning","projects","info","chores","lists","kitchen","meals","recipes","shopping","garden","farm","journal","goals","fitness","budget","reports","medical","pets","witchcraft","maintenance","library","pool","dance","sports","work","vehicles","plans","parties","baby","sounds","pregnancy","messages","contacts","photos"}';--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pregnancies" ADD CONSTRAINT "pregnancies_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pregnancies" ADD CONSTRAINT "pregnancies_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pregnancies" ADD CONSTRAINT "pregnancies_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pregnancy_appointments" ADD CONSTRAINT "pregnancy_appointments_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pregnancy_appointments" ADD CONSTRAINT "pregnancy_appointments_pregnancy_id_pregnancies_id_fk" FOREIGN KEY ("pregnancy_id") REFERENCES "public"."pregnancies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pregnancy_appointments" ADD CONSTRAINT "pregnancy_appointments_event_id_calendar_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pregnancy_appointments" ADD CONSTRAINT "pregnancy_appointments_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pregnancy_entries" ADD CONSTRAINT "pregnancy_entries_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pregnancy_entries" ADD CONSTRAINT "pregnancy_entries_pregnancy_id_pregnancies_id_fk" FOREIGN KEY ("pregnancy_id") REFERENCES "public"."pregnancies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pregnancy_entries" ADD CONSTRAINT "pregnancy_entries_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pregnancy_entries" ADD CONSTRAINT "pregnancy_entries_appointment_id_pregnancy_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."pregnancy_appointments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pregnancy_entries" ADD CONSTRAINT "pregnancy_entries_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pregnancy_items" ADD CONSTRAINT "pregnancy_items_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pregnancy_items" ADD CONSTRAINT "pregnancy_items_pregnancy_id_pregnancies_id_fk" FOREIGN KEY ("pregnancy_id") REFERENCES "public"."pregnancies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pregnancy_items" ADD CONSTRAINT "pregnancy_items_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pregnancy_logs" ADD CONSTRAINT "pregnancy_logs_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pregnancy_logs" ADD CONSTRAINT "pregnancy_logs_pregnancy_id_pregnancies_id_fk" FOREIGN KEY ("pregnancy_id") REFERENCES "public"."pregnancies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pregnancy_logs" ADD CONSTRAINT "pregnancy_logs_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pregnancies_family_idx" ON "pregnancies" USING btree ("family_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pregnancies_member_idx" ON "pregnancies" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pregnancy_appointments_idx" ON "pregnancy_appointments" USING btree ("pregnancy_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pregnancy_appointments_event_idx" ON "pregnancy_appointments" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pregnancy_entries_idx" ON "pregnancy_entries" USING btree ("pregnancy_id","kind","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pregnancy_items_idx" ON "pregnancy_items" USING btree ("pregnancy_id","kind","list");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pregnancy_logs_idx" ON "pregnancy_logs" USING btree ("pregnancy_id","kind","started_at");--> statement-breakpoint
ALTER TABLE "pregnancies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pregnancy_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pregnancy_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pregnancy_appointments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pregnancy_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pregnancy_week_content" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
UPDATE "families" SET "enabled_modules" = array_append("enabled_modules", 'pregnancy') WHERE NOT ('pregnancy' = ANY("enabled_modules"));
