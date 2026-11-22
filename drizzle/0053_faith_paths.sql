CREATE TABLE "faith_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"faith" text NOT NULL,
	"date" date NOT NULL,
	"title" text,
	"reference" text,
	"body" text NOT NULL,
	"shared" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faith_holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"faith" text NOT NULL,
	"holiday_key" text,
	"name" text NOT NULL,
	"emoji" text,
	"date" date NOT NULL,
	"yearly" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faith_practice_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"practice_id" uuid NOT NULL,
	"date" date NOT NULL,
	"amount" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faith_practices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"faith" text NOT NULL,
	"name" text NOT NULL,
	"emoji" text,
	"unit" text,
	"builtin_key" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faith_prayers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"faith" text NOT NULL,
	"title" text NOT NULL,
	"for_whom" text,
	"details" text,
	"shared" boolean DEFAULT false NOT NULL,
	"answered_on" date,
	"answer_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faith_reading_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"text_key" text NOT NULL,
	"section" integer NOT NULL,
	"read_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faith_texts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"faith" text NOT NULL,
	"title" text NOT NULL,
	"section_label" text DEFAULT 'Chapter' NOT NULL,
	"sections" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "family_members" ADD COLUMN "faith_paths" text[];--> statement-breakpoint
ALTER TABLE "faith_entries" ADD CONSTRAINT "faith_entries_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faith_entries" ADD CONSTRAINT "faith_entries_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faith_holidays" ADD CONSTRAINT "faith_holidays_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faith_holidays" ADD CONSTRAINT "faith_holidays_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faith_practice_logs" ADD CONSTRAINT "faith_practice_logs_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faith_practice_logs" ADD CONSTRAINT "faith_practice_logs_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faith_practice_logs" ADD CONSTRAINT "faith_practice_logs_practice_id_faith_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."faith_practices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faith_practices" ADD CONSTRAINT "faith_practices_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faith_practices" ADD CONSTRAINT "faith_practices_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faith_prayers" ADD CONSTRAINT "faith_prayers_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faith_prayers" ADD CONSTRAINT "faith_prayers_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faith_reading_logs" ADD CONSTRAINT "faith_reading_logs_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faith_reading_logs" ADD CONSTRAINT "faith_reading_logs_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faith_texts" ADD CONSTRAINT "faith_texts_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faith_texts" ADD CONSTRAINT "faith_texts_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "faith_entries_member_idx" ON "faith_entries" USING btree ("member_id","faith","date");--> statement-breakpoint
CREATE INDEX "faith_holidays_family_idx" ON "faith_holidays" USING btree ("family_id","faith");--> statement-breakpoint
CREATE UNIQUE INDEX "faith_practice_logs_uq" ON "faith_practice_logs" USING btree ("practice_id","date");--> statement-breakpoint
CREATE INDEX "faith_practice_logs_member_idx" ON "faith_practice_logs" USING btree ("member_id","date");--> statement-breakpoint
CREATE INDEX "faith_practices_member_idx" ON "faith_practices" USING btree ("member_id","faith");--> statement-breakpoint
CREATE INDEX "faith_prayers_family_idx" ON "faith_prayers" USING btree ("family_id","faith");--> statement-breakpoint
CREATE UNIQUE INDEX "faith_reading_logs_uq" ON "faith_reading_logs" USING btree ("member_id","text_key","section");--> statement-breakpoint
CREATE INDEX "faith_reading_logs_date_idx" ON "faith_reading_logs" USING btree ("member_id","read_on");--> statement-breakpoint
CREATE INDEX "faith_texts_member_idx" ON "faith_texts" USING btree ("member_id");