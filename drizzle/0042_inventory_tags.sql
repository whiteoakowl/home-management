ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "tags" text[] DEFAULT '{}' NOT NULL;
