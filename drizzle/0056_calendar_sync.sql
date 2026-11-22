CREATE TABLE "calendar_feeds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"token" text NOT NULL,
	"layers" text[] NOT NULL,
	"only_mine" boolean DEFAULT false NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"color" text DEFAULT 'sky' NOT NULL,
	"shared" boolean DEFAULT true NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fetched_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_feeds" ADD CONSTRAINT "calendar_feeds_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_feeds" ADD CONSTRAINT "calendar_feeds_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_imports" ADD CONSTRAINT "calendar_imports_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_imports" ADD CONSTRAINT "calendar_imports_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_feeds_token_uq" ON "calendar_feeds" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_feeds_member_uq" ON "calendar_feeds" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "calendar_imports_family_idx" ON "calendar_imports" USING btree ("family_id");