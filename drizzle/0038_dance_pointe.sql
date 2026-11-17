CREATE TABLE "pointe_favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"brand" text NOT NULL,
	"model" text,
	"size" text,
	"width" text,
	"shank" text,
	"wings" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pointe_shoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"brand" text NOT NULL,
	"model" text,
	"size" text,
	"width" text,
	"shank" text,
	"wings" text,
	"status" text DEFAULT 'on_hand' NOT NULL,
	"store" text,
	"price_cents" integer,
	"ordered_on" date,
	"received_on" date,
	"first_worn_on" date,
	"retired_on" date,
	"reorder_by" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dance_events" ADD COLUMN "cost_cents" integer;--> statement-breakpoint
ALTER TABLE "dance_events" ADD COLUMN "ticket_cents" integer;--> statement-breakpoint
ALTER TABLE "dance_events" ADD COLUMN "link" text;--> statement-breakpoint
ALTER TABLE "pointe_favorites" ADD CONSTRAINT "pointe_favorites_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pointe_favorites" ADD CONSTRAINT "pointe_favorites_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pointe_shoes" ADD CONSTRAINT "pointe_shoes_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pointe_shoes" ADD CONSTRAINT "pointe_shoes_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pointe_favorites_member_idx" ON "pointe_favorites" USING btree ("family_id","member_id");--> statement-breakpoint
CREATE INDEX "pointe_shoes_member_idx" ON "pointe_shoes" USING btree ("family_id","member_id");