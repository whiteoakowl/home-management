ALTER TYPE "public"."entity_type" ADD VALUE 'medical';--> statement-breakpoint
ALTER TYPE "public"."entity_type" ADD VALUE 'pet';--> statement-breakpoint
ALTER TYPE "public"."entity_type" ADD VALUE 'craft_item';--> statement-breakpoint
ALTER TYPE "public"."app_module" ADD VALUE 'medical';--> statement-breakpoint
ALTER TYPE "public"."app_module" ADD VALUE 'pets';--> statement-breakpoint
ALTER TYPE "public"."app_module" ADD VALUE 'witchcraft';--> statement-breakpoint
ALTER TYPE "public"."app_module" ADD VALUE 'maintenance';--> statement-breakpoint
ALTER TYPE "public"."event_source" ADD VALUE 'medical';--> statement-breakpoint
ALTER TYPE "public"."event_source" ADD VALUE 'pet';--> statement-breakpoint
ALTER TYPE "public"."event_source" ADD VALUE 'celebration';--> statement-breakpoint
ALTER TYPE "public"."event_source" ADD VALUE 'maintenance';--> statement-breakpoint
ALTER TYPE "public"."storage_location" ADD VALUE 'pets' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."storage_location" ADD VALUE 'craft' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."storage_location" ADD VALUE 'home' BEFORE 'other';--> statement-breakpoint
CREATE TABLE "allergies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"created_by_member_id" uuid,
	"name" text NOT NULL,
	"type" text DEFAULT 'food' NOT NULL,
	"severity" text DEFAULT 'moderate' NOT NULL,
	"symptoms" text,
	"triggers" text[] DEFAULT '{}' NOT NULL,
	"reactions" text,
	"emergency_instructions" text,
	"physician_notes" text,
	"identified_on" date,
	"file_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "food_restrictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"created_by_member_id" uuid,
	"kind" text DEFAULT 'restriction' NOT NULL,
	"title" text NOT NULL,
	"foods" text[] DEFAULT '{}' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medical_conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"created_by_member_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"diagnosed_on" date,
	"physician" text,
	"symptoms" text,
	"treatment_notes" text,
	"medication_notes" text,
	"follow_up_on" date,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medical_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"created_by_member_id" uuid,
	"title" text NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"file_id" uuid,
	"document_date" date,
	"expires_on" date,
	"condition_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medical_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"created_by_member_id" uuid,
	"full_name" text,
	"blood_type" text,
	"primary_physician" text,
	"dentist" text,
	"specialists" text,
	"emergency_contacts" text,
	"insurance_provider" text,
	"insurance_policy" text,
	"insurance_group" text,
	"insurance_notes" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"created_by_member_id" uuid,
	"name" text NOT NULL,
	"prescriber" text,
	"dosage" text,
	"frequency" text,
	"start_on" date,
	"end_on" date,
	"pharmacy" text,
	"refills_remaining" integer,
	"next_refill_on" date,
	"condition_id" uuid,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pet_care_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pet_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pet_medical_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pet_id" uuid NOT NULL,
	"kind" text DEFAULT 'vet_visit' NOT NULL,
	"title" text NOT NULL,
	"date" date NOT NULL,
	"veterinarian" text,
	"description" text,
	"notes" text,
	"cost_cents" integer,
	"next_due_on" date,
	"file_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pet_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pet_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"caption" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pet_preventatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pet_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"product_name" text NOT NULL,
	"brand" text,
	"last_given_on" date,
	"interval_days" integer DEFAULT 30 NOT NULL,
	"next_due_on" date,
	"assignee_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pet_supplies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pet_id" uuid,
	"inventory_item_id" uuid NOT NULL,
	"kind" text DEFAULT 'food' NOT NULL,
	"brand" text,
	"food_type" text,
	"flavor" text,
	"feeding_instructions" text,
	"feeding_schedule" text,
	"dietary_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"name" text NOT NULL,
	"species" text NOT NULL,
	"breed" text,
	"birthday" date,
	"adopted_on" date,
	"sex" text,
	"color_markings" text,
	"weight" numeric,
	"weight_unit" text,
	"microchip_number" text,
	"microchip_company" text,
	"veterinarian" text,
	"vet_phone" text,
	"emergency_contact" text,
	"personality" text,
	"favorite_things" text,
	"special_characteristics" text,
	"caretaker_member_id" uuid,
	"image_file_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "celebration_links" (
	"celebration_id" uuid NOT NULL,
	"recipe_id" uuid,
	"craft_item_id" uuid,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "celebrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sabbat" text,
	"date" date NOT NULL,
	"guest_list" text,
	"decorations" text,
	"activities" text,
	"ritual_plan" text,
	"supplies" text,
	"budget_cents" integer,
	"notes" text,
	"image_file_id" uuid,
	"calendar_event_id" uuid,
	"shopping_list_id" uuid,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "craft_collection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"acquired_on" date,
	"location" text,
	"status" text DEFAULT 'owned' NOT NULL,
	"photo_file_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "craft_item_images" (
	"item_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	CONSTRAINT "craft_item_images_item_id_file_id_pk" PRIMARY KEY("item_id","file_id")
);
--> statement-breakpoint
CREATE TABLE "craft_item_supplies" (
	"item_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	CONSTRAINT "craft_item_supplies_item_id_inventory_item_id_pk" PRIMARY KEY("item_id","inventory_item_id")
);
--> statement-breakpoint
CREATE TABLE "craft_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"description" text,
	"image_file_id" uuid,
	"emoji" text,
	"moon_phase" text,
	"sabbat" text,
	"plant_id" uuid,
	"fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"source" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"visibility" "visibility" DEFAULT 'family' NOT NULL,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sabbat_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text,
	"month_day" text,
	"notes" text,
	"image_file_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "home_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"repair_id" uuid,
	"project_id" uuid,
	"room_id" uuid,
	"file_id" uuid NOT NULL,
	"kind" text DEFAULT 'progress' NOT NULL,
	"caption" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "home_repairs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"title" text NOT NULL,
	"room_id" uuid,
	"status" text DEFAULT 'open' NOT NULL,
	"reported_on" date NOT NULL,
	"scheduled_on" date,
	"completed_on" date,
	"problem" text,
	"repair_performed" text,
	"contractor" text,
	"cost_cents" integer,
	"materials" text,
	"warranty_info" text,
	"warranty_expires_on" date,
	"notes" text,
	"reported_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"quantity" numeric,
	"unit" text,
	"estimated_cost_cents" integer,
	"store" text,
	"product_info" text,
	"purchased" boolean DEFAULT false NOT NULL,
	"inventory_item_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"due_on" date,
	"done" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "families" ALTER COLUMN "enabled_modules" SET DEFAULT '{"calendar","house","chores","lists","kitchen","meals","recipes","shopping","garden","farm","journal","goals","fitness","budget","reports","medical","pets","witchcraft","maintenance"}';--> statement-breakpoint
