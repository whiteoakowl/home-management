ALTER TYPE "public"."app_module" ADD VALUE IF NOT EXISTS 'sports' BEFORE 'work';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sport_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"kind" text DEFAULT 'game' NOT NULL,
	"opponent" text,
	"date" date NOT NULL,
	"arrive_time" time,
	"start_time" time,
	"location" text,
	"home_away" text,
	"our_score" integer,
	"their_score" integer,
	"outcome" text,
	"details" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sport_practices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time,
	"location" text,
	"starts_on" date,
	"ends_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sport_stat_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sport_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"sport" text NOT NULL,
	"sport_name" text,
	"name" text NOT NULL,
	"season" text,
	"league" text,
	"position" text,
	"jersey_number" text,
	"coach" text,
	"coach_contact" text,
	"custom_stats" text[] DEFAULT '{}' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "families" ALTER COLUMN "enabled_modules" SET DEFAULT '{"calendar","house","cleaning","projects","info","chores","lists","kitchen","meals","recipes","shopping","garden","farm","journal","goals","fitness","budget","reports","medical","pets","witchcraft","maintenance","library","pool","dance","sports","work","vehicles","plans"}';--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "sport_games" ADD CONSTRAINT "sport_games_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "sport_games" ADD CONSTRAINT "sport_games_team_id_sport_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."sport_teams"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "sport_practices" ADD CONSTRAINT "sport_practices_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "sport_practices" ADD CONSTRAINT "sport_practices_team_id_sport_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."sport_teams"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "sport_stat_lines" ADD CONSTRAINT "sport_stat_lines_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "sport_stat_lines" ADD CONSTRAINT "sport_stat_lines_game_id_sport_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."sport_games"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "sport_stat_lines" ADD CONSTRAINT "sport_stat_lines_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "sport_teams" ADD CONSTRAINT "sport_teams_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "sport_teams" ADD CONSTRAINT "sport_teams_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sport_games_family_idx" ON "sport_games" USING btree ("family_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sport_practices_family_idx" ON "sport_practices" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sport_stats_game_idx" ON "sport_stat_lines" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sport_teams_member_idx" ON "sport_teams" USING btree ("member_id");--> statement-breakpoint
-- Existing families get Sports switched on (the account owner can turn it off in Settings → Sections).
UPDATE "families" SET "enabled_modules" = array_append("enabled_modules", 'sports') WHERE NOT ('sports' = ANY("enabled_modules"));
