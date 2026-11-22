ALTER TABLE "household_info" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'note' NOT NULL;--> statement-breakpoint
ALTER TABLE "household_info" ADD COLUMN IF NOT EXISTS "fields" jsonb DEFAULT '{}'::jsonb NOT NULL;
