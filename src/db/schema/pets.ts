import { date, index, integer, numeric, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { families, familyMembers, files } from "./core";
import { inventoryItems } from "./kitchen";

export const pets = pgTable(
  "pets",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    species: text("species").notNull(),
    breed: text("breed"),
    birthday: date("birthday"),
    adoptedOn: date("adopted_on"),
    sex: text("sex"),
    colorMarkings: text("color_markings"),
    weight: numeric("weight"),
    weightUnit: text("weight_unit"),
    microchipNumber: text("microchip_number"),
    microchipCompany: text("microchip_company"),
    veterinarian: text("veterinarian"),
    vetPhone: text("vet_phone"),
    emergencyContact: text("emergency_contact"),
    personality: text("personality"),
    favoriteThings: text("favorite_things"),
    specialCharacteristics: text("special_characteristics"),
    caretakerMemberId: uuid("caretaker_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    imageFileId: uuid("image_file_id").references(() => files.id, { onDelete: "set null" }),
    /** active | passed | rehomed */
    status: text("status").notNull().default("active"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("pets_family_idx").on(t.familyId)],
);

export const petPhotos = pgTable(
  "pet_photos",
  {
    id: id(),
    petId: uuid("pet_id")
      .notNull()
      .references(() => pets.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    caption: text("caption"),
    ...timestamps,
  },
  (t) => [index("pet_photos_pet_idx").on(t.petId)],
);

export const petMedicalRecords = pgTable(
  "pet_medical_records",
  {
    id: id(),
    petId: uuid("pet_id")
      .notNull()
      .references(() => pets.id, { onDelete: "cascade" }),
    /** vet_visit | vaccination | condition | allergy | injury | surgery | dental | test | medication | other */
    kind: text("kind").notNull().default("vet_visit"),
    title: text("title").notNull(),
    date: date("date").notNull(),
    veterinarian: text("veterinarian"),
    description: text("description"),
    notes: text("notes"),
    costCents: integer("cost_cents"),
    nextDueOn: date("next_due_on"),
    fileId: uuid("file_id").references(() => files.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("pet_medical_pet_idx").on(t.petId, t.date)],
);

/** Recurring preventative care (flea, tick, heartworm, deworming, vaccines…). */
export const petPreventatives = pgTable(
  "pet_preventatives",
  {
    id: id(),
    petId: uuid("pet_id")
      .notNull()
      .references(() => pets.id, { onDelete: "cascade" }),
    /** flea | tick | flea_tick | heartworm | deworming | vaccination | other */
    kind: text("kind").notNull(),
    productName: text("product_name").notNull(),
    brand: text("brand"),
    lastGivenOn: date("last_given_on"),
    intervalDays: integer("interval_days").notNull().default(30),
    nextDueOn: date("next_due_on"),
    assigneeId: uuid("assignee_id").references(() => familyMembers.id, { onDelete: "set null" }),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("pet_prev_pet_idx").on(t.petId)],
);

/** Pet food & supplies: quantities live on the shared kitchen inventory item. */
export const petSupplies = pgTable(
  "pet_supplies",
  {
    id: id(),
    petId: uuid("pet_id").references(() => pets.id, { onDelete: "cascade" }),
    inventoryItemId: uuid("inventory_item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "cascade" }),
    /** food | treat | supplement | medicine | grooming | supply */
    kind: text("kind").notNull().default("food"),
    brand: text("brand"),
    foodType: text("food_type"),
    flavor: text("flavor"),
    feedingInstructions: text("feeding_instructions"),
    feedingSchedule: text("feeding_schedule"),
    dietaryNotes: text("dietary_notes"),
    ...timestamps,
  },
  (t) => [index("pet_supplies_pet_idx").on(t.petId)],
);

export const petCareNotes = pgTable(
  "pet_care_notes",
  {
    id: id(),
    petId: uuid("pet_id")
      .notNull()
      .references(() => pets.id, { onDelete: "cascade" }),
    /** feeding | medication | grooming | behavior | mobility | caregiver | emergency | other */
    kind: text("kind").notNull(),
    body: text("body").notNull(),
    ...timestamps,
  },
  (t) => [index("pet_care_pet_idx").on(t.petId)],
);
