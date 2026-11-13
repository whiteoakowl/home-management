-- Existing families get the four add-on modules switched on (they can turn them off in Settings).
UPDATE "families" SET "enabled_modules" = (
  SELECT array_agg(DISTINCT m) FROM unnest("enabled_modules" || ARRAY['medical','pets','witchcraft','maintenance']::text[]) AS m
);
