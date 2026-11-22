CREATE TABLE "reading_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"status" text DEFAULT 'reading' NOT NULL,
	"started_on" date,
	"finished_on" date,
	"current_page" integer,
	"notes" text,
	"shared" boolean DEFAULT true NOT NULL,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "books" DROP CONSTRAINT "books_reader_member_id_family_members_id_fk";
--> statement-breakpoint
ALTER TABLE "reading_entries" ADD CONSTRAINT "reading_entries_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_entries" ADD CONSTRAINT "reading_entries_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_entries" ADD CONSTRAINT "reading_entries_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_entries" ADD CONSTRAINT "reading_entries_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reading_entries_book_member_uq" ON "reading_entries" USING btree ("book_id","member_id");--> statement-breakpoint
CREATE INDEX "reading_entries_member_idx" ON "reading_entries" USING btree ("member_id","status");--> statement-breakpoint
CREATE INDEX "reading_entries_family_idx" ON "reading_entries" USING btree ("family_id","status");--> statement-breakpoint
-- Keep everyone's reading progress: each book that had a reading status becomes a
-- reading-log entry for its reader (or the book's owner / whoever added it).
-- Shared with the family when the book was a family-visible Family Library book.
INSERT INTO "reading_entries" ("family_id", "book_id", "member_id", "status", "started_on", "finished_on", "current_page", "notes", "shared", "created_by_member_id", "created_at", "updated_at")
SELECT b."family_id", b."id", COALESCE(b."reader_member_id", b."owner_member_id", b."created_by_member_id"),
       b."status", b."started_on", b."finished_on", b."current_page", b."reading_notes",
       (b."owner_member_id" IS NULL AND b."visibility" = 'family'),
       b."created_by_member_id", b."updated_at", b."updated_at"
FROM "books" b
WHERE b."status" <> 'not_started'
  AND COALESCE(b."reader_member_id", b."owner_member_id", b."created_by_member_id") IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "books" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "books" DROP COLUMN "reader_member_id";--> statement-breakpoint
ALTER TABLE "books" DROP COLUMN "started_on";--> statement-breakpoint
ALTER TABLE "books" DROP COLUMN "finished_on";--> statement-breakpoint
ALTER TABLE "books" DROP COLUMN "current_page";--> statement-breakpoint
ALTER TABLE "books" DROP COLUMN "reading_notes";