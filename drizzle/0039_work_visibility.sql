ALTER TYPE "public"."entity_type" ADD VALUE 'work_schedule';--> statement-breakpoint
ALTER TABLE "family_members" ADD COLUMN "work_visibility" "visibility" DEFAULT 'family' NOT NULL;