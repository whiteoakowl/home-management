CREATE TABLE IF NOT EXISTS "message_reactions" (
	"message_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_reactions_message_id_member_id_emoji_pk" PRIMARY KEY("message_id","member_id","emoji")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "poll_votes" (
	"message_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"option_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "poll_votes_message_id_member_id_pk" PRIMARY KEY("message_id","member_id")
);--> statement-breakpoint
ALTER TABLE "family_messages" ADD COLUMN IF NOT EXISTS "channel" text DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE "family_messages" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE "family_messages" ADD COLUMN IF NOT EXISTS "event_id" uuid;--> statement-breakpoint
ALTER TABLE "family_messages" ADD COLUMN IF NOT EXISTS "poll" jsonb;--> statement-breakpoint
ALTER TABLE "family_messages" ADD COLUMN IF NOT EXISTS "pinned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "family_messages" ADD COLUMN IF NOT EXISTS "pinned_by_member_id" uuid;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_message_id_family_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."family_messages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_message_id_family_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."family_messages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "family_messages" ADD CONSTRAINT "family_messages_pinned_by_member_id_family_members_id_fk" FOREIGN KEY ("pinned_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "family_messages_channel_idx" ON "family_messages" USING btree ("family_id","channel","created_at");--> statement-breakpoint
ALTER TABLE "message_reactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "poll_votes" ENABLE ROW LEVEL SECURITY;
