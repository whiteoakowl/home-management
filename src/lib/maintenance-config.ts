import { opts, type FieldDef } from "./record-fields";

export const ROOM_KINDS = opts(["room", "Room"], ["area", "Area"], ["system", "Home system"]);
export const SYSTEM_SUGGESTIONS = ["HVAC", "Plumbing", "Electrical", "Roof", "Water heater", "Appliances", "Foundation", "Exterior", "Landscaping", "Septic", "Well", "Fireplace"];

export const ROOM_FIELDS: FieldDef[] = [
  { name: "name", label: "Name", type: "text", required: true, placeholder: "Kitchen, Attic, HVAC…" },
  { name: "kind", label: "Type", type: "select", options: ROOM_KINDS, required: true },
  { name: "image", label: "Photo", type: "image" },
  { name: "description", label: "Description", type: "textarea", rows: 2, placeholder: "Paint colors, flooring, fixtures, model numbers…" },
  { name: "notes", label: "Notes", type: "textarea", rows: 2 },
];

export const PROJECT_STATUSES = opts("idea", "planning", "budgeting", ["ready", "Ready to start"], ["in_progress", "In progress"], ["on_hold", "On hold"], "completed");
export const PROJECT_STATUS_TONE: Record<string, "neutral" | "primary" | "olive" | "wine" | "mist"> = {
  idea: "mist",
  planning: "neutral",
  budgeting: "neutral",
  ready: "primary",
  in_progress: "olive",
  on_hold: "wine",
  completed: "primary",
};

export const PROJECT_FIELDS: FieldDef[] = [
  { name: "title", label: "Project", type: "text", required: true, placeholder: "Kitchen backsplash" },
  { name: "status", label: "Status", type: "select", options: PROJECT_STATUSES, required: true },
  { name: "roomId", label: "Room / area", type: "select" },
  { name: "ownerMemberId", label: "Project lead", type: "member" },
  { name: "startDate", label: "Start", type: "date" },
  { name: "targetDate", label: "Target finish", type: "date" },
  { name: "completedOn", label: "Completed on", type: "date" },
  { name: "budgetCents", label: "Budget ($)", type: "money" },
  { name: "estimatedCostCents", label: "Estimated cost ($)", type: "money" },
  { name: "contractor", label: "Contractor", type: "text" },
  { name: "image", label: "Cover photo", type: "image" },
  { name: "description", label: "Description", type: "textarea", rows: 3 },
  { name: "measurements", label: "Measurements", type: "textarea", rows: 2 },
  { name: "notes", label: "Notes", type: "textarea", rows: 2 },
];

export const REPAIR_STATUSES = opts("open", "scheduled", "completed");
export const REPAIR_FIELDS: FieldDef[] = [
  { name: "title", label: "Repair", type: "text", required: true, placeholder: "Leaking kitchen faucet" },
  { name: "status", label: "Status", type: "select", options: REPAIR_STATUSES, required: true },
  { name: "roomId", label: "Room / system", type: "select" },
  { name: "reportedOn", label: "Reported", type: "date", required: true },
  { name: "scheduledOn", label: "Scheduled", type: "date" },
  { name: "completedOn", label: "Completed", type: "date" },
  { name: "contractor", label: "Contractor / who fixed it", type: "text" },
  { name: "costCents", label: "Cost ($)", type: "money" },
  { name: "problem", label: "Problem", type: "textarea", rows: 2 },
  { name: "repairPerformed", label: "Repair performed", type: "textarea", rows: 2 },
  { name: "materials", label: "Materials used", type: "textarea", rows: 2 },
  { name: "warrantyInfo", label: "Warranty", type: "text", placeholder: "1-year labor warranty" },
  { name: "warrantyExpiresOn", label: "Warranty expires", type: "date", hint: "You'll be reminded before it expires." },
  { name: "notes", label: "Notes", type: "textarea", rows: 2 },
];

export const DOC_TYPES = opts(["manual", "Appliance manual"], "warranty", ["estimate", "Contractor estimate"], "receipt", ["plan", "Plan / blueprint"], ["inspection", "Inspection report"], ["paint", "Paint colors"], ["product", "Product info"], ["instructions", "Instructions"], ["insurance", "Insurance"], "other");

export const DOC_FIELDS: FieldDef[] = [
  { name: "title", label: "Title", type: "text", required: true },
  { name: "docType", label: "Type", type: "select", options: DOC_TYPES, required: true },
  { name: "applianceName", label: "Appliance / product", type: "text", placeholder: "Bosch dishwasher SHX78" },
  { name: "roomId", label: "Room / system", type: "select" },
  { name: "projectId", label: "Project", type: "select" },
  { name: "expiresOn", label: "Expires (warranty, policy)", type: "date", hint: "Reminders 30 days before." },
  { name: "file", label: "File (PDF or image)", type: "file" },
  { name: "notes", label: "Notes", type: "textarea", rows: 2 },
];

export const MATERIAL_FIELDS: FieldDef[] = [
  { name: "name", label: "Material", type: "text", required: true, placeholder: "Subway tile 3×6" },
  { name: "quantity", label: "Quantity", type: "number" },
  { name: "unit", label: "Unit", type: "text", placeholder: "sq ft, boxes, gallons" },
  { name: "estimatedCostCents", label: "Estimated cost ($)", type: "money" },
  { name: "store", label: "Store", type: "text" },
  { name: "productInfo", label: "Product info / link", type: "textarea", rows: 2 },
  { name: "purchased", label: "Purchased", type: "checkbox" },
];

export const PHOTO_KINDS = opts("before", "after", "progress", "inspiration", "receipt", ["plan", "Plan / sketch"]);

/** Frequency bucket of a maintenance schedule. */
export function frequencyOf(rule: { freq: string; interval: number } | null): { key: string; label: string } {
  if (!rule) return { key: "custom", label: "One-time & custom" };
  const days = { daily: 1, weekly: 7, monthly: 30, yearly: 365 }[rule.freq as "daily"] ?? 30;
  const span = days * rule.interval;
  if (span <= 7) return { key: "weekly", label: "Weekly" };
  if (span <= 31) return { key: "monthly", label: "Monthly" };
  if (span <= 95) return { key: "quarterly", label: "Quarterly" };
  if (span <= 190) return { key: "biannual", label: "Twice a year" };
  if (span <= 366) return { key: "annual", label: "Annual" };
  return { key: "custom", label: "One-time & custom" };
}
export const FREQUENCY_ORDER = ["weekly", "monthly", "quarterly", "biannual", "annual", "custom"];
