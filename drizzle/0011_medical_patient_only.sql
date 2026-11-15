ALTER TABLE "allergies" ALTER COLUMN "visibility" SET DEFAULT 'parents';--> statement-breakpoint
ALTER TABLE "food_restrictions" ALTER COLUMN "visibility" SET DEFAULT 'parents';--> statement-breakpoint
ALTER TABLE "medical_conditions" ALTER COLUMN "visibility" SET DEFAULT 'parents';--> statement-breakpoint
ALTER TABLE "medical_documents" ALTER COLUMN "visibility" SET DEFAULT 'parents';--> statement-breakpoint
ALTER TABLE "medical_profiles" ALTER COLUMN "visibility" SET DEFAULT 'parents';--> statement-breakpoint
ALTER TABLE "medications" ALTER COLUMN "visibility" SET DEFAULT 'parents';;--> statement-breakpoint
-- Medical "private" used to mean patient & parents. Keep that meaning: it's now 'parents'.
UPDATE "medical_profiles" SET "visibility" = 'parents' WHERE "visibility" = 'private';--> statement-breakpoint
UPDATE "allergies" SET "visibility" = 'parents' WHERE "visibility" = 'private';--> statement-breakpoint
UPDATE "food_restrictions" SET "visibility" = 'parents' WHERE "visibility" = 'private';--> statement-breakpoint
UPDATE "medical_conditions" SET "visibility" = 'parents' WHERE "visibility" = 'private';--> statement-breakpoint
UPDATE "medications" SET "visibility" = 'parents' WHERE "visibility" = 'private';--> statement-breakpoint
UPDATE "medical_documents" SET "visibility" = 'parents' WHERE "visibility" = 'private';--> statement-breakpoint
-- Medical appointments were stored as 'selected' (patient + creator, parents implied).
-- Ones shared with nobody else become "Patient & parents"; the rest keep parents on the list.
UPDATE "calendar_events" e SET "visibility" = 'parents'
WHERE e."source"::text = 'medical' AND e."visibility" = 'selected' AND NOT EXISTS (
  SELECT 1 FROM "record_access" ra
  WHERE ra."entity_type" = 'event' AND ra."entity_id" = e."id"
    AND ra."member_id" IS DISTINCT FROM e."source_id" AND ra."member_id" IS DISTINCT FROM e."created_by_member_id"
);--> statement-breakpoint
INSERT INTO "record_access" ("family_id", "entity_type", "entity_id", "member_id")
SELECT e."family_id", 'event', e."id", m."id"
FROM "calendar_events" e JOIN "family_members" m ON m."family_id" = e."family_id" AND m."role" = 'parent' AND m."is_active"
WHERE e."source"::text = 'medical' AND e."visibility" = 'selected'
ON CONFLICT DO NOTHING;
