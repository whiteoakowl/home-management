-- Split House into separate permission areas: Cleaning, House Projects, Important Info.
-- Rebuild the enum (instead of ALTER TYPE ... ADD VALUE) so the new values can be used
-- in this same migration run.
DO $$
DECLARE r record;
BEGIN
  CREATE TYPE "public"."app_module_new" AS ENUM('calendar', 'house', 'cleaning', 'projects', 'info', 'chores', 'lists', 'kitchen', 'meals', 'recipes', 'shopping', 'garden', 'farm', 'journal', 'goals', 'fitness', 'budget', 'reports', 'medical', 'pets', 'witchcraft', 'maintenance', 'library');
  FOR r IN
    SELECT table_schema, table_name, column_name, column_default
    FROM information_schema.columns
    WHERE udt_schema = 'public' AND udt_name = 'app_module'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I DROP DEFAULT', r.table_schema, r.table_name, r.column_name);
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I TYPE "public"."app_module_new" USING %I::text::"public"."app_module_new"', r.table_schema, r.table_name, r.column_name, r.column_name);
    IF r.column_default IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT %L', r.table_schema, r.table_name, r.column_name, split_part(r.column_default, '''', 2));
    END IF;
  END LOOP;
  DROP TYPE "public"."app_module";
  ALTER TYPE "public"."app_module_new" RENAME TO "app_module";
END $$;--> statement-breakpoint
-- Everyone keeps the access they had: House → Cleaning and Important Info, Maintenance → House Projects.
INSERT INTO "member_permissions" ("member_id", "module", "level")
SELECT "member_id", m.module::"app_module", "level" FROM "member_permissions" p
CROSS JOIN (VALUES ('cleaning'), ('info')) AS m(module) WHERE p."module"::text = 'house'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "member_permissions" ("member_id", "module", "level")
SELECT "member_id", 'projects'::"app_module", "level" FROM "member_permissions" p WHERE p."module"::text = 'maintenance'
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "families" SET "enabled_modules" = array_cat("enabled_modules", ARRAY['cleaning', 'info']) WHERE 'house' = ANY("enabled_modules") AND NOT 'cleaning' = ANY("enabled_modules");--> statement-breakpoint
UPDATE "families" SET "enabled_modules" = array_append("enabled_modules", 'projects') WHERE 'maintenance' = ANY("enabled_modules") AND NOT 'projects' = ANY("enabled_modules");--> statement-breakpoint
ALTER TABLE "families" ALTER COLUMN "enabled_modules" SET DEFAULT '{"calendar","house","cleaning","projects","info","chores","lists","kitchen","meals","recipes","shopping","garden","farm","journal","goals","fitness","budget","reports","medical","pets","witchcraft","maintenance","library"}';
