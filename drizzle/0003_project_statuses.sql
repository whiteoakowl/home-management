-- Remodeling statuses: Idea / Planning / Budgeting / Ready to Start / In Progress / On Hold / Completed.
UPDATE "home_projects" SET "status" = 'planning' WHERE "status" = 'planned';--> statement-breakpoint
UPDATE "home_projects" SET "status" = 'completed' WHERE "status" = 'done';--> statement-breakpoint
ALTER TABLE "home_projects" ALTER COLUMN "status" SET DEFAULT 'idea';
