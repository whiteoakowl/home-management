ALTER TYPE "public"."entity_type" ADD VALUE IF NOT EXISTS 'work_schedule';--> statement-breakpoint
ALTER TABLE "family_members" ADD COLUMN IF NOT EXISTS "work_visibility" "visibility" DEFAULT 'family' NOT NULL;
