import { opts, type FieldDef } from "./record-fields";

export const SPECIES = opts("dog", "cat", "bird", "fish", "rabbit", "hamster", "guinea_pig", "reptile", "horse", "other");
export const PET_STATUS = opts(["active", "Part of the family"], ["passed", "Passed away"], ["rehomed", "Rehomed"]);
export const PET_RECORD_KINDS = opts(["vet_visit", "Vet visit"], "vaccination", "condition", "allergy", "injury", "surgery", ["dental", "Dental care"], ["test", "Test results"], "medication", "other");
export const PREVENTATIVE_KINDS = opts(["flea", "Flea"], ["tick", "Tick"], ["flea_tick", "Flea & tick"], "heartworm", "deworming", "vaccination", "other");
export const SUPPLY_KINDS = opts("food", "treat", "supplement", "medicine", "grooming", ["supply", "Other supply"]);
export const CARE_NOTE_KINDS = opts(["feeding", "Feeding instructions"], ["medication", "Medication schedule"], ["grooming", "Grooming"], ["behavior", "Behavior notes"], ["mobility", "Mobility needs"], ["caregiver", "Caregiver instructions"], ["emergency", "Emergency instructions"], "other");

export const PET_FIELDS: FieldDef[] = [
  { name: "name", label: "Name", type: "text", required: true },
  { name: "species", label: "Species", type: "select", options: SPECIES, required: true },
  { name: "breed", label: "Breed", type: "text" },
  { name: "sex", label: "Sex", type: "select", options: opts("male", "female", ["male_neutered", "Male (neutered)"], ["female_spayed", "Female (spayed)"], "unknown") },
  { name: "birthday", label: "Birthday", type: "date" },
  { name: "adoptedOn", label: "Adoption date", type: "date" },
  { name: "colorMarkings", label: "Color & markings", type: "text" },
  { name: "caretakerMemberId", label: "Primary caretaker", type: "member" },
  { name: "weight", label: "Weight", type: "number" },
  { name: "weightUnit", label: "Unit", type: "select", options: opts(["lb", "lb"], ["kg", "kg"], ["oz", "oz"], ["g", "g"]) },
  { name: "status", label: "Status", type: "select", options: PET_STATUS, required: true },
  { name: "image", label: "Photo", type: "image" },
  { name: "microchipNumber", label: "Microchip #", type: "text", section: "Identification & care team" },
  { name: "microchipCompany", label: "Microchip company", type: "text" },
  { name: "veterinarian", label: "Veterinarian", type: "text" },
  { name: "vetPhone", label: "Vet phone", type: "text" },
  { name: "emergencyContact", label: "Emergency contact", type: "text", full: true },
  { name: "personality", label: "Personality", type: "textarea", rows: 2, section: "About" },
  { name: "favoriteThings", label: "Favorite things", type: "textarea", rows: 2 },
  { name: "specialCharacteristics", label: "Special characteristics", type: "textarea", rows: 2 },
  { name: "notes", label: "Notes", type: "textarea", rows: 2 },
];

export const PET_RECORD_FIELDS: FieldDef[] = [
  { name: "kind", label: "Type", type: "select", options: PET_RECORD_KINDS, required: true },
  { name: "title", label: "Title", type: "text", required: true, placeholder: "Annual exam" },
  { name: "date", label: "Date", type: "date", required: true },
  { name: "veterinarian", label: "Veterinarian / clinic", type: "text" },
  { name: "costCents", label: "Cost ($)", type: "money" },
  { name: "nextDueOn", label: "Next due", type: "date", hint: "Adds a reminder." },
  { name: "description", label: "Details", type: "textarea", rows: 2 },
  { name: "notes", label: "Notes", type: "textarea", rows: 2 },
  { name: "file", label: "Record, receipt or results (PDF or image)", type: "file" },
];

export const PREVENTATIVE_FIELDS: FieldDef[] = [
  { name: "kind", label: "Type", type: "select", options: PREVENTATIVE_KINDS, required: true },
  { name: "productName", label: "Product", type: "text", required: true, placeholder: "Monthly chewable" },
  { name: "brand", label: "Brand", type: "text" },
  { name: "lastGivenOn", label: "Last given", type: "date" },
  { name: "intervalDays", label: "Repeat every (days)", type: "number", hint: "30 for monthly, 90 for quarterly." },
  { name: "nextDueOn", label: "Next due", type: "date", hint: "Leave blank to calculate from last given." },
  { name: "assigneeId", label: "Who gives it", type: "member" },
  { name: "notes", label: "Notes", type: "textarea", rows: 2 },
];

export const SUPPLY_FIELDS: FieldDef[] = [
  { name: "name", label: "Item", type: "text", required: true, placeholder: "Salmon kibble" },
  { name: "kind", label: "Type", type: "select", options: SUPPLY_KINDS, required: true },
  { name: "brand", label: "Brand", type: "text" },
  { name: "foodType", label: "Food type", type: "text", placeholder: "Dry, wet, raw…" },
  { name: "flavor", label: "Flavor", type: "text" },
  { name: "quantity", label: "On hand", type: "number" },
  { name: "unit", label: "Unit", type: "text", placeholder: "bags, cans, lb" },
  { name: "lowStockThreshold", label: "Restock when at or below", type: "number", hint: "Adds it to the shopping list automatically." },
  { name: "feedingSchedule", label: "Feeding schedule", type: "text", placeholder: "7am & 5pm", full: true },
  { name: "feedingInstructions", label: "Feeding instructions", type: "textarea", rows: 2 },
  { name: "dietaryNotes", label: "Dietary restrictions / notes", type: "textarea", rows: 2 },
];

export const CARE_NOTE_FIELDS: FieldDef[] = [
  { name: "kind", label: "Type", type: "select", options: CARE_NOTE_KINDS, required: true },
  { name: "body", label: "Instructions", type: "textarea", rows: 4, required: true },
];

export const speciesEmoji = (s: string) => ({ dog: "🐕", cat: "🐈", bird: "🦜", fish: "🐟", rabbit: "🐇", hamster: "🐹", guinea_pig: "🐹", reptile: "🦎", horse: "🐴" })[s] ?? "🐾";

export function petAge(birthday: string | null, today: string) {
  if (!birthday) return null;
  const [y, m] = [Number(today.slice(0, 4)) - Number(birthday.slice(0, 4)), Number(today.slice(5, 7)) - Number(birthday.slice(5, 7))];
  const months = y * 12 + m - (today.slice(8) < birthday.slice(8) ? 1 : 0);
  if (months < 0) return null;
  if (months < 12) return `${months} mo`;
  return `${Math.floor(months / 12)} yr${Math.floor(months / 12) === 1 ? "" : "s"}`;
}
