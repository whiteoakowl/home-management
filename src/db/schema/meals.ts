import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { categories, families, familyMembers, files } from "./core";

export const mealSlot = pgEnum("meal_slot", ["breakfast", "lunch", "dinner", "snack"]);

export const recipes = pgTable(
  "recipes",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    imageFileId: uuid("image_file_id").references(() => files.id, { onDelete: "set null" }),
    /** Ordered steps. */
    instructions: text("instructions").array().notNull().default([]),
    prepMinutes: integer("prep_minutes"),
    cookMinutes: integer("cook_minutes"),
    /** Total time as written in the recipe (when it differs from prep + cook, or is all that's given). */
    totalMinutes: integer("total_minutes"),
    servings: integer("servings"),
    /** As written, e.g. "35-40 minutes" or "1 hr 15 min". prep/cookMinutes hold the longest time for planning and sorting. */
    prepTime: text("prep_time"),
    cookTime: text("cook_time"),
    /** e.g. "350°F" or "Medium-high heat". */
    temperature: text("temperature"),
    /** Whose recipe it is, e.g. "Grandma Rose". */
    recipeBy: text("recipe_by"),
    /** When the family started making it: a year or a date, e.g. "1985" or "Christmas 1992". */
    makingSince: text("making_since"),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    tags: text("tags").array().notNull().default([]),
    notes: text("notes"),
    source: text("source"),
    isFavorite: boolean("is_favorite").notNull().default(false),
    /** Set = in this member's private food space (My Pantry etc.); null = the family's. */
    ownerMemberId: uuid("owner_member_id").references(() => familyMembers.id, { onDelete: "cascade" }),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [index("recipes_family_idx").on(t.familyId)],
);

export const recipeIngredients = pgTable(
  "recipe_ingredients",
  {
    id: id(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    /** Normalised name used to match inventory, e.g. "egg". */
    name: text("name").notNull(),
    /** Ingredient group title, e.g. "Batter" or "Glaze" (null = no section). */
    section: text("section"),
    /** Original line as written, e.g. "2 large eggs, beaten". */
    original: text("original"),
    quantity: numeric("quantity"),
    unit: text("unit"),
    optional: boolean("optional").notNull().default(false),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("ingredients_recipe_idx").on(t.recipeId)],
);

export const recipeCollections = pgTable("recipe_collections", {
  id: id(),
  familyId: uuid("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  /** Set = in this member's private food space (My Pantry etc.); null = the family's. */
  ownerMemberId: uuid("owner_member_id").references(() => familyMembers.id, { onDelete: "cascade" }),
  ...timestamps,
});

export const recipeCollectionItems = pgTable(
  "recipe_collection_items",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => recipeCollections.id, { onDelete: "cascade" }),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.recipeId] })],
);

export const recipeRatings = pgTable(
  "recipe_ratings",
  {
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    rating: smallint("rating").notNull(),
  },
  (t) => [primaryKey({ columns: [t.recipeId, t.memberId] })],
);

export const mealPlanEntries = pgTable(
  "meal_plan_entries",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    slot: mealSlot("slot").notNull(),
    recipeId: uuid("recipe_id").references(() => recipes.id, { onDelete: "set null" }),
    /** Free-text meal when no recipe ("Leftovers", "Pizza night"). */
    title: text("title"),
    servings: integer("servings"),
    notes: text("notes"),
    /** Set = in this member's private food space (My Pantry etc.); null = the family's. */
    ownerMemberId: uuid("owner_member_id").references(() => familyMembers.id, { onDelete: "cascade" }),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [index("meal_plan_family_date_idx").on(t.familyId, t.date)],
);

export const foodJournalEntries = pgTable(
  "food_journal_entries",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    slot: mealSlot("slot").notNull(),
    food: text("food").notNull(),
    notes: text("notes"),
    /** breakfast | lunch | dinner | snack | dessert | beverage | other (slot keeps the 4 planner slots). */
    meal: text("meal"),
    /** "14:30" */
    time: text("time"),
    portion: text("portion"),
    /** 1 (very hungry / not full) … 5 (not hungry / very full); optional. */
    hunger: smallint("hunger"),
    fullness: smallint("fullness"),
    feelings: text("feelings").array().notNull().default([]),
    imageFileId: uuid("image_file_id").references(() => files.id, { onDelete: "set null" }),
    mealPlanEntryId: uuid("meal_plan_entry_id").references(() => mealPlanEntries.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [index("food_journal_member_date_idx").on(t.memberId, t.date)],
);

