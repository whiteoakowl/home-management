ALTER TABLE "family_members" ADD COLUMN "private_vehicles" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "private_owner_id" uuid;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_private_owner_id_family_members_id_fk" FOREIGN KEY ("private_owner_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;