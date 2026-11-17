ALTER TYPE "public"."entity_type" ADD VALUE 'feed_order';--> statement-breakpoint
CREATE TABLE "feed_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"name" text NOT NULL,
	"quantity" text,
	"got" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"title" text NOT NULL,
	"due_date" date NOT NULL,
	"store" text,
	"notes" text,
	"visibility" "visibility" DEFAULT 'family' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "animals" ADD COLUMN "care_instructions" text;--> statement-breakpoint
ALTER TABLE "animals" ADD COLUMN "care_steps" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "feed_order_items" ADD CONSTRAINT "feed_order_items_order_id_feed_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."feed_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_orders" ADD CONSTRAINT "feed_orders_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_orders" ADD CONSTRAINT "feed_orders_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feed_order_items_order_idx" ON "feed_order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "feed_orders_family_due_idx" ON "feed_orders" USING btree ("family_id","due_date");