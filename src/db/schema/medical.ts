import { boolean, date, index, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { families, familyMembers, files, visibility } from "./core";

/**
 * Family Medical & Health Center. Every record belongs to one family member and
 * carries its own visibility (family / private / selected via record_access
 * with entity_type 'medical'). Parents always see medical records.
 */
const owner = () => ({
  familyId: uuid("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  memberId: uuid("member_id")
    .notNull()
    .references(() => familyMembers.id, { onDelete: "cascade" }),
  /** Medical records default to private (parents + selected people). */
  visibility: visibility("visibility").notNull().default("private"),
  createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
});

export const medicalProfiles = pgTable(
  "medical_profiles",
  {
    id: id(),
    ...owner(),
    fullName: text("full_name"),
    bloodType: text("blood_type"),
    primaryPhysician: text("primary_physician"),
    dentist: text("dentist"),
    specialists: text("specialists"),
    emergencyContacts: text("emergency_contacts"),
    insuranceProvider: text("insurance_provider"),
    insurancePolicy: text("insurance_policy"),
    insuranceGroup: text("insurance_group"),
    insuranceNotes: text("insurance_notes"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [uniqueIndex("medical_profile_member_uq").on(t.memberId)],
);

export const allergies = pgTable(
  "allergies",
  {
    id: id(),
    ...owner(),
    name: text("name").notNull(),
    /** food | medication | environmental | seasonal | insect | other */
    type: text("type").notNull().default("food"),
    /** mild | moderate | severe | life_threatening */
    severity: text("severity").notNull().default("moderate"),
    symptoms: text("symptoms"),
    /** Ingredient keywords that trigger meal-plan warnings (e.g. peanut, peanut butter). */
    triggers: text("triggers").array().notNull().default([]),
    reactions: text("reactions"),
    emergencyInstructions: text("emergency_instructions"),
    physicianNotes: text("physician_notes"),
    identifiedOn: date("identified_on"),
    fileId: uuid("file_id").references(() => files.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("allergies_member_idx").on(t.memberId)],
);

export const foodRestrictions = pgTable(
  "food_restrictions",
  {
    id: id(),
    ...owner(),
    /** restriction | intolerance | preference | avoid | requirement */
    kind: text("kind").notNull().default("restriction"),
    title: text("title").notNull(),
    /** Foods / ingredient keywords to check recipes against. */
    foods: text("foods").array().notNull().default([]),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("food_restrictions_member_idx").on(t.memberId)],
);

export const medicalConditions = pgTable(
  "medical_conditions",
  {
    id: id(),
    ...owner(),
    name: text("name").notNull(),
    description: text("description"),
    diagnosedOn: date("diagnosed_on"),
    physician: text("physician"),
    symptoms: text("symptoms"),
    treatmentNotes: text("treatment_notes"),
    medicationNotes: text("medication_notes"),
    followUpOn: date("follow_up_on"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("conditions_member_idx").on(t.memberId)],
);

export const medications = pgTable(
  "medications",
  {
    id: id(),
    ...owner(),
    name: text("name").notNull(),
    prescriber: text("prescriber"),
    /** As prescribed. The app never suggests doses. */
    dosage: text("dosage"),
    frequency: text("frequency"),
    startOn: date("start_on"),
    endOn: date("end_on"),
    pharmacy: text("pharmacy"),
    refillsRemaining: integer("refills_remaining"),
    nextRefillOn: date("next_refill_on"),
    conditionId: uuid("condition_id").references(() => medicalConditions.id, { onDelete: "set null" }),
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("medications_member_idx").on(t.memberId)],
);

export const medicalDocuments = pgTable(
  "medical_documents",
  {
    id: id(),
    ...owner(),
    title: text("title").notNull(),
    /** lab | immunization | prescription | history | insurance | visit | allergy | form | other */
    category: text("category").notNull().default("other"),
    fileId: uuid("file_id").references(() => files.id, { onDelete: "set null" }),
    documentDate: date("document_date"),
    expiresOn: date("expires_on"),
    conditionId: uuid("condition_id").references(() => medicalConditions.id, { onDelete: "set null" }),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("medical_docs_member_idx").on(t.memberId)],
);
