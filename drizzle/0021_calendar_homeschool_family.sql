-- New calendar categories for every family that already has calendar categories
-- (families without any get the full default list the first time the calendar opens).
INSERT INTO "categories" ("family_id", "domain", "name", "color", "sort_order")
SELECT f."family_id", 'calendar', c.name, c.color, f.next + c.n
FROM (SELECT "family_id", max("sort_order") + 1 AS next FROM "categories" WHERE "domain"::text = 'calendar' GROUP BY "family_id") f
CROSS JOIN (VALUES ('Homeschool', 'ocean', 0), ('Family', 'rose', 1)) AS c(name, color, n)
WHERE NOT EXISTS (
  SELECT 1 FROM "categories" x WHERE x."family_id" = f."family_id" AND x."domain"::text = 'calendar' AND lower(x."name") = lower(c.name)
);
