ALTER TYPE "public"."visibility" ADD VALUE 'parents';--> statement-breakpoint
ALTER TABLE "list_items" ADD COLUMN "personal_for_member_id" uuid;--> statement-breakpoint
ALTER TABLE "list_items" ADD COLUMN "added_by_member_id" uuid;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "owner_member_id" uuid;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_personal_for_member_id_family_members_id_fk" FOREIGN KEY ("personal_for_member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_added_by_member_id_family_members_id_fk" FOREIGN KEY ("added_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_owner_member_id_family_members_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "books_owner_idx" ON "books" USING btree ("owner_member_id");