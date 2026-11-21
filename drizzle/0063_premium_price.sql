ALTER TABLE "platform_settings" ALTER COLUMN "monthly_price_cents" SET DEFAULT 1299;--> statement-breakpoint
ALTER TABLE "platform_settings" ALTER COLUMN "yearly_price_cents" SET DEFAULT 12999;--> statement-breakpoint
-- New Premium price: $12.99/month, $129.99/year (still editable in Admin afterwards).
UPDATE "platform_settings" SET "monthly_price_cents" = 1299, "yearly_price_cents" = 12999, "updated_at" = now() WHERE "id" = 'default';
