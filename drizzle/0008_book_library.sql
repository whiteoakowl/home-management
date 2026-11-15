ALTER TYPE "public"."category_domain" ADD VALUE 'book';--> statement-breakpoint
ALTER TYPE "public"."entity_type" ADD VALUE 'book';--> statement-breakpoint
ALTER TYPE "public"."app_module" ADD VALUE 'library';--> statement-breakpoint
CREATE TABLE "book_categories" (
	"book_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "book_categories_book_id_category_id_pk" PRIMARY KEY("book_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"author" text,
	"co_author" text,
	"isbn" text,
	"publisher" text,
	"published_date" text,
	"cover_file_id" uuid,
	"description" text,
	"genre" text,
	"page_count" integer,
	"edition" text,
	"format" text,
	"acquired_on" date,
	"purchase_location" text,
	"price_cents" integer,
	"rating" integer,
	"notes" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"reader_member_id" uuid,
	"started_on" date,
	"finished_on" date,
	"current_page" integer,
	"reading_notes" text,
	"visibility" "visibility" DEFAULT 'family' NOT NULL,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "families" ALTER COLUMN "enabled_modules" SET DEFAULT '{"calendar","house","chores","lists","kitchen","meals","recipes","shopping","garden","farm","journal","goals","fitness","budget","reports","medical","pets","witchcraft","maintenance","library"}';--> statement-breakpoint
ALTER TABLE "book_categories" ADD CONSTRAINT "book_categories_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_categories" ADD CONSTRAINT "book_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_cover_file_id_files_id_fk" FOREIGN KEY ("cover_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_reader_member_id_family_members_id_fk" FOREIGN KEY ("reader_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "book_categories_category_idx" ON "book_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "books_family_idx" ON "books" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "books_isbn_idx" ON "books" USING btree ("family_id","isbn");--> statement-breakpoint
-- Existing families get the Book Library switched on (they can turn it off in Settings).
UPDATE "families" SET "enabled_modules" = (SELECT array_agg(DISTINCT m) FROM unnest("enabled_modules" || ARRAY['library']::text[]) AS m);
