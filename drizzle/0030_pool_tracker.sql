ALTER TYPE "public"."app_module" ADD VALUE 'pool';--> statement-breakpoint
CREATE TABLE "pool_additions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"pool_id" uuid NOT NULL,
	"date" date NOT NULL,
	"chemical" text NOT NULL,
	"amount" text,
	"cost_cents" integer,
	"notes" text,
	"added_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pool_equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"pool_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'other' NOT NULL,
	"model" text,
	"installed_on" date,
	"last_serviced_on" date,
	"service_every_months" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pool_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"pool_id" uuid NOT NULL,
	"tested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fc" double precision,
	"cc" double precision,
	"ph" double precision,
	"ta" double precision,
	"ch" double precision,
	"cya" double precision,
	"salt" double precision,
	"temp_f" double precision,
	"phosphates" double precision,
	"notes" text,
	"photo_file_id" uuid,
	"tested_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'pool' NOT NULL,
	"gallons" integer NOT NULL,
	"sanitizer" text DEFAULT 'chlorine' NOT NULL,
	"surface" text DEFAULT 'plaster' NOT NULL,
	"chlorine_product" text DEFAULT 'liquid10' NOT NULL,
	"salt_target" integer,
	"filter_type" text,
	"is_open" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "families" ALTER COLUMN "enabled_modules" SET DEFAULT '{"calendar","house","cleaning","projects","info","chores","lists","kitchen","meals","recipes","shopping","garden","farm","journal","goals","fitness","budget","reports","medical","pets","witchcraft","maintenance","library","pool"}';--> statement-breakpoint
ALTER TABLE "chores" ADD COLUMN "pool_id" uuid;--> statement-breakpoint
ALTER TABLE "pool_additions" ADD CONSTRAINT "pool_additions_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_additions" ADD CONSTRAINT "pool_additions_pool_id_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_additions" ADD CONSTRAINT "pool_additions_added_by_member_id_family_members_id_fk" FOREIGN KEY ("added_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_equipment" ADD CONSTRAINT "pool_equipment_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_equipment" ADD CONSTRAINT "pool_equipment_pool_id_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_tests" ADD CONSTRAINT "pool_tests_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_tests" ADD CONSTRAINT "pool_tests_pool_id_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_tests" ADD CONSTRAINT "pool_tests_photo_file_id_files_id_fk" FOREIGN KEY ("photo_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_tests" ADD CONSTRAINT "pool_tests_tested_by_member_id_family_members_id_fk" FOREIGN KEY ("tested_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pools" ADD CONSTRAINT "pools_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pools" ADD CONSTRAINT "pools_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pool_additions_pool_idx" ON "pool_additions" USING btree ("pool_id","date");--> statement-breakpoint
CREATE INDEX "pool_equipment_pool_idx" ON "pool_equipment" USING btree ("pool_id");--> statement-breakpoint
CREATE INDEX "pool_tests_pool_idx" ON "pool_tests" USING btree ("pool_id","tested_at");--> statement-breakpoint
CREATE INDEX "pools_family_idx" ON "pools" USING btree ("family_id");--> statement-breakpoint
-- Turn Pool on for existing families (parents can switch it off in Settings → Areas).
UPDATE "families" SET "enabled_modules" = array_append("enabled_modules", 'pool') WHERE NOT ('pool' = ANY("enabled_modules"));
