/** Pregnancy Tracker vocabulary: lists the forms and pages share. Pure (client-safe). */

export const SYMPTOMS = [
  "Nausea",
  "Vomiting",
  "Fatigue",
  "Headache",
  "Back discomfort",
  "Cramps",
  "Swelling",
  "Heartburn",
  "Constipation",
  "Dizziness",
  "Breast changes",
  "Sleep changes",
  "Appetite changes",
  "Mood changes",
  "Leg cramps",
  "Round ligament pain",
  "Pelvic pressure",
  "Braxton Hicks",
  "Stuffy nose",
  "Itchy skin",
] as const;

export const SEVERITY = [
  { value: 1, label: "Mild" },
  { value: 2, label: "Moderate" },
  { value: 3, label: "Strong" },
  { value: 4, label: "Severe" },
] as const;

/** Symptoms that always come with a "call your provider" note (never a diagnosis). */
export const CALL_PROVIDER = /bleed|fluid|leak|severe|vision|blurr|fever|chest pain|faint|less movement|not moving|seizure|swelling of (?:face|hands)/i;

export const QUESTION_CATEGORIES = [
  { value: "development", label: "Baby's development" },
  { value: "symptoms", label: "Symptoms" },
  { value: "medications", label: "Medications" },
  { value: "nutrition", label: "Nutrition" },
  { value: "testing", label: "Testing" },
  { value: "labor", label: "Labor" },
  { value: "delivery", label: "Delivery" },
  { value: "postpartum", label: "Postpartum" },
  { value: "breastfeeding", label: "Breastfeeding" },
  { value: "recovery", label: "Recovery" },
  { value: "other", label: "Other" },
];

export const APPOINTMENT_KINDS = [
  { value: "prenatal", label: "Prenatal visit", emoji: "🩺" },
  { value: "ultrasound", label: "Ultrasound", emoji: "🖥️" },
  { value: "lab", label: "Lab / blood work", emoji: "🧪" },
  { value: "specialist", label: "Specialist", emoji: "👩‍⚕️" },
  { value: "hospital", label: "Hospital visit", emoji: "🏥" },
  { value: "class", label: "Childbirth / baby class", emoji: "📚" },
  { value: "other", label: "Other", emoji: "📌" },
] as const;

export const ITEM_STATUSES = [
  { value: "needed", label: "Needed" },
  { value: "researching", label: "Researching" },
  { value: "purchased", label: "Purchased" },
  { value: "packed", label: "Packed" },
  { value: "complete", label: "Complete" },
] as const;

export type ChecklistGroup = { key: string; title: string; emoji: string; area: "prepare" | "third" | "postpartum"; fromWeek?: number; items: string[] };

/** Starter checklists (everything is editable once added). */
export const CHECKLISTS: ChecklistGroup[] = [
  { key: "nursery", title: "Nursery", emoji: "🛏️", area: "prepare", items: ["Crib or bassinet", "Firm, flat mattress", "Fitted sheets", "Changing pad", "Diapers & wipes", "Storage / dresser", "Night light", "Baby monitor", "Blackout curtains"] },
  { key: "clothing", title: "Baby clothing", emoji: "👕", area: "prepare", items: ["Newborn-size clothes", "Onesies / bodysuits", "Sleepers", "Socks", "Hats", "Swaddles or sleep sacks", "Seasonal clothes (coat, sun hat)"] },
  { key: "feeding", title: "Feeding", emoji: "🍼", area: "prepare", items: ["Bottles", "Nursing bras & pads", "Breast pump", "Formula supplies (if using)", "Burp cloths", "Milk storage bags", "Bottle brush"] },
  { key: "bathing", title: "Bathing", emoji: "🛁", area: "prepare", items: ["Baby bath tub", "Hooded towels", "Washcloths", "Gentle baby wash", "Nail clippers or file", "Thermometer"] },
  { key: "transport", title: "Transportation", emoji: "🚗", area: "prepare", items: ["Rear-facing car seat (installed & checked)", "Stroller", "Diaper bag", "Baby carrier"] },
  { key: "hospital", title: "Hospital / birth center bag", emoji: "🎒", area: "third", fromWeek: 32, items: ["ID, insurance card & paperwork", "Birth preferences copy", "Phone & long charger", "Comfortable clothes & robe", "Toiletries & lip balm", "Nursing bra", "Snacks", "Baby's going-home outfit", "Baby blanket", "Car seat ready in the car", "Comfort items (pillow, music)"] },
  { key: "third", title: "Getting ready for the birth", emoji: "🗓️", area: "third", fromWeek: 28, items: ["Pre-register at the hospital", "Childcare plan for older kids during the birth", "Pet care plan", "Route & parking to the hospital", "Important contacts saved", "Talk with siblings about the new baby", "Household jobs covered for a few weeks", "Freezer meals made"] },
  { key: "postpartum", title: "Postpartum supplies", emoji: "🧺", area: "postpartum", items: ["Pads", "Peri bottle", "Comfortable underwear", "Nursing supplies", "Stool softener (ask your provider)", "Water bottle", "Easy snacks"] },
  { key: "recovery", title: "Rest & help at home", emoji: "🤝", area: "postpartum", items: ["Meal train or meal plan for the first weeks", "Who helps with chores and errands", "Support contacts list", "Postpartum check-up booked", "Baby's first check-up booked", "Family schedule for the first weeks", "Rest plan (who does night feeds when)"] },
];

