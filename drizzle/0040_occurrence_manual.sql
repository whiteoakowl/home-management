ALTER TABLE "chore_occurrences" ADD COLUMN IF NOT EXISTS "assigned_manually" boolean DEFAULT false NOT NULL;
