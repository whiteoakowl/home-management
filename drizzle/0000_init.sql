CREATE TYPE "public"."access_level" AS ENUM('none', 'view', 'edit');--> statement-breakpoint
CREATE TYPE "public"."category_domain" AS ENUM('chore', 'calendar', 'budget', 'list', 'garden', 'farm', 'recipe', 'household', 'inventory');--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('event', 'list', 'journal_entry', 'document', 'goal', 'household_info', 'announcement');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('parent', 'member');--> statement-breakpoint
CREATE TYPE "public"."app_module" AS ENUM('calendar', 'house', 'chores', 'lists', 'kitchen', 'meals', 'recipes', 'shopping', 'garden', 'farm', 'journal', 'goals', 'fitness', 'budget', 'reports');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('family', 'private', 'selected');--> statement-breakpoint
CREATE TYPE "public"."chore_kind" AS ENUM('chore', 'cleaning', 'maintenance', 'task');--> statement-breakpoint
CREATE TYPE "public"."cleaning_cadence" AS ENUM('daily', 'weekly', 'monthly', 'seasonal', 'biannual', 'annual', 'custom');--> statement-breakpoint
CREATE TYPE "public"."occurrence_status" AS ENUM('pending', 'done', 'skipped', 'missed');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('low', 'normal', 'high');--> statement-breakpoint
CREATE TYPE "public"."recurrence_freq" AS ENUM('daily', 'weekly', 'monthly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."event_source" AS ENUM('manual', 'chore', 'workout', 'meal', 'garden', 'farm');--> statement-breakpoint
CREATE TYPE "public"."list_item_source" AS ENUM('manual', 'recipe', 'meal_plan', 'low_stock');--> statement-breakpoint
CREATE TYPE "public"."list_kind" AS ENUM('checklist', 'bullet', 'numbered', 'todo', 'shopping');--> statement-breakpoint
CREATE TYPE "public"."shopping_category" AS ENUM('produce', 'meat', 'dairy', 'pantry', 'frozen', 'household', 'personal', 'garden', 'farm', 'other');--> statement-breakpoint
CREATE TYPE "public"."inventory_event_kind" AS ENUM('added', 'used', 'discarded', 'donated', 'replaced', 'adjusted');--> statement-breakpoint
CREATE TYPE "public"."inventory_source" AS ENUM('manual', 'barcode', 'shopping', 'garden_harvest', 'farm_production', 'recipe');--> statement-breakpoint
CREATE TYPE "public"."storage_location" AS ENUM('pantry', 'fridge', 'freezer', 'supplies', 'farm', 'garden', 'other');--> statement-breakpoint
CREATE TYPE "public"."meal_slot" AS ENUM('breakfast', 'lunch', 'dinner', 'snack');--> statement-breakpoint
CREATE TYPE "public"."garden_log_kind" AS ENUM('sown', 'germinated', 'transplanted', 'watered', 'fertilized', 'pest', 'disease', 'harvest', 'seed_saved', 'note');--> statement-breakpoint
CREATE TYPE "public"."planting_status" AS ENUM('planned', 'sown', 'growing', 'harvesting', 'finished', 'failed');--> statement-breakpoint
CREATE TYPE "public"."sun_requirement" AS ENUM('full_sun', 'partial_sun', 'partial_shade', 'full_shade');--> statement-breakpoint
CREATE TYPE "public"."animal_sex" AS ENUM('female', 'male', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."animal_status" AS ENUM('active', 'sold', 'deceased', 'processed');--> statement-breakpoint
CREATE TYPE "public"."production_kind" AS ENUM('eggs', 'milk', 'meat', 'honey', 'wool', 'produce', 'other');--> statement-breakpoint
CREATE TYPE "public"."goal_horizon" AS ENUM('6m', '1y', '5y', '10y', '20y', 'custom');--> statement-breakpoint
CREATE TYPE "public"."goal_kind" AS ENUM('savings', 'fitness', 'personal', 'family');--> statement-breakpoint
CREATE TYPE "public"."goal_status" AS ENUM('active', 'achieved', 'paused', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."income_frequency" AS ENUM('weekly', 'biweekly', 'semimonthly', 'monthly', 'quarterly', 'annually', 'one_time');--> statement-breakpoint
CREATE TYPE "public"."transaction_kind" AS ENUM('expense', 'income', 'savings_transfer');--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"actor_member_id" uuid,
	"verb" text NOT NULL,
	"module" "app_module",
	"entity_id" uuid,
	"summary" text NOT NULL,
	"visible_to_member_ids" uuid[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"author_member_id" uuid,
	"body" text NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"visibility" "visibility" DEFAULT 'family' NOT NULL,
	"expires_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"domain" "category_domain" NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboard_layouts" (
	"member_id" uuid PRIMARY KEY NOT NULL,
	"widgets" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"image_file_id" uuid,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"location_name" text,
	"latitude" double precision,
	"longitude" double precision,
	"owner_member_id" uuid,
	"onboarding_step" integer DEFAULT 1 NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"enabled_modules" text[] DEFAULT '{"calendar","house","chores","lists","kitchen","meals","recipes","shopping","garden","farm","journal","goals","fitness","budget","reports"}' NOT NULL,
	"theme" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"user_id" uuid,
	"display_name" text NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"color" text DEFAULT 'plum' NOT NULL,
	"avatar_file_id" uuid,
	"birthday" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"uploaded_by_member_id" uuid,
	"storage_key" text NOT NULL,
	"thumbnail_key" text,
	"original_name" text,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_permissions" (
	"member_id" uuid NOT NULL,
	"module" "app_module" NOT NULL,
	"level" "access_level" NOT NULL,
	CONSTRAINT "member_permissions_member_id_module_pk" PRIMARY KEY("member_id","module")
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"member_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"in_app" boolean DEFAULT true NOT NULL,
	"email" boolean DEFAULT false NOT NULL,
	"push" boolean DEFAULT false NOT NULL,
	CONSTRAINT "notification_preferences_member_id_kind_pk" PRIMARY KEY("member_id","kind")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"href" text,
	"read_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "record_access" (
	"family_id" uuid NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"can_edit" boolean DEFAULT false NOT NULL,
	CONSTRAINT "record_access_entity_type_entity_id_member_id_pk" PRIMARY KEY("entity_type","entity_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "chore_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chore_id" uuid NOT NULL,
	"text" text NOT NULL,
	"assignee_id" uuid,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chore_occurrence_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurrence_id" uuid NOT NULL,
	"checklist_item_id" uuid,
	"text" text NOT NULL,
	"assignee_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"completed_by_member_id" uuid
);
--> statement-breakpoint
CREATE TABLE "chore_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"chore_id" uuid NOT NULL,
	"due_date" date NOT NULL,
	"assignee_id" uuid,
	"status" "occurrence_status" DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp with time zone,
	"completed_by_member_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"kind" "chore_kind" DEFAULT 'chore' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"instructions" text,
	"room_id" uuid,
	"category_id" uuid,
	"cleaning_cadence" "cleaning_cadence",
	"priority" "priority" DEFAULT 'normal' NOT NULL,
	"estimated_minutes" integer,
	"default_assignee_id" uuid,
	"recurrence_rule_id" uuid,
	"due_date" date,
	"notes" text,
	"points" integer,
	"archived_at" timestamp with time zone,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "home_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"title" text NOT NULL,
	"category_id" uuid,
	"file_id" uuid,
	"notes" text,
	"expires_on" date,
	"visibility" "visibility" DEFAULT 'family' NOT NULL,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "home_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'planned' NOT NULL,
	"room_id" uuid,
	"budget_cents" integer,
	"start_date" date,
	"target_date" date,
	"owner_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_info" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"category_id" uuid,
	"visibility" "visibility" DEFAULT 'family' NOT NULL,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurrence_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"freq" "recurrence_freq" NOT NULL,
	"interval" smallint DEFAULT 1 NOT NULL,
	"by_weekday" smallint[],
	"by_month_day" smallint[],
	"by_month" smallint[],
	"starts_on" date NOT NULL,
	"until" date,
	"count" integer,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"location" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"all_day" boolean DEFAULT false NOT NULL,
	"category_id" uuid,
	"color" text,
	"recurrence_rule_id" uuid,
	"reminder_minutes" integer,
	"notes" text,
	"visibility" "visibility" DEFAULT 'family' NOT NULL,
	"source" "event_source" DEFAULT 'manual' NOT NULL,
	"source_id" uuid,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_attachments" (
	"event_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	CONSTRAINT "event_attachments_event_id_file_id_pk" PRIMARY KEY("event_id","file_id")
);
--> statement-breakpoint
CREATE TABLE "event_attendees" (
	"event_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	CONSTRAINT "event_attendees_event_id_member_id_pk" PRIMARY KEY("event_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"text" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"checked" boolean DEFAULT false NOT NULL,
	"checked_at" timestamp with time zone,
	"checked_by_member_id" uuid,
	"due_date" date,
	"priority" "priority",
	"assignee_id" uuid,
	"recurrence_rule_id" uuid,
	"quantity" numeric,
	"unit" text,
	"shopping_category" "shopping_category",
	"store" text,
	"source" "list_item_source" DEFAULT 'manual' NOT NULL,
	"source_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"title" text NOT NULL,
	"kind" "list_kind" DEFAULT 'checklist' NOT NULL,
	"category_id" uuid,
	"store" text,
	"visibility" "visibility" DEFAULT 'family' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"kind" "inventory_event_kind" NOT NULL,
	"quantity_delta" numeric NOT NULL,
	"source" "inventory_source" DEFAULT 'manual' NOT NULL,
	"source_id" uuid,
	"member_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"product_id" uuid,
	"name" text NOT NULL,
	"quantity" numeric DEFAULT '1' NOT NULL,
	"unit" text,
	"location" "storage_location" DEFAULT 'pantry' NOT NULL,
	"spot" text,
	"category_id" uuid,
	"purchased_on" date,
	"expires_on" date,
	"low_stock_threshold" numeric,
	"image_file_id" uuid,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"barcode" text,
	"name" text NOT NULL,
	"brand" text,
	"default_unit" text,
	"default_location" "storage_location",
	"image_url" text,
	"lookup_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "food_journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"date" date NOT NULL,
	"slot" "meal_slot" NOT NULL,
	"food" text NOT NULL,
	"notes" text,
	"image_file_id" uuid,
	"meal_plan_entry_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_plan_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"date" date NOT NULL,
	"slot" "meal_slot" NOT NULL,
	"recipe_id" uuid,
	"title" text,
	"servings" integer,
	"notes" text,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_collection_items" (
	"collection_id" uuid NOT NULL,
	"recipe_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "recipe_collection_items_collection_id_recipe_id_pk" PRIMARY KEY("collection_id","recipe_id")
);
--> statement-breakpoint
CREATE TABLE "recipe_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"name" text NOT NULL,
	"original" text,
	"quantity" numeric,
	"unit" text,
	"optional" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_ratings" (
	"recipe_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	CONSTRAINT "recipe_ratings_recipe_id_member_id_pk" PRIMARY KEY("recipe_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"image_file_id" uuid,
	"instructions" text[] DEFAULT '{}' NOT NULL,
	"prep_minutes" integer,
	"cook_minutes" integer,
	"servings" integer,
	"category_id" uuid,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"notes" text,
	"source" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "garden_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"planting_id" uuid,
	"plant_id" uuid,
	"kind" "garden_log_kind" NOT NULL,
	"date" date NOT NULL,
	"quantity" numeric,
	"unit" text,
	"notes" text,
	"photo_file_id" uuid,
	"member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "garden_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"name" text NOT NULL,
	"year" integer,
	"layout" jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "garden_plantings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"plan_id" uuid,
	"bed_key" text,
	"plant_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"x" numeric,
	"y" numeric,
	"status" "planting_status" DEFAULT 'planned' NOT NULL,
	"planned_on" date,
	"planted_on" date,
	"expected_harvest_on" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid,
	"name" text NOT NULL,
	"variety" text,
	"category" text,
	"image_url" text,
	"image_file_id" uuid,
	"growing_zones" text,
	"sun" "sun_requirement",
	"soil" text,
	"water" text,
	"planting_depth_in" numeric,
	"spacing_in" numeric,
	"germination_days" text,
	"days_to_maturity" text,
	"companion_plants" text[] DEFAULT '{}' NOT NULL,
	"avoid_plants" text[] DEFAULT '{}' NOT NULL,
	"planting_window" text,
	"harvest_window" text,
	"soil_amendments" text,
	"fertilizer" text,
	"seed_info" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seed_inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"plant_id" uuid,
	"name" text NOT NULL,
	"quantity" text,
	"source" text,
	"packed_for" text,
	"purchased_on" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "animal_health_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"animal_id" uuid NOT NULL,
	"date" date NOT NULL,
	"kind" text NOT NULL,
	"description" text,
	"next_due_on" date,
	"cost_cents" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "animals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"name" text NOT NULL,
	"species" text NOT NULL,
	"breed" text,
	"sex" "animal_sex" DEFAULT 'unknown' NOT NULL,
	"group_name" text,
	"head_count" integer DEFAULT 1 NOT NULL,
	"birth_date" date,
	"acquired_on" date,
	"image_file_id" uuid,
	"feed" text,
	"status" "animal_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farm_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"name" text NOT NULL,
	"layout" jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"animal_id" uuid,
	"group_name" text,
	"date" date NOT NULL,
	"feed" text NOT NULL,
	"quantity" numeric NOT NULL,
	"unit" text NOT NULL,
	"cost_cents" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"animal_id" uuid,
	"group_name" text,
	"kind" "production_kind" NOT NULL,
	"date" date NOT NULL,
	"quantity" numeric NOT NULL,
	"unit" text NOT NULL,
	"notes" text,
	"inventory_item_id" uuid,
	"member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "body_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"date" date NOT NULL,
	"metric" text NOT NULL,
	"value" numeric NOT NULL,
	"unit" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fitness_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"starts_on" date,
	"ends_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"date" date NOT NULL,
	"amount_cents" integer,
	"value" numeric,
	"transaction_id" uuid,
	"notes" text,
	"member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"title" text NOT NULL,
	"target_cents" integer,
	"target_value" numeric,
	"due_on" date,
	"achieved_at" timestamp with time zone,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"owner_member_id" uuid,
	"kind" "goal_kind" NOT NULL,
	"horizon" "goal_horizon" DEFAULT '1y' NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"target_cents" integer,
	"current_cents" integer DEFAULT 0 NOT NULL,
	"monthly_contribution_cents" integer,
	"target_value" numeric,
	"current_value" numeric,
	"unit" text,
	"target_date" date,
	"status" "goal_status" DEFAULT 'active' NOT NULL,
	"visibility" "visibility" DEFAULT 'family' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"author_member_id" uuid NOT NULL,
	"date" date NOT NULL,
	"title" text,
	"body" text NOT NULL,
	"mood" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entry_files" (
	"entry_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "journal_entry_files_entry_id_file_id_pk" PRIMARY KEY("entry_id","file_id")
);
--> statement-breakpoint
CREATE TABLE "journal_entry_members" (
	"entry_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	CONSTRAINT "journal_entry_members_entry_id_member_id_pk" PRIMARY KEY("entry_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "personal_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"exercise" text NOT NULL,
	"value" numeric NOT NULL,
	"unit" text NOT NULL,
	"achieved_on" date NOT NULL,
	"workout_log_id" uuid
);
--> statement-breakpoint
CREATE TABLE "workout_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workout_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sets" smallint,
	"reps" smallint,
	"duration_seconds" integer,
	"distance" numeric,
	"distance_unit" text,
	"video_url" text,
	"notes" text,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_log_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"log_id" uuid NOT NULL,
	"exercise" text NOT NULL,
	"set_number" smallint NOT NULL,
	"reps" smallint,
	"weight" numeric,
	"weight_unit" text,
	"duration_seconds" integer
);
--> statement-breakpoint
CREATE TABLE "workout_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"workout_id" uuid,
	"date" date NOT NULL,
	"title" text NOT NULL,
	"duration_minutes" integer,
	"distance" numeric,
	"distance_unit" text,
	"effort" smallint,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"name" text NOT NULL,
	"focus" text,
	"recurrence_rule_id" uuid,
	"notes" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"monthly_cents" integer NOT NULL,
	"is_bill" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "income_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"frequency" "income_frequency" NOT NULL,
	"member_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"kind" "transaction_kind" NOT NULL,
	"name" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"date" date NOT NULL,
	"category_id" uuid,
	"income_source_id" uuid,
	"goal_id" uuid,
	"shopping_list_id" uuid,
	"recurrence_rule_id" uuid,
	"member_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actor_member_id_family_members_id_fk" FOREIGN KEY ("actor_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_member_id_family_members_id_fk" FOREIGN KEY ("author_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_member_id_family_members_id_fk" FOREIGN KEY ("uploaded_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_permissions" ADD CONSTRAINT "member_permissions_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_access" ADD CONSTRAINT "record_access_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_access" ADD CONSTRAINT "record_access_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_checklist_items" ADD CONSTRAINT "chore_checklist_items_chore_id_chores_id_fk" FOREIGN KEY ("chore_id") REFERENCES "public"."chores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_checklist_items" ADD CONSTRAINT "chore_checklist_items_assignee_id_family_members_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_occurrence_items" ADD CONSTRAINT "chore_occurrence_items_occurrence_id_chore_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."chore_occurrences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_occurrence_items" ADD CONSTRAINT "chore_occurrence_items_checklist_item_id_chore_checklist_items_id_fk" FOREIGN KEY ("checklist_item_id") REFERENCES "public"."chore_checklist_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_occurrence_items" ADD CONSTRAINT "chore_occurrence_items_assignee_id_family_members_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_occurrence_items" ADD CONSTRAINT "chore_occurrence_items_completed_by_member_id_family_members_id_fk" FOREIGN KEY ("completed_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_occurrences" ADD CONSTRAINT "chore_occurrences_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_occurrences" ADD CONSTRAINT "chore_occurrences_chore_id_chores_id_fk" FOREIGN KEY ("chore_id") REFERENCES "public"."chores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_occurrences" ADD CONSTRAINT "chore_occurrences_assignee_id_family_members_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_occurrences" ADD CONSTRAINT "chore_occurrences_completed_by_member_id_family_members_id_fk" FOREIGN KEY ("completed_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chores" ADD CONSTRAINT "chores_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chores" ADD CONSTRAINT "chores_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chores" ADD CONSTRAINT "chores_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chores" ADD CONSTRAINT "chores_default_assignee_id_family_members_id_fk" FOREIGN KEY ("default_assignee_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chores" ADD CONSTRAINT "chores_recurrence_rule_id_recurrence_rules_id_fk" FOREIGN KEY ("recurrence_rule_id") REFERENCES "public"."recurrence_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chores" ADD CONSTRAINT "chores_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_documents" ADD CONSTRAINT "home_documents_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_documents" ADD CONSTRAINT "home_documents_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_documents" ADD CONSTRAINT "home_documents_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_documents" ADD CONSTRAINT "home_documents_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_projects" ADD CONSTRAINT "home_projects_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_projects" ADD CONSTRAINT "home_projects_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_projects" ADD CONSTRAINT "home_projects_owner_member_id_family_members_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_info" ADD CONSTRAINT "household_info_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_info" ADD CONSTRAINT "household_info_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_info" ADD CONSTRAINT "household_info_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_recurrence_rule_id_recurrence_rules_id_fk" FOREIGN KEY ("recurrence_rule_id") REFERENCES "public"."recurrence_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attachments" ADD CONSTRAINT "event_attachments_event_id_calendar_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attachments" ADD CONSTRAINT "event_attachments_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_event_id_calendar_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_checked_by_member_id_family_members_id_fk" FOREIGN KEY ("checked_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_assignee_id_family_members_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_recurrence_rule_id_recurrence_rules_id_fk" FOREIGN KEY ("recurrence_rule_id") REFERENCES "public"."recurrence_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lists" ADD CONSTRAINT "lists_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lists" ADD CONSTRAINT "lists_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lists" ADD CONSTRAINT "lists_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_events" ADD CONSTRAINT "inventory_events_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_events" ADD CONSTRAINT "inventory_events_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_events" ADD CONSTRAINT "inventory_events_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_image_file_id_files_id_fk" FOREIGN KEY ("image_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_journal_entries" ADD CONSTRAINT "food_journal_entries_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_journal_entries" ADD CONSTRAINT "food_journal_entries_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_journal_entries" ADD CONSTRAINT "food_journal_entries_image_file_id_files_id_fk" FOREIGN KEY ("image_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_journal_entries" ADD CONSTRAINT "food_journal_entries_meal_plan_entry_id_meal_plan_entries_id_fk" FOREIGN KEY ("meal_plan_entry_id") REFERENCES "public"."meal_plan_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "meal_plan_entries_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "meal_plan_entries_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "meal_plan_entries_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_collection_items" ADD CONSTRAINT "recipe_collection_items_collection_id_recipe_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."recipe_collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_collection_items" ADD CONSTRAINT "recipe_collection_items_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_collections" ADD CONSTRAINT "recipe_collections_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ratings" ADD CONSTRAINT "recipe_ratings_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ratings" ADD CONSTRAINT "recipe_ratings_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_image_file_id_files_id_fk" FOREIGN KEY ("image_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_created_by_member_id_family_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garden_logs" ADD CONSTRAINT "garden_logs_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garden_logs" ADD CONSTRAINT "garden_logs_planting_id_garden_plantings_id_fk" FOREIGN KEY ("planting_id") REFERENCES "public"."garden_plantings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garden_logs" ADD CONSTRAINT "garden_logs_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garden_logs" ADD CONSTRAINT "garden_logs_photo_file_id_files_id_fk" FOREIGN KEY ("photo_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garden_logs" ADD CONSTRAINT "garden_logs_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garden_plans" ADD CONSTRAINT "garden_plans_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garden_plantings" ADD CONSTRAINT "garden_plantings_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garden_plantings" ADD CONSTRAINT "garden_plantings_plan_id_garden_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."garden_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garden_plantings" ADD CONSTRAINT "garden_plantings_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plants" ADD CONSTRAINT "plants_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plants" ADD CONSTRAINT "plants_image_file_id_files_id_fk" FOREIGN KEY ("image_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seed_inventory" ADD CONSTRAINT "seed_inventory_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seed_inventory" ADD CONSTRAINT "seed_inventory_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animal_health_records" ADD CONSTRAINT "animal_health_records_animal_id_animals_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_image_file_id_files_id_fk" FOREIGN KEY ("image_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_plans" ADD CONSTRAINT "farm_plans_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_logs" ADD CONSTRAINT "feed_logs_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_logs" ADD CONSTRAINT "feed_logs_animal_id_animals_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_animal_id_animals_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "body_metrics" ADD CONSTRAINT "body_metrics_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitness_plans" ADD CONSTRAINT "fitness_plans_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitness_plans" ADD CONSTRAINT "fitness_plans_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_milestones" ADD CONSTRAINT "goal_milestones_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_owner_member_id_family_members_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_author_member_id_family_members_id_fk" FOREIGN KEY ("author_member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_files" ADD CONSTRAINT "journal_entry_files_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_files" ADD CONSTRAINT "journal_entry_files_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_members" ADD CONSTRAINT "journal_entry_members_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_members" ADD CONSTRAINT "journal_entry_members_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_workout_log_id_workout_logs_id_fk" FOREIGN KEY ("workout_log_id") REFERENCES "public"."workout_logs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_log_sets" ADD CONSTRAINT "workout_log_sets_log_id_workout_logs_id_fk" FOREIGN KEY ("log_id") REFERENCES "public"."workout_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_plan_id_fitness_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."fitness_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_recurrence_rule_id_recurrence_rules_id_fk" FOREIGN KEY ("recurrence_rule_id") REFERENCES "public"."recurrence_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_limits" ADD CONSTRAINT "budget_limits_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_limits" ADD CONSTRAINT "budget_limits_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_sources" ADD CONSTRAINT "income_sources_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_sources" ADD CONSTRAINT "income_sources_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_income_source_id_income_sources_id_fk" FOREIGN KEY ("income_source_id") REFERENCES "public"."income_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_shopping_list_id_lists_id_fk" FOREIGN KEY ("shopping_list_id") REFERENCES "public"."lists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurrence_rule_id_recurrence_rules_id_fk" FOREIGN KEY ("recurrence_rule_id") REFERENCES "public"."recurrence_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_family_idx" ON "activity_log" USING btree ("family_id","created_at");--> statement-breakpoint
CREATE INDEX "announcements_family_idx" ON "announcements" USING btree ("family_id","created_at");--> statement-breakpoint
CREATE INDEX "categories_family_domain_idx" ON "categories" USING btree ("family_id","domain");--> statement-breakpoint
CREATE INDEX "members_family_idx" ON "family_members" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "members_family_user_uq" ON "family_members" USING btree ("family_id","user_id");--> statement-breakpoint
CREATE INDEX "files_family_idx" ON "files" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "notifications_member_idx" ON "notifications" USING btree ("member_id","read_at");--> statement-breakpoint
CREATE INDEX "record_access_member_idx" ON "record_access" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chore_items_chore_idx" ON "chore_checklist_items" USING btree ("chore_id");--> statement-breakpoint
CREATE INDEX "occ_items_occurrence_idx" ON "chore_occurrence_items" USING btree ("occurrence_id");--> statement-breakpoint
CREATE UNIQUE INDEX "occurrence_chore_date_uq" ON "chore_occurrences" USING btree ("chore_id","due_date");--> statement-breakpoint
CREATE INDEX "occurrence_family_due_idx" ON "chore_occurrences" USING btree ("family_id","due_date");--> statement-breakpoint
CREATE INDEX "occurrence_assignee_idx" ON "chore_occurrences" USING btree ("assignee_id","status");--> statement-breakpoint
CREATE INDEX "chores_family_kind_idx" ON "chores" USING btree ("family_id","kind");--> statement-breakpoint
CREATE INDEX "documents_family_idx" ON "home_documents" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "projects_family_idx" ON "home_projects" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "household_info_family_idx" ON "household_info" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "rooms_family_idx" ON "rooms" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "events_family_start_idx" ON "calendar_events" USING btree ("family_id","starts_at");--> statement-breakpoint
CREATE INDEX "list_items_list_idx" ON "list_items" USING btree ("list_id","position");--> statement-breakpoint
CREATE INDEX "lists_family_kind_idx" ON "lists" USING btree ("family_id","kind");--> statement-breakpoint
CREATE INDEX "inventory_events_item_idx" ON "inventory_events" USING btree ("item_id","created_at");--> statement-breakpoint
CREATE INDEX "inventory_family_location_idx" ON "inventory_items" USING btree ("family_id","location");--> statement-breakpoint
CREATE INDEX "inventory_family_expires_idx" ON "inventory_items" USING btree ("family_id","expires_on");--> statement-breakpoint
CREATE UNIQUE INDEX "products_family_barcode_uq" ON "products" USING btree ("family_id","barcode");--> statement-breakpoint
CREATE INDEX "food_journal_member_date_idx" ON "food_journal_entries" USING btree ("member_id","date");--> statement-breakpoint
CREATE INDEX "meal_plan_family_date_idx" ON "meal_plan_entries" USING btree ("family_id","date");--> statement-breakpoint
CREATE INDEX "ingredients_recipe_idx" ON "recipe_ingredients" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipes_family_idx" ON "recipes" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "garden_logs_family_date_idx" ON "garden_logs" USING btree ("family_id","date");--> statement-breakpoint
CREATE INDEX "garden_plans_family_idx" ON "garden_plans" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "plantings_plan_idx" ON "garden_plantings" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "plants_family_idx" ON "plants" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "health_animal_idx" ON "animal_health_records" USING btree ("animal_id","date");--> statement-breakpoint
CREATE INDEX "animals_family_idx" ON "animals" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "farm_plans_family_idx" ON "farm_plans" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "feed_family_date_idx" ON "feed_logs" USING btree ("family_id","date");--> statement-breakpoint
CREATE INDEX "production_family_date_idx" ON "production_logs" USING btree ("family_id","kind","date");--> statement-breakpoint
CREATE INDEX "body_metrics_member_idx" ON "body_metrics" USING btree ("member_id","metric","date");--> statement-breakpoint
CREATE INDEX "fitness_plans_member_idx" ON "fitness_plans" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "contributions_goal_idx" ON "goal_contributions" USING btree ("goal_id","date");--> statement-breakpoint
CREATE INDEX "goals_family_idx" ON "goals" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "journal_family_date_idx" ON "journal_entries" USING btree ("family_id","date");--> statement-breakpoint
CREATE INDEX "workout_logs_member_date_idx" ON "workout_logs" USING btree ("member_id","date");--> statement-breakpoint
CREATE INDEX "income_family_idx" ON "income_sources" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "transactions_family_date_idx" ON "transactions" USING btree ("family_id","date");