ALTER TABLE "family_members" ADD COLUMN "private_info" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "family_members" ADD COLUMN "private_projects" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "home_projects" ADD COLUMN "private_owner_id" uuid;--> statement-breakpoint
ALTER TABLE "household_info" ADD COLUMN "private_owner_id" uuid;--> statement-breakpoint
ALTER TABLE "home_projects" ADD CONSTRAINT "home_projects_private_owner_id_family_members_id_fk" FOREIGN KEY ("private_owner_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_info" ADD CONSTRAINT "household_info_private_owner_id_family_members_id_fk" FOREIGN KEY ("private_owner_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;