ALTER TYPE "public"."entity_type" ADD VALUE IF NOT EXISTS 'party';--> statement-breakpoint
ALTER TYPE "public"."app_module" ADD VALUE IF NOT EXISTS 'parties' BEFORE 'messages';--> statement-breakpoint
ALTER TYPE "public"."app_module" ADD VALUE IF NOT EXISTS 'baby' BEFORE 'messages';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"title" text NOT NULL,
	"kind" text DEFAULT 'birthday' NOT NULL,
	"honoree_member_id" uuid,
	"honoree_name" text,
	"age" integer,
	"theme" text,
	"date" date,
	"start_time" time,
	"end_time" time,
	"venue" text,
	"address" text,
	"description" text,
	"rsvp_by" date,
	"budget_cents" integer,
	"image_file_id" uuid,
	"visibility" "visibility" DEFAULT 'family' NOT NULL,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "party_guests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_id" uuid NOT NULL,
	"name" text NOT NULL,
	"contact" text,
	"adults" integer DEFAULT 1 NOT NULL,
	"kids" integer DEFAULT 0 NOT NULL,
	"rsvp" text DEFAULT 'invited' NOT NULL,
	"gift" text,
	"thank_you_sent" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "party_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_id" uuid NOT NULL,
	"kind" text DEFAULT 'todo' NOT NULL,
	"title" text NOT NULL,
	"date" date,
	"time" time,
	"quantity" text,
	"cost_cents" integer,
	"done" boolean DEFAULT false NOT NULL,
	"assigned_member_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "babies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid,
	"name" text NOT NULL,
	"birth_date" date,
	"volume_unit" text DEFAULT 'oz' NOT NULL,
	"weight_unit" text DEFAULT 'lb' NOT NULL,
	"notes" text,
	"image_file_id" uuid,
	"archived_at" timestamp with time zone,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "baby_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"baby_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"amount" numeric,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"image_file_id" uuid,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "baby_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"baby_id" uuid NOT NULL,
	"time" time NOT NULL,
	"minutes" integer,
	"kind" text DEFAULT 'feed' NOT NULL,
	"title" text NOT NULL,
	"days" smallint[] DEFAULT '{}' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "families" ALTER COLUMN "enabled_modules" SET DEFAULT '{"calendar","house","cleaning","projects","info","chores","lists","kitchen","meals","recipes","shopping","garden","farm","journal","goals","fitness","budget","reports","medical","pets","witchcraft","maintenance","library","pool","dance","sports","work","vehicles","plans","parties","baby","messages","contacts","photos"}';--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "parties" ADD CONSTRAINT "parties_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "parties" ADD CONSTRAINT "parties_honoree_member_id_family_members_id_fk" FOREIGN KEY ("honoree_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "parties" ADD CONSTRAINT "parties_image_file_id_files_id_fk" FOREIGN KEY ("image_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "parties" ADD CONSTRAINT "parties_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "party_guests" ADD CONSTRAINT "party_guests_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "party_items" ADD CONSTRAINT "party_items_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "party_items" ADD CONSTRAINT "party_items_assigned_member_id_family_members_id_fk" FOREIGN KEY ("assigned_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "babies" ADD CONSTRAINT "babies_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "babies" ADD CONSTRAINT "babies_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "babies" ADD CONSTRAINT "babies_image_file_id_files_id_fk" FOREIGN KEY ("image_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "babies" ADD CONSTRAINT "babies_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "baby_logs" ADD CONSTRAINT "baby_logs_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "baby_logs" ADD CONSTRAINT "baby_logs_baby_id_babies_id_fk" FOREIGN KEY ("baby_id") REFERENCES "public"."babies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "baby_logs" ADD CONSTRAINT "baby_logs_image_file_id_files_id_fk" FOREIGN KEY ("image_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "baby_logs" ADD CONSTRAINT "baby_logs_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "baby_schedule" ADD CONSTRAINT "baby_schedule_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "baby_schedule" ADD CONSTRAINT "baby_schedule_baby_id_babies_id_fk" FOREIGN KEY ("baby_id") REFERENCES "public"."babies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "parties_family_idx" ON "parties" USING btree ("family_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "party_guests_party_idx" ON "party_guests" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "party_items_party_idx" ON "party_items" USING btree ("party_id","kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "babies_family_idx" ON "babies" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "baby_logs_baby_idx" ON "baby_logs" USING btree ("baby_id","started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "baby_logs_kind_idx" ON "baby_logs" USING btree ("baby_id","kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "baby_schedule_baby_idx" ON "baby_schedule" USING btree ("baby_id","time");--> statement-breakpoint
UPDATE "families" SET "enabled_modules" = array_append("enabled_modules", 'parties') WHERE NOT ('parties' = ANY("enabled_modules"));--> statement-breakpoint
UPDATE "families" SET "enabled_modules" = array_append("enabled_modules", 'baby') WHERE NOT ('baby' = ANY("enabled_modules"));
