ALTER TYPE "public"."access_level" ADD VALUE 'add' BEFORE 'edit';--> statement-breakpoint
ALTER TABLE "family_members" ADD COLUMN "private_food" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "owner_member_id" uuid;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "owner_member_id" uuid;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "created_by_member_id" uuid;--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ADD COLUMN "owner_member_id" uuid;--> statement-breakpoint
ALTER TABLE "recipe_collections" ADD COLUMN "owner_member_id" uuid;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "owner_member_id" uuid;--> statement-breakpoint
ALTER TABLE "lists" ADD CONSTRAINT "lists_owner_member_id_family_members_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_owner_member_id_family_members_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "meal_plan_entries_owner_member_id_family_members_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_collections" ADD CONSTRAINT "recipe_collections_owner_member_id_family_members_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_owner_member_id_family_members_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_owner_idx" ON "inventory_items" USING btree ("owner_member_id");