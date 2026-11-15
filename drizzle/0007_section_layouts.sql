CREATE TABLE "section_layouts" (
	"member_id" uuid NOT NULL,
	"section" text NOT NULL,
	"widgets" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "section_layouts_member_id_section_pk" PRIMARY KEY("member_id","section")
);
--> statement-breakpoint
ALTER TABLE "section_layouts" ADD CONSTRAINT "section_layouts_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;