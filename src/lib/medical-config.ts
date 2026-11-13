import { opts, type FieldDef } from "./record-fields";

export const MEDICAL_KINDS = ["profile", "allergy", "restriction", "condition", "medication", "document"] as const;
export type MedicalKind = (typeof MEDICAL_KINDS)[number];

export const ALLERGY_TYPES = opts("food", "medication", "environmental", "seasonal", "insect", "other");
export const SEVERITIES = opts("mild", "moderate", "severe", ["life_threatening", "Life-threatening"]);
export const RESTRICTION_KINDS = opts(["restriction", "Restricted food"], ["intolerance", "Intolerance"], ["preference", "Dietary preference"], ["avoid", "Food to avoid"], ["requirement", "Special requirement"]);
export const DOC_CATEGORIES = opts(
  ["lab", "Lab results"],
  ["immunization", "Immunization record"],
  ["prescription", "Prescription"],
  ["history", "Medical history"],
  ["insurance", "Insurance card"],
  ["visit", "Visit summary"],
  ["allergy", "Allergy documentation"],
  ["form", "Medical form"],
  ["other", "Other"],
);

export const MEDICAL_FIELDS: Record<MedicalKind, FieldDef[]> = {
  profile: [
    { name: "fullName", label: "Full legal name", type: "text" },
    { name: "bloodType", label: "Blood type (optional)", type: "select", options: opts("A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-") },
    { name: "primaryPhysician", label: "Primary physician", type: "text", placeholder: "Dr. Patel · Valley Family Medicine · 828-555-0101" },
    { name: "dentist", label: "Dentist", type: "text" },
    { name: "specialists", label: "Specialists", type: "textarea", rows: 2, placeholder: "Allergist: Dr. Kim, 828-555-0120" },
    { name: "emergencyContacts", label: "Emergency contacts", type: "textarea", rows: 2 },
    { name: "insuranceProvider", label: "Insurance provider", type: "text", section: "Insurance" },
    { name: "insurancePolicy", label: "Member / policy #", type: "text" },
    { name: "insuranceGroup", label: "Group #", type: "text" },
    { name: "insuranceNotes", label: "Insurance notes", type: "textarea", rows: 2 },
    { name: "notes", label: "Medical notes", type: "textarea", section: "Notes" },
  ],
  allergy: [
    { name: "name", label: "Allergy", type: "text", required: true, placeholder: "Peanuts" },
    { name: "type", label: "Type", type: "select", options: ALLERGY_TYPES, required: true },
    { name: "severity", label: "Severity", type: "select", options: SEVERITIES, required: true },
    { name: "identifiedOn", label: "Date identified", type: "date" },
    { name: "triggers", label: "Ingredient keywords to watch for", type: "tags", full: true, placeholder: "peanut, peanut butter, groundnut", hint: "Recipes and meal plans containing these are flagged." },
    { name: "symptoms", label: "Symptoms", type: "textarea", rows: 2 },
    { name: "reactions", label: "Reactions", type: "textarea", rows: 2 },
    { name: "emergencyInstructions", label: "Emergency instructions", type: "textarea", rows: 2, placeholder: "As directed by the physician, e.g. where the epinephrine auto-injector is kept" },
    { name: "physicianNotes", label: "Physician notes", type: "textarea", rows: 2 },
    { name: "file", label: "Image or document", type: "file" },
  ],
  restriction: [
    { name: "title", label: "Restriction", type: "text", required: true, placeholder: "Lactose intolerance" },
    { name: "kind", label: "Kind", type: "select", options: RESTRICTION_KINDS, required: true },
    { name: "foods", label: "Foods / ingredients", type: "tags", full: true, placeholder: "milk, cheese, cream", hint: "Recipes containing these are flagged in meal planning." },
    { name: "notes", label: "Notes", type: "textarea", rows: 2 },
  ],
  condition: [
    { name: "name", label: "Condition", type: "text", required: true },
    { name: "diagnosedOn", label: "Date diagnosed", type: "date" },
    { name: "physician", label: "Treating physician", type: "text" },
    { name: "followUpOn", label: "Next follow-up", type: "date", hint: "Adds a reminder." },
    { name: "description", label: "Description", type: "textarea", rows: 2 },
    { name: "symptoms", label: "Symptoms / observations", type: "textarea", rows: 2 },
    { name: "treatmentNotes", label: "Treatment notes", type: "textarea", rows: 2 },
    { name: "medicationNotes", label: "Medication information", type: "textarea", rows: 2 },
    { name: "active", label: "Currently active", type: "checkbox" },
  ],
  medication: [
    { name: "name", label: "Medication", type: "text", required: true },
    { name: "prescriber", label: "Prescribing physician", type: "text" },
    { name: "dosage", label: "Dosage (as prescribed)", type: "text" },
    { name: "frequency", label: "Frequency (as prescribed)", type: "text" },
    { name: "startOn", label: "Start date", type: "date" },
    { name: "endOn", label: "End date", type: "date" },
    { name: "pharmacy", label: "Pharmacy", type: "text" },
    { name: "refillsRemaining", label: "Refills remaining", type: "number" },
    { name: "nextRefillOn", label: "Next refill date", type: "date", hint: "You'll get a reminder a few days before." },
    { name: "notes", label: "Notes", type: "textarea", rows: 2 },
    { name: "active", label: "Currently taking", type: "checkbox" },
  ],
  document: [
    { name: "title", label: "Title", type: "text", required: true, placeholder: "2026 immunization record" },
    { name: "category", label: "Category", type: "select", options: DOC_CATEGORIES, required: true },
    { name: "documentDate", label: "Document date", type: "date" },
    { name: "expiresOn", label: "Expires (if applicable)", type: "date" },
    { name: "file", label: "PDF, image or scan", type: "file" },
    { name: "notes", label: "Notes", type: "textarea", rows: 2 },
  ],
};

export const KIND_LABEL: Record<MedicalKind, string> = {
  profile: "Medical profile",
  allergy: "Allergy",
  restriction: "Food restriction",
  condition: "Condition",
  medication: "Medication",
  document: "Document",
};

export const SEVERITY_TONE: Record<string, "neutral" | "olive" | "wine"> = { mild: "neutral", moderate: "olive", severe: "wine", life_threatening: "wine" };
