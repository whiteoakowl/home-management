ALTER TYPE "public"."app_module" ADD VALUE 'vehicles';--> statement-breakpoint
CREATE TABLE "vehicle_odometer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"date" date NOT NULL,
	"miles" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"name" text NOT NULL,
	"part_number" text,
	"brand" text,
	"where_to_buy" text,
	"last_replaced_on" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"title" text NOT NULL,
	"every_miles" integer,
	"every_months" integer,
	"last_date" date,
	"last_miles" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"schedule_id" uuid,
	"date" date NOT NULL,
	"miles" integer,
	"kind" text DEFAULT 'maintenance' NOT NULL,
	"title" text NOT NULL,
	"shop" text,
	"parts" text,
	"cost_cents" integer,
	"receipt_file_id" uuid,
	"notes" text,
	"logged_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"nickname" text NOT NULL,
	"year" integer,
	"make" text,
	"model" text,
	"trim" text,
	"color" text,
	"vin" text,
	"plate" text,
	"driver_member_id" uuid,
	"image_file_id" uuid,
	"purchase_date" date,
	"purchase_price_cents" integer,
	"oil_type" text,
	"tire_size" text,
	"insurance_company" text,
	"insurance_policy" text,
	"insurance_renews_on" date,
	"registration_expires_on" date,
	"inspection_due_on" date,
	"loan_lender" text,
	"loan_amount_cents" integer,
	"loan_apr" double precision,
	"loan_payment_cents" integer,
	"loan_start_date" date,
	"loan_term_months" integer,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "families" ALTER COLUMN "enabled_modules" SET DEFAULT '{"calendar","house","cleaning","projects","info","chores","lists","kitchen","meals","recipes","shopping","garden","farm","journal","goals","fitness","budget","reports","medical","pets","witchcraft","maintenance","library","pool","dance","work","vehicles"}';--> statement-breakpoint
ALTER TABLE "vehicle_odometer" ADD CONSTRAINT "vehicle_odometer_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_odometer" ADD CONSTRAINT "vehicle_odometer_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_parts" ADD CONSTRAINT "vehicle_parts_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_parts" ADD CONSTRAINT "vehicle_parts_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_schedule" ADD CONSTRAINT "vehicle_schedule_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_schedule" ADD CONSTRAINT "vehicle_schedule_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_services" ADD CONSTRAINT "vehicle_services_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_services" ADD CONSTRAINT "vehicle_services_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_services" ADD CONSTRAINT "vehicle_services_schedule_id_vehicle_schedule_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."vehicle_schedule"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_services" ADD CONSTRAINT "vehicle_services_receipt_file_id_files_id_fk" FOREIGN KEY ("receipt_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_services" ADD CONSTRAINT "vehicle_services_logged_by_member_id_family_members_id_fk" FOREIGN KEY ("logged_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_driver_member_id_family_members_id_fk" FOREIGN KEY ("driver_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_image_file_id_files_id_fk" FOREIGN KEY ("image_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vehicle_odometer_vehicle_idx" ON "vehicle_odometer" USING btree ("vehicle_id","date");--> statement-breakpoint
CREATE INDEX "vehicle_parts_vehicle_idx" ON "vehicle_parts" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "vehicle_schedule_vehicle_idx" ON "vehicle_schedule" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "vehicle_services_vehicle_idx" ON "vehicle_services" USING btree ("vehicle_id","date");--> statement-breakpoint
CREATE INDEX "vehicles_family_idx" ON "vehicles" USING btree ("family_id");--> statement-breakpoint
-- Turn Vehicles on for existing families (parents can switch it off in Settings).
UPDATE "families" SET "enabled_modules" = array_append("enabled_modules", 'vehicles') WHERE NOT ('vehicles' = ANY("enabled_modules"));
