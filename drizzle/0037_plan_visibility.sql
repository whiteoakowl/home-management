ALTER TYPE "public"."entity_type" ADD VALUE 'farm_plan';--> statement-breakpoint
ALTER TYPE "public"."entity_type" ADD VALUE 'garden_plan';--> statement-breakpoint
ALTER TABLE "garden_plans" ADD COLUMN "visibility" "visibility" DEFAULT 'family' NOT NULL;--> statement-breakpoint
ALTER TABLE "garden_plans" ADD COLUMN "created_by_member_id" uuid;--> statement-breakpoint
ALTER TABLE "farm_plans" ADD COLUMN "visibility" "visibility" DEFAULT 'family' NOT NULL;--> statement-breakpoint
ALTER TABLE "farm_plans" ADD COLUMN "created_by_member_id" uuid;--> statement-breakpoint
ALTER TABLE "garden_plans" ADD CONSTRAINT "garden_plans_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_plans" ADD CONSTRAINT "farm_plans_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;