-- New access level "use": check things off, mark them done and earn points, but
-- no adding or editing. The enum is rebuilt (not ALTER TYPE ADD VALUE) so the new
-- value can be used in this same migration run. Everyone who had "view" moves to
-- "use": until now View only already allowed checking things off, so nobody loses
-- anything. From now on "View only" means look only.
DO $$
DECLARE r record;
BEGIN
  CREATE TYPE "public"."access_level_new" AS ENUM('none', 'view', 'use', 'add', 'edit');
  FOR r IN
    SELECT table_schema, table_name, column_name, column_default
    FROM information_schema.columns
    WHERE udt_schema = 'public' AND udt_name = 'access_level'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I DROP DEFAULT', r.table_schema, r.table_name, r.column_name);
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I TYPE "public"."access_level_new" USING (CASE WHEN %I::text = ''view'' THEN ''use'' ELSE %I::text END)::"public"."access_level_new"', r.table_schema, r.table_name, r.column_name, r.column_name, r.column_name);
    IF r.column_default IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT %L', r.table_schema, r.table_name, r.column_name, split_part(r.column_default, '''', 2));
    END IF;
  END LOOP;
  DROP TYPE "public"."access_level";
  ALTER TYPE "public"."access_level_new" RENAME TO "access_level";
END $$;--> statement-breakpoint
-- Period Tracker mode replaces the on/off ovulation switch. "On" keeps today's
-- wording (ovulation window), so it becomes "ovulation".
ALTER TABLE "personal_health_profiles" ADD COLUMN "period_mode" text DEFAULT 'basic' NOT NULL;--> statement-breakpoint
UPDATE "personal_health_profiles" SET "period_mode" = 'ovulation' WHERE "show_ovulation" = true;
