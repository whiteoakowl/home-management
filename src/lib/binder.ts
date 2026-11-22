import { opts, type FieldDef } from "./record-fields";

/**
 * The Family Binder (House → Important Info): one section per kind of
 * information, each with its own fields. Stored in household_info
 * (kind + fields JSON); title and body are filled in from the fields so
 * search and older screens keep working.
 */
export const BINDER_KINDS = ["emergency", "phone", "school", "doctor", "insurance", "sitter", "instructions", "address", "membership", "wifi", "note"] as const;
export type BinderKind = (typeof BINDER_KINDS)[number];

export type BinderMeta = {
  label: string;
  one: string;
  emoji: string;
  blurb: string;
  /** Field used as the item's title. */
  titleField: string;
  /** Included on the printable babysitter sheet. */
  sitter: boolean;
  fields: FieldDef[];
};

const notes: FieldDef = { name: "notes", label: "Notes", type: "textarea", rows: 2 };

export const BINDER: Record<BinderKind, BinderMeta> = {
  emergency: {
    label: "Emergency contacts",
    one: "emergency contact",
    emoji: "🚨",
    blurb: "Who to call first if something happens.",
    titleField: "name",
    sitter: true,
    fields: [
      { name: "name", label: "Name", type: "text", required: true, placeholder: "Grandma Rose" },
      { name: "relationship", label: "Relationship", type: "text", placeholder: "Grandmother, neighbor…" },
      { name: "phone", label: "Phone", type: "text", required: true, placeholder: "555-0123" },
      { name: "altPhone", label: "Other phone", type: "text" },
      notes,
    ],
  },
  phone: {
    label: "Important phone numbers",
    one: "phone number",
    emoji: "☎️",
    blurb: "Poison control, the pediatrician's after-hours line, the vet, the plumber…",
    titleField: "label",
    sitter: true,
    fields: [
      { name: "label", label: "Who", type: "text", required: true, placeholder: "Poison Control" },
      { name: "phone", label: "Phone", type: "text", required: true },
      notes,
    ],
  },
  school: {
    label: "School information",
    one: "school",
    emoji: "🏫",
    blurb: "Schools, teachers, hours and pickup details.",
    titleField: "school",
    sitter: true,
    fields: [
      { name: "school", label: "School", type: "text", required: true, placeholder: "Maple Elementary" },
      { name: "student", label: "Student", type: "text", placeholder: "Jack" },
      { name: "grade", label: "Grade", type: "text", placeholder: "3rd" },
      { name: "teacher", label: "Teacher", type: "text" },
      { name: "phone", label: "Office phone", type: "text" },
      { name: "hours", label: "School hours", type: "text", placeholder: "8:05 am – 3:10 pm" },
      { name: "address", label: "Address", type: "text", full: true },
      { name: "pickup", label: "Pickup / drop-off", type: "textarea", rows: 2, placeholder: "Car line at the side entrance. Approved pickup: Mom, Dad, Grandma." },
      { name: "website", label: "Website or portal", type: "url" },
      notes,
    ],
  },
  doctor: {
    label: "Doctors",
    one: "doctor",
    emoji: "🩺",
    blurb: "Pediatricians, family doctors, dentists and specialists.",
    titleField: "name",
    sitter: true,
    fields: [
      { name: "name", label: "Doctor", type: "text", required: true, placeholder: "Dr. Patel" },
      { name: "specialty", label: "Type", type: "text", placeholder: "Pediatrician, dentist…" },
      { name: "practice", label: "Practice", type: "text" },
      { name: "patients", label: "For", type: "text", placeholder: "The kids" },
      { name: "phone", label: "Phone", type: "text" },
      { name: "afterHours", label: "After-hours line", type: "text" },
      { name: "address", label: "Address", type: "text", full: true },
      { name: "portal", label: "Patient portal", type: "url" },
      notes,
    ],
  },
  insurance: {
    label: "Insurance",
    one: "insurance policy",
    emoji: "🛡️",
    blurb: "Health, dental, vision, auto, home and life policies.",
    titleField: "provider",
    sitter: true,
    fields: [
      { name: "type", label: "Type", type: "select", required: true, options: opts("health", "dental", "vision", "auto", "home", ["renters", "Renters"], "life", ["pet", "Pet"], "other") },
      { name: "provider", label: "Company", type: "text", required: true, placeholder: "Blue Cross" },
      { name: "memberId", label: "Member ID", type: "text" },
      { name: "groupNumber", label: "Group number", type: "text" },
      { name: "policyNumber", label: "Policy number", type: "text" },
      { name: "covered", label: "Who's covered", type: "text" },
      { name: "phone", label: "Phone", type: "text" },
      { name: "website", label: "Website", type: "url" },
      notes,
    ],
  },
  sitter: {
    label: "Babysitter information",
    one: "babysitter note",
    emoji: "👶",
    blurb: "Sitters you use and everything they need to know.",
    titleField: "name",
    sitter: true,
    fields: [
      { name: "name", label: "Title or sitter's name", type: "text", required: true, placeholder: "Bedtime & house rules" },
      { name: "phone", label: "Sitter's phone", type: "text" },
      { name: "rate", label: "Rate", type: "text", placeholder: "$18/hour" },
      { name: "routine", label: "Bedtime routine", type: "textarea", rows: 3, placeholder: "Bath at 7, two books, lights out 8:00" },
      { name: "food", label: "Meals, snacks & allergies", type: "textarea", rows: 2 },
      { name: "rules", label: "House rules", type: "textarea", rows: 2, placeholder: "No screens after 7. Dog stays out of the bedrooms." },
      notes,
    ],
  },
  instructions: {
    label: "Household instructions",
    one: "instruction",
    emoji: "📋",
    blurb: "How things work: the alarm, the breaker box, the water shut-off, the TV.",
    titleField: "title",
    sitter: true,
    fields: [
      { name: "title", label: "What", type: "text", required: true, placeholder: "Turning off the alarm" },
      { name: "steps", label: "How", type: "textarea", required: true, rows: 5, placeholder: "1. Enter the code on the keypad by the garage door…" },
    ],
  },
  address: {
    label: "Important addresses",
    one: "address",
    emoji: "📍",
    blurb: "Home, grandparents, school, the nearest hospital and urgent care.",
    titleField: "label",
    sitter: true,
    fields: [
      { name: "label", label: "Place", type: "text", required: true, placeholder: "Nearest hospital" },
      { name: "address", label: "Address", type: "text", required: true, full: true },
      { name: "phone", label: "Phone", type: "text" },
      notes,
    ],
  },
  membership: {
    label: "Membership numbers",
    one: "membership",
    emoji: "🎟️",
    blurb: "Library cards, warehouse clubs, loyalty programs, museum and zoo passes.",
    titleField: "organization",
    sitter: false,
    fields: [
      { name: "organization", label: "Organization", type: "text", required: true, placeholder: "City Library" },
      { name: "memberName", label: "Member", type: "text" },
      { name: "number", label: "Number", type: "text", required: true },
      { name: "expires", label: "Expires", type: "date" },
      { name: "phone", label: "Phone", type: "text" },
      notes,
    ],
  },
  wifi: {
    label: "Wi-Fi",
    one: "Wi-Fi network",
    emoji: "📶",
    blurb: "Network names and passwords, with a QR code guests can scan.",
    titleField: "network",
    sitter: true,
    fields: [
      { name: "network", label: "Network name", type: "text", required: true },
      { name: "password", label: "Password", type: "text" },
      { name: "security", label: "Security", type: "select", options: opts(["WPA", "WPA/WPA2/WPA3"], ["WEP", "WEP"], ["nopass", "Open (no password)"]) },
      { name: "guestNetwork", label: "Guest network", type: "text" },
      { name: "guestPassword", label: "Guest password", type: "text" },
      notes,
    ],
  },
  note: {
    label: "Other info",
    one: "note",
    emoji: "🗒️",
    blurb: "Alarm codes, utility accounts and anything else.",
    titleField: "title",
    sitter: false,
    fields: [
      { name: "title", label: "Title", type: "text", required: true, placeholder: "Water shut-off" },
      { name: "body", label: "Details", type: "textarea", required: true, rows: 4 },
    ],
  },
};

