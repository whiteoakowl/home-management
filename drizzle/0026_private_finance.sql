ALTER TABLE "categories" ADD COLUMN "owner_member_id" uuid;--> statement-breakpoint
ALTER TABLE "family_members" ADD COLUMN "private_finance" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_limits" ADD COLUMN "owner_member_id" uuid;--> statement-breakpoint
ALTER TABLE "income_sources" ADD COLUMN "owner_member_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "owner_member_id" uuid;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_owner_member_id_family_members_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_limits" ADD CONSTRAINT "budget_limits_owner_member_id_family_members_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_sources" ADD CONSTRAINT "income_sources_owner_member_id_family_members_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_owner_member_id_family_members_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;