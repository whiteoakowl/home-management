ALTER TYPE "public"."app_module" ADD VALUE 'dance';--> statement-breakpoint
ALTER TYPE "public"."app_module" ADD VALUE 'work';--> statement-breakpoint
CREATE TABLE "dance_classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"enrollment_id" uuid,
	"title" text NOT NULL,
	"weekday" smallint NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time,
	"location" text,
	"starts_on" date,
	"ends_on" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dance_days_off" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid,
	"title" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dance_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'team' NOT NULL,
	"level" text,
	"studio" text,
	"style" text,
	"season" text,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dance_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_ids" uuid[] DEFAULT '{}' NOT NULL,
	"kind" text DEFAULT 'performance' NOT NULL,
	"title" text NOT NULL,
	"date" date NOT NULL,
	"end_date" date,
	"call_time" time,
	"start_time" time,
	"end_time" time,
	"location" text,
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"job" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "families" ALTER COLUMN "enabled_modules" SET DEFAULT '{"calendar","house","cleaning","projects","info","chores","lists","kitchen","meals","recipes","shopping","garden","farm","journal","goals","fitness","budget","reports","medical","pets","witchcraft","maintenance","library","pool","dance","work"}';--> statement-breakpoint
ALTER TABLE "dance_classes" ADD CONSTRAINT "dance_classes_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dance_classes" ADD CONSTRAINT "dance_classes_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dance_classes" ADD CONSTRAINT "dance_classes_enrollment_id_dance_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."dance_enrollments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dance_days_off" ADD CONSTRAINT "dance_days_off_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dance_days_off" ADD CONSTRAINT "dance_days_off_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dance_enrollments" ADD CONSTRAINT "dance_enrollments_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dance_enrollments" ADD CONSTRAINT "dance_enrollments_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dance_events" ADD CONSTRAINT "dance_events_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_shifts" ADD CONSTRAINT "work_shifts_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_shifts" ADD CONSTRAINT "work_shifts_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dance_classes_family_idx" ON "dance_classes" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "dance_days_off_family_idx" ON "dance_days_off" USING btree ("family_id","start_date");--> statement-breakpoint
CREATE INDEX "dance_enrollments_member_idx" ON "dance_enrollments" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "dance_events_family_idx" ON "dance_events" USING btree ("family_id","date");--> statement-breakpoint
CREATE INDEX "work_shifts_family_date_idx" ON "work_shifts" USING btree ("family_id","date");--> statement-breakpoint
-- Turn Dance and Work on for existing families (parents can switch them off in Settings).
UPDATE "families" SET "enabled_modules" = array_append("enabled_modules", 'dance') WHERE NOT ('dance' = ANY("enabled_modules"));--> statement-breakpoint
UPDATE "families" SET "enabled_modules" = array_append("enabled_modules", 'work') WHERE NOT ('work' = ANY("enabled_modules"));
