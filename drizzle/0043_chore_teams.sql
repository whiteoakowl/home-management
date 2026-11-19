ALTER TABLE "chore_occurrences" ADD COLUMN IF NOT EXISTS "assignee_ids" uuid[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "chore_occurrences" ADD COLUMN IF NOT EXISTS "awarded_member_ids" uuid[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "chores" ADD COLUMN IF NOT EXISTS "assignee_ids" uuid[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
-- Existing single assignments become one-person teams (nothing is reassigned).
UPDATE "chores" SET "assignee_ids" = ARRAY["default_assignee_id"] WHERE "default_assignee_id" IS NOT NULL AND cardinality("assignee_ids") = 0;--> statement-breakpoint
UPDATE "chore_occurrences" SET "assignee_ids" = ARRAY["assignee_id"] WHERE "assignee_id" IS NOT NULL AND cardinality("assignee_ids") = 0;
