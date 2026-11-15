-- Add 'parents' to the visibility enum by rebuilding the type, so the new value can be
-- used later in the same migration run (ALTER TYPE ... ADD VALUE can't be used in-transaction).
DO $$
DECLARE r record;
BEGIN
  CREATE TYPE "public"."visibility_new" AS ENUM('family', 'private', 'selected', 'parents');
  FOR r IN
    SELECT table_schema, table_name, column_name, column_default
    FROM information_schema.columns
    WHERE udt_schema = 'public' AND udt_name = 'visibility'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I DROP DEFAULT', r.table_schema, r.table_name, r.column_name);
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I TYPE "public"."visibility_new" USING %I::text::"public"."visibility_new"', r.table_schema, r.table_name, r.column_name, r.column_name);
    IF r.column_default IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT %L', r.table_schema, r.table_name, r.column_name, split_part(r.column_default, '''', 2));
    END IF;
  END LOOP;
  DROP TYPE "public"."visibility";
  ALTER TYPE "public"."visibility_new" RENAME TO "visibility";
END $$;--> statement-breakpoint
ALTER TABLE "list_items" ADD COLUMN "personal_for_member_id" uuid;--> statement-breakpoint
ALTER TABLE "list_items" ADD COLUMN "added_by_member_id" uuid;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "owner_member_id" uuid;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_personal_for_member_id_family_members_id_fk" FOREIGN KEY ("personal_for_member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_added_by_member_id_family_members_id_fk" FOREIGN KEY ("added_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_owner_member_id_family_members_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "books_owner_idx" ON "books" USING btree ("owner_member_id");