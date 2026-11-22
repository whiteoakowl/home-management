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
);--> statement-breakpoint
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
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media_favorites" (
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_favorites_member_id_entity_type_entity_id_pk" PRIMARY KEY("member_id","entity_type","entity_id")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media_reactions" (
	"family_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_reactions_entity_type_entity_id_member_id_emoji_pk" PRIMARY KEY("entity_type","entity_id","member_id","emoji")
);--> statement-breakpoint
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
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memory_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"memory_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"media_type" text DEFAULT 'photo' NOT NULL,
	"caption" text,
	"sort" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "entity_photos" ADD COLUMN IF NOT EXISTS "media_type" text DEFAULT 'photo' NOT NULL;--> statement-breakpoint
ALTER TABLE "entity_photos" ADD COLUMN IF NOT EXISTS "taken_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "entity_photos" ADD COLUMN IF NOT EXISTS "milestone" text;--> statement-breakpoint
ALTER TABLE "photo_albums" ADD COLUMN IF NOT EXISTS "owner_member_id" uuid;--> statement-breakpoint
ALTER TABLE "photo_albums" ADD COLUMN IF NOT EXISTS "private" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "photo_albums" ADD COLUMN IF NOT EXISTS "plan_id" uuid;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "plan_expenses" ADD CONSTRAINT "plan_expenses_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "plan_expenses" ADD CONSTRAINT "plan_expenses_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "plan_expenses" ADD CONSTRAINT "plan_expenses_paid_by_member_id_family_members_id_fk" FOREIGN KEY ("paid_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "family_dates" ADD CONSTRAINT "family_dates_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "family_dates" ADD CONSTRAINT "family_dates_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "media_comments" ADD CONSTRAINT "media_comments_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "media_comments" ADD CONSTRAINT "media_comments_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "media_favorites" ADD CONSTRAINT "media_favorites_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "media_favorites" ADD CONSTRAINT "media_favorites_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "media_reactions" ADD CONSTRAINT "media_reactions_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "media_reactions" ADD CONSTRAINT "media_reactions_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "memories" ADD CONSTRAINT "memories_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "memories" ADD CONSTRAINT "memories_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "memory_media" ADD CONSTRAINT "memory_media_memory_id_memories_id_fk" FOREIGN KEY ("memory_id") REFERENCES "public"."memories"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "memory_media" ADD CONSTRAINT "memory_media_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "memory_media" ADD CONSTRAINT "memory_media_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plan_expenses_plan_idx" ON "plan_expenses" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "family_dates_family_idx" ON "family_dates" USING btree ("family_id","month","day");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_comments_entity_idx" ON "media_comments" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memories_family_date_idx" ON "memories" USING btree ("family_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memory_media_memory_idx" ON "memory_media" USING btree ("memory_id");--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "photo_albums" ADD CONSTRAINT "photo_albums_owner_member_id_family_members_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entity_photos_family_taken_idx" ON "entity_photos" USING btree ("family_id","taken_at");--> statement-breakpoint
-- Existing photos: date them by when they were added.
UPDATE "entity_photos" SET "taken_at" = "created_at" WHERE "taken_at" IS NULL;
