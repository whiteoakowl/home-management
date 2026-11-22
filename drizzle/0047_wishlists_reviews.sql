CREATE TABLE IF NOT EXISTS "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid,
	"member_id" uuid,
	"rating" integer NOT NULL,
	"title" text,
	"body" text NOT NULL,
	"display_name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wishlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"title" text NOT NULL,
	"link" text,
	"price_cents" integer,
	"priority" smallint DEFAULT 2 NOT NULL,
	"details" text,
	"occasion" text DEFAULT 'Holidays' NOT NULL,
	"claimed_by_member_id" uuid,
	"purchased" boolean DEFAULT false NOT NULL,
	"received" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "reviews" ADD CONSTRAINT "reviews_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "reviews" ADD CONSTRAINT "reviews_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_claimed_by_member_id_family_members_id_fk" FOREIGN KEY ("claimed_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviews_status_idx" ON "reviews" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wishlist_items_member_idx" ON "wishlist_items" USING btree ("family_id","member_id");
