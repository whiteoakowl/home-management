ALTER TYPE "public"."app_module" ADD VALUE IF NOT EXISTS 'messages';--> statement-breakpoint
ALTER TYPE "public"."app_module" ADD VALUE IF NOT EXISTS 'contacts';--> statement-breakpoint
ALTER TYPE "public"."app_module" ADD VALUE IF NOT EXISTS 'photos';--> statement-breakpoint
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
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "family_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid,
	"body" text,
	"file_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "message_reads" (
	"member_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_reads_member_id_family_id_pk" PRIMARY KEY("member_id","family_id")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "photo_albums" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"event_date" date,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "families" ALTER COLUMN "enabled_modules" SET DEFAULT '{"calendar","house","cleaning","projects","info","chores","lists","kitchen","meals","recipes","shopping","garden","farm","journal","goals","fitness","budget","reports","medical","pets","witchcraft","maintenance","library","pool","dance","sports","work","vehicles","plans","messages","contacts","photos"}';--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "contacts" ADD CONSTRAINT "contacts_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "contacts" ADD CONSTRAINT "contacts_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "family_messages" ADD CONSTRAINT "family_messages_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "family_messages" ADD CONSTRAINT "family_messages_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "family_messages" ADD CONSTRAINT "family_messages_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "photo_albums" ADD CONSTRAINT "photo_albums_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "photo_albums" ADD CONSTRAINT "photo_albums_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contacts_family_idx" ON "contacts" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "family_messages_family_idx" ON "family_messages" USING btree ("family_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "photo_albums_family_idx" ON "photo_albums" USING btree ("family_id");--> statement-breakpoint
-- Existing families get the Family Hub sections switched on (the owner can turn them off in Settings → Sections).
UPDATE "families" SET "enabled_modules" = array_append("enabled_modules", 'messages') WHERE NOT ('messages' = ANY("enabled_modules"));--> statement-breakpoint
UPDATE "families" SET "enabled_modules" = array_append("enabled_modules", 'contacts') WHERE NOT ('contacts' = ANY("enabled_modules"));--> statement-breakpoint
UPDATE "families" SET "enabled_modules" = array_append("enabled_modules", 'photos') WHERE NOT ('photos' = ANY("enabled_modules"));
