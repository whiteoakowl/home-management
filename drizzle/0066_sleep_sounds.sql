ALTER TYPE "public"."app_module" ADD VALUE IF NOT EXISTS 'sounds' BEFORE 'messages';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sound_mixes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"name" text NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL,
	"allow_edits" boolean DEFAULT false NOT NULL,
	"last_played_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sound_preferences" (
	"member_id" uuid PRIMARY KEY NOT NULL,
	"family_id" uuid NOT NULL,
	"default_volume" smallint DEFAULT 60 NOT NULL,
	"default_timer" smallint DEFAULT 60 NOT NULL,
	"fade_out" boolean DEFAULT true NOT NULL,
	"preferred_sound" text,
	"favorite_sounds" text[] DEFAULT '{}' NOT NULL,
	"favorite_mixes" uuid[] DEFAULT '{}' NOT NULL,
	"recent" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reminder_kind" text,
	"reminder_time" time,
	"reminder_days" smallint[] DEFAULT '{}' NOT NULL,
	"last_reminder_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "families" ALTER COLUMN "enabled_modules" SET DEFAULT '{"calendar","house","cleaning","projects","info","chores","lists","kitchen","meals","recipes","shopping","garden","farm","journal","goals","fitness","budget","reports","medical","pets","witchcraft","maintenance","library","pool","dance","sports","work","vehicles","plans","parties","baby","sounds","messages","contacts","photos"}';--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sound_mixes" ADD CONSTRAINT "sound_mixes_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sound_mixes" ADD CONSTRAINT "sound_mixes_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sound_preferences" ADD CONSTRAINT "sound_preferences_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sound_preferences" ADD CONSTRAINT "sound_preferences_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sound_mixes_family_idx" ON "sound_mixes" USING btree ("family_id","is_shared");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sound_mixes_member_idx" ON "sound_mixes" USING btree ("member_id");--> statement-breakpoint
ALTER TABLE "sound_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sound_mixes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
UPDATE "families" SET "enabled_modules" = array_append("enabled_modules", 'sounds') WHERE NOT ('sounds' = ANY("enabled_modules"));
