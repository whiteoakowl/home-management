ALTER TABLE "household_info" ADD COLUMN "kind" text DEFAULT 'note' NOT NULL;--> statement-breakpoint
ALTER TABLE "household_info" ADD COLUMN "fields" jsonb DEFAULT '{}'::jsonb NOT NULL;