export const BIRTH_PLAN_SECTIONS = [
  { key: "location", label: "Preferred birth location", hint: "Hospital, birth center, or home, and any back-up plan." },
  { key: "support", label: "Support people", hint: "Who you'd like with you, and who to call." },
  { key: "communication", label: "Communication preferences", hint: "How you'd like things explained, and decisions made." },
  { key: "comfort", label: "Comfort & pain relief preferences", hint: "Movement, water, music, lighting, pain-relief options you want to discuss." },
  { key: "labor", label: "During labor", hint: "Monitoring, eating and drinking, positions." },
  { key: "birth", label: "During the birth", hint: "Pushing, who cuts the cord, photos, skin-to-skin." },
  { key: "feeding", label: "Feeding preferences", hint: "Breastfeeding, formula, or both; help you'd like." },
  { key: "newborn", label: "Newborn care preferences", hint: "First bath, procedures, rooming-in." },
  { key: "postpartum", label: "Postpartum preferences", hint: "Visitors, rest, support." },
  { key: "emergency", label: "If plans change (emergency preferences)", hint: "Your wishes if a C-section or other change is needed." },
  { key: "other", label: "Other notes", hint: "Anything else your team should know." },
];

export const JOURNAL_CATEGORIES = [
  { value: "memory", label: "Memory" },
  { value: "milestone", label: "Milestone" },
  { value: "emotion", label: "Feelings" },
  { value: "appointment", label: "Appointment" },
  { value: "note", label: "Note" },
];
export const PHOTO_CATEGORIES = [
  { value: "bump", label: "Bump photo" },
  { value: "ultrasound", label: "Ultrasound" },
  { value: "announcement", label: "Announcement" },
  { value: "milestone", label: "Milestone" },
  { value: "family", label: "Family" },
];
export const DOC_CATEGORIES = [
  { value: "ultrasound", label: "Ultrasound" },
  { value: "results", label: "Test results" },
  { value: "appointment", label: "Appointment document" },
  { value: "instructions", label: "Provider instructions" },
  { value: "birth", label: "Birth documents" },
  { value: "other", label: "Other" },
];

export const MEASURES = [
  { value: "bp", label: "Blood pressure", unit: "mmHg" },
  { value: "sugar", label: "Blood sugar", unit: "mg/dL" },
  { value: "temp", label: "Temperature", unit: "°F" },
  { value: "other", label: "Other", unit: "" },
] as const;

export const BABY_COUNT = [
  { value: 1, label: "One baby (singleton)" },
  { value: 2, label: "Twins" },
  { value: 3, label: "Triplets" },
  { value: 4, label: "Four or more" },
];

export const STATUS_LABEL: Record<string, string> = { active: "Active", paused: "Paused", archived: "Archived", completed: "Completed", born: "Baby born" };
