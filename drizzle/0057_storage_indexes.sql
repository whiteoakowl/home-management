CREATE INDEX IF NOT EXISTS "activity_created_idx" ON "activity_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_tokens_expires_idx" ON "auth_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "files_created_idx" ON "files" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_created_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_expires_idx" ON "sessions" USING btree ("expires_at");