export const isBinderKind = (v: unknown): v is BinderKind => typeof v === "string" && (BINDER_KINDS as readonly string[]).includes(v);

/** Fields that are phone numbers (tap to call). */
export const PHONE_FIELDS = new Set(["phone", "altPhone", "afterHours"]);
/** Fields worth a copy button. */
export const COPY_FIELDS = new Set(["password", "guestPassword", "memberId", "groupNumber", "policyNumber", "number"]);
/** Fields that are addresses (open in maps). */
export const ADDRESS_FIELDS = new Set(["address"]);

/** Plain-text summary of an item (stored as body: search, older screens). */
export function binderBody(kind: BinderKind, values: Record<string, unknown>) {
  return BINDER[kind].fields
    .filter((f) => f.name !== BINDER[kind].titleField && values[f.name] != null && values[f.name] !== "")
    .map((f) => `${f.label}: ${f.options?.find((o) => o.value === values[f.name])?.label ?? values[f.name]}`)
    .join("\n");
}

/** The string a phone camera understands to join a Wi-Fi network. */
export function wifiQrText(network: string, password: string | null, security: string | null) {
  const esc = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");
  const t = security === "nopass" || !password ? "nopass" : security === "WEP" ? "WEP" : "WPA";
  return `WIFI:T:${t};S:${esc(network)};${t === "nopass" ? "" : `P:${esc(password!)};`};`;
}