ALTER TABLE "chore_occurrences" ADD COLUMN "actual_cost_cents" integer;--> statement-breakpoint
ALTER TABLE "chores" ADD COLUMN "pet_id" uuid;--> statement-breakpoint
ALTER TABLE "chores" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "chores" ADD COLUMN "project_stage_id" uuid;--> statement-breakpoint
ALTER TABLE "chores" ADD COLUMN "estimated_cost_cents" integer;--> statement-breakpoint
ALTER TABLE "chores" ADD COLUMN "image_file_id" uuid;--> statement-breakpoint
ALTER TABLE "home_documents" ADD COLUMN "doc_type" text DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "home_documents" ADD COLUMN "room_id" uuid;--> statement-breakpoint
ALTER TABLE "home_documents" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "home_documents" ADD COLUMN "appliance_name" text;--> statement-breakpoint
ALTER TABLE "home_projects" ADD COLUMN "completed_on" date;--> statement-breakpoint
ALTER TABLE "home_projects" ADD COLUMN "estimated_cost_cents" integer;--> statement-breakpoint
ALTER TABLE "home_projects" ADD COLUMN "cover_file_id" uuid;--> statement-breakpoint
ALTER TABLE "home_projects" ADD COLUMN "contractor" text;--> statement-breakpoint
ALTER TABLE "home_projects" ADD COLUMN "measurements" text;--> statement-breakpoint
ALTER TABLE "home_projects" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "home_projects" ADD COLUMN "shopping_list_id" uuid;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "kind" text DEFAULT 'room' NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "image_file_id" uuid;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "room_id" uuid;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "book" text DEFAULT 'journal' NOT NULL;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "is_favorite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "moon_phase" text;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "linked_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "repair_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "celebration_id" uuid;--> statement-breakpoint
ALTER TABLE "allergies" ADD CONSTRAINT "allergies_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allergies" ADD CONSTRAINT "allergies_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allergies" ADD CONSTRAINT "allergies_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allergies" ADD CONSTRAINT "allergies_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_restrictions" ADD CONSTRAINT "food_restrictions_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_restrictions" ADD CONSTRAINT "food_restrictions_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_restrictions" ADD CONSTRAINT "food_restrictions_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_conditions" ADD CONSTRAINT "medical_conditions_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_conditions" ADD CONSTRAINT "medical_conditions_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_conditions" ADD CONSTRAINT "medical_conditions_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_documents" ADD CONSTRAINT "medical_documents_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_documents" ADD CONSTRAINT "medical_documents_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_documents" ADD CONSTRAINT "medical_documents_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_documents" ADD CONSTRAINT "medical_documents_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_documents" ADD CONSTRAINT "medical_documents_condition_id_medical_conditions_id_fk" FOREIGN KEY ("condition_id") REFERENCES "public"."medical_conditions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_profiles" ADD CONSTRAINT "medical_profiles_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_profiles" ADD CONSTRAINT "medical_profiles_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_profiles" ADD CONSTRAINT "medical_profiles_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medications" ADD CONSTRAINT "medications_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medications" ADD CONSTRAINT "medications_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medications" ADD CONSTRAINT "medications_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medications" ADD CONSTRAINT "medications_condition_id_medical_conditions_id_fk" FOREIGN KEY ("condition_id") REFERENCES "public"."medical_conditions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_care_notes" ADD CONSTRAINT "pet_care_notes_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_medical_records" ADD CONSTRAINT "pet_medical_records_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_medical_records" ADD CONSTRAINT "pet_medical_records_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_photos" ADD CONSTRAINT "pet_photos_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_photos" ADD CONSTRAINT "pet_photos_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_preventatives" ADD CONSTRAINT "pet_preventatives_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_preventatives" ADD CONSTRAINT "pet_preventatives_assignee_id_family_members_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_supplies" ADD CONSTRAINT "pet_supplies_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_supplies" ADD CONSTRAINT "pet_supplies_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pets" ADD CONSTRAINT "pets_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pets" ADD CONSTRAINT "pets_caretaker_member_id_family_members_id_fk" FOREIGN KEY ("caretaker_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pets" ADD CONSTRAINT "pets_image_file_id_files_id_fk" FOREIGN KEY ("image_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "celebration_links" ADD CONSTRAINT "celebration_links_celebration_id_celebrations_id_fk" FOREIGN KEY ("celebration_id") REFERENCES "public"."celebrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "celebration_links" ADD CONSTRAINT "celebration_links_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "celebration_links" ADD CONSTRAINT "celebration_links_craft_item_id_craft_items_id_fk" FOREIGN KEY ("craft_item_id") REFERENCES "public"."craft_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "celebrations" ADD CONSTRAINT "celebrations_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "celebrations" ADD CONSTRAINT "celebrations_image_file_id_files_id_fk" FOREIGN KEY ("image_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "celebrations" ADD CONSTRAINT "celebrations_shopping_list_id_lists_id_fk" FOREIGN KEY ("shopping_list_id") REFERENCES "public"."lists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "celebrations" ADD CONSTRAINT "celebrations_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "craft_collection" ADD CONSTRAINT "craft_collection_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "craft_collection" ADD CONSTRAINT "craft_collection_item_id_craft_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."craft_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "craft_collection" ADD CONSTRAINT "craft_collection_photo_file_id_files_id_fk" FOREIGN KEY ("photo_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "craft_item_images" ADD CONSTRAINT "craft_item_images_item_id_craft_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."craft_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "craft_item_images" ADD CONSTRAINT "craft_item_images_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "craft_item_images" ADD CONSTRAINT "craft_item_images_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "craft_item_supplies" ADD CONSTRAINT "craft_item_supplies_item_id_craft_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."craft_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "craft_item_supplies" ADD CONSTRAINT "craft_item_supplies_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "craft_items" ADD CONSTRAINT "craft_items_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "craft_items" ADD CONSTRAINT "craft_items_image_file_id_files_id_fk" FOREIGN KEY ("image_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "craft_items" ADD CONSTRAINT "craft_items_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "craft_items" ADD CONSTRAINT "craft_items_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sabbat_settings" ADD CONSTRAINT "sabbat_settings_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sabbat_settings" ADD CONSTRAINT "sabbat_settings_image_file_id_files_id_fk" FOREIGN KEY ("image_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_photos" ADD CONSTRAINT "home_photos_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_photos" ADD CONSTRAINT "home_photos_repair_id_home_repairs_id_fk" FOREIGN KEY ("repair_id") REFERENCES "public"."home_repairs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_photos" ADD CONSTRAINT "home_photos_project_id_home_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."home_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_photos" ADD CONSTRAINT "home_photos_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_photos" ADD CONSTRAINT "home_photos_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_repairs" ADD CONSTRAINT "home_repairs_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_repairs" ADD CONSTRAINT "home_repairs_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_repairs" ADD CONSTRAINT "home_repairs_reported_by_member_id_family_members_id_fk" FOREIGN KEY ("reported_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_materials" ADD CONSTRAINT "project_materials_project_id_home_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."home_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_materials" ADD CONSTRAINT "project_materials_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_stages" ADD CONSTRAINT "project_stages_project_id_home_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."home_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "allergies_member_idx" ON "allergies" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "food_restrictions_member_idx" ON "food_restrictions" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "conditions_member_idx" ON "medical_conditions" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "medical_docs_member_idx" ON "medical_documents" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "medical_profile_member_uq" ON "medical_profiles" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "medications_member_idx" ON "medications" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "pet_care_pet_idx" ON "pet_care_notes" USING btree ("pet_id");--> statement-breakpoint
CREATE INDEX "pet_medical_pet_idx" ON "pet_medical_records" USING btree ("pet_id","date");--> statement-breakpoint
CREATE INDEX "pet_photos_pet_idx" ON "pet_photos" USING btree ("pet_id");--> statement-breakpoint
CREATE INDEX "pet_prev_pet_idx" ON "pet_preventatives" USING btree ("pet_id");--> statement-breakpoint
CREATE INDEX "pet_supplies_pet_idx" ON "pet_supplies" USING btree ("pet_id");--> statement-breakpoint
CREATE INDEX "pets_family_idx" ON "pets" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "celebration_links_idx" ON "celebration_links" USING btree ("celebration_id");--> statement-breakpoint
CREATE INDEX "celebrations_family_idx" ON "celebrations" USING btree ("family_id","date");--> statement-breakpoint
CREATE INDEX "craft_collection_family_idx" ON "craft_collection" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "craft_items_family_kind_idx" ON "craft_items" USING btree ("family_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "sabbat_settings_family_key_uq" ON "sabbat_settings" USING btree ("family_id","key");--> statement-breakpoint
CREATE INDEX "home_photos_repair_idx" ON "home_photos" USING btree ("repair_id");--> statement-breakpoint
CREATE INDEX "home_photos_project_idx" ON "home_photos" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "repairs_family_idx" ON "home_repairs" USING btree ("family_id","reported_on");--> statement-breakpoint
CREATE INDEX "project_materials_idx" ON "project_materials" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_stages_idx" ON "project_stages" USING btree ("project_id");--> statement-breakpoint
ALTER TABLE "home_documents" ADD CONSTRAINT "home_documents_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_documents" ADD CONSTRAINT "home_documents_project_id_home_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."home_projects"("id") ON DELETE set null ON UPDATE no action;