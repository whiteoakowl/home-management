-- The family activity feed is seen by everyone. Remove past entries that named items
-- which aren't shared with the whole family (private / parents & me / selected people).
DELETE FROM "activity_log" a USING "calendar_events" e
WHERE a."module"::text = 'calendar' AND a."entity_id" = e."id" AND e."visibility"::text <> 'family';--> statement-breakpoint
DELETE FROM "activity_log" a USING "goals" g
WHERE a."module"::text = 'goals' AND a."entity_id" = g."id" AND g."visibility"::text <> 'family';--> statement-breakpoint
DELETE FROM "activity_log" a USING "books" b
WHERE a."module"::text = 'library' AND a."entity_id" = b."id" AND (b."visibility"::text <> 'family' OR b."owner_member_id" IS NOT NULL);--> statement-breakpoint
DELETE FROM "activity_log" a USING "journal_entries" j
WHERE a."verb" = 'journal.added' AND a."family_id" = j."family_id" AND a."actor_member_id" = j."author_member_id"
  AND j."visibility"::text <> 'family' AND (j."title" IS NULL OR a."summary" LIKE '%' || j."title" || '%');--> statement-breakpoint
DELETE FROM "activity_log" WHERE "verb" = 'workout.logged';
