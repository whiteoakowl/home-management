ALTER TYPE "public"."category_domain" ADD VALUE IF NOT EXISTS 'storage';--> statement-breakpoint
ALTER TYPE "public"."storage_location" ADD VALUE IF NOT EXISTS 'canning' BEFORE 'farm';--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "storage_area_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_storage_area_id_categories_id_fk" FOREIGN KEY ("storage_area_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
