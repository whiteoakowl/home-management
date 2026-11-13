import { PHASE_LABEL } from "./astro";
import { opts, type FieldDef } from "./record-fields";
import { SABBATS } from "./sabbats";

export const CRAFT_KINDS = ["spell", "ritual", "crystal", "herb", "tool", "wellness"] as const;
export type CraftKind = (typeof CRAFT_KINDS)[number];

export const CRAFT_META: Record<CraftKind, { label: string; plural: string; emoji: string; blurb: string }> = {
  spell: { label: "Spell", plural: "Spells", emoji: "✨", blurb: "Your family's spell book: purpose, timing, ingredients and results." },
  ritual: { label: "Ritual", plural: "Rituals", emoji: "🕯️", blurb: "Step-by-step rituals for moons, sabbats and life's moments." },
  crystal: { label: "Crystal", plural: "Crystals", emoji: "🔮", blurb: "Crystal reference and your personal collection." },
  herb: { label: "Herb", plural: "Herbs", emoji: "🌿", blurb: "Magical herbs with folklore, traditional use and safety kept clearly separate." },
  tool: { label: "Tool", plural: "Tools", emoji: "🪄", blurb: "Ritual tools, their purposes and care." },
  wellness: { label: "Practice", plural: "Magical wellness", emoji: "🌙", blurb: "Meditations, journaling prompts and self-care rituals. Spiritual practice, not medical advice." },
};

/** Columns on craft_items; every other field lives in the `fields` JSONB. */
export const CRAFT_COLUMNS = ["name", "category", "description", "emoji", "moonPhase", "sabbat", "notes", "source"] as const;

export const MOON_OPTIONS = [
  ...opts(...(Object.entries(PHASE_LABEL) as [string, string][])),
  { value: "waxing", label: "Any waxing moon" },
  { value: "waning", label: "Any waning moon" },
  { value: "any", label: "Any time" },
];
export const SABBAT_OPTIONS = SABBATS.map((s) => ({ value: s.key, label: s.name }));

const timing: FieldDef[] = [
  { name: "moonPhase", label: "Moon phase", type: "select", options: MOON_OPTIONS },
  { name: "sabbat", label: "Sabbat", type: "select", options: SABBAT_OPTIONS },
];
const common = (categories: string[], placeholder?: string): FieldDef[] => [
  { name: "name", label: "Name", type: "text", required: true, placeholder },
  { name: "category", label: "Category", type: "select", options: opts(...categories) },
  { name: "emoji", label: "Symbol (emoji)", type: "text", placeholder: "✨" },
  { name: "image", label: "Image", type: "image" },
  { name: "description", label: "Description", type: "textarea", rows: 2 },
];
const SAFETY_LEVELS = opts(["generally_safe", "Generally safe"], ["caution", "Use with caution"], ["toxic", "Toxic — reference only"]);

export const CRAFT_FIELDS: Record<CraftKind, FieldDef[]> = {
  spell: [
    ...common(["protection", "love", "prosperity", "luck", "cleansing", "banishing", "home", "healing_energy", "divination", "creativity", "other"], "Kitchen protection jar"),
    { name: "purpose", label: "Purpose / intention", type: "textarea", rows: 2 },
    ...timing,
    { name: "timing", label: "Best day or time", type: "text", placeholder: "Sunday at sunrise" },
    { name: "ingredients", label: "Ingredients", type: "textarea", rows: 3, hint: "One per line." },
    { name: "tools", label: "Tools", type: "textarea", rows: 2 },
    { name: "instructions", label: "Instructions", type: "textarea", rows: 5 },
    { name: "words", label: "Words / incantation", type: "textarea", rows: 3 },
    { name: "results", label: "Results & reflections", type: "textarea", rows: 2 },
    { name: "notes", label: "Notes", type: "textarea", rows: 2 },
    { name: "source", label: "Source / credit", type: "text", full: true },
  ],
  ritual: [
    ...common(["moon", "sabbat", "cleansing", "blessing", "protection", "life_event", "ancestor", "seasonal", "daily", "other"], "Full moon release"),
    { name: "purpose", label: "Purpose", type: "textarea", rows: 2 },
    ...timing,
    { name: "duration", label: "Duration", type: "text", placeholder: "30 minutes" },
    { name: "participants", label: "Participants", type: "text", placeholder: "Solo, family, coven…" },
    { name: "materials", label: "Materials", type: "textarea", rows: 3 },
    { name: "preparation", label: "Preparation", type: "textarea", rows: 3 },
    { name: "steps", label: "Steps", type: "textarea", rows: 6, hint: "One step per line." },
    { name: "closing", label: "Closing", type: "textarea", rows: 2 },
    { name: "notes", label: "Notes", type: "textarea", rows: 2 },
    { name: "source", label: "Source / credit", type: "text", full: true },
  ],
  crystal: [
    ...common(["Earth", "Water", "Fire", "Air", "All"]),
    { name: "color", label: "Color", type: "text" },
    { name: "chakra", label: "Chakra", type: "text" },
    { name: "element", label: "Element", type: "text" },
    { name: "zodiac", label: "Zodiac", type: "text" },
    { name: "properties", label: "Metaphysical properties", type: "textarea", rows: 2 },
    { name: "uses", label: "Uses", type: "textarea", rows: 2 },
    { name: "cleansing", label: "Cleansing", type: "text" },
    { name: "charging", label: "Charging", type: "text" },
    { name: "care", label: "Care & water safety", type: "textarea", rows: 2 },
    { name: "safety", label: "Safety", type: "textarea", rows: 2 },
    { name: "notes", label: "Notes", type: "textarea", rows: 2 },
  ],
  herb: [
    { name: "name", label: "Name", type: "text", required: true },
    { name: "category", label: "Safety level", type: "select", options: SAFETY_LEVELS, required: true },
    { name: "emoji", label: "Symbol (emoji)", type: "text" },
    { name: "image", label: "Image", type: "image" },
    { name: "description", label: "Description", type: "textarea", rows: 2 },
    { name: "botanicalName", label: "Botanical name", type: "text" },
    { name: "partsUsed", label: "Parts used", type: "text" },
    { name: "element", label: "Element", type: "text" },
    { name: "planet", label: "Planet", type: "text" },
    { name: "magicalUses", label: "Magical uses (folklore)", type: "textarea", rows: 2 },
    { name: "folklore", label: "Folklore & history", type: "textarea", rows: 2 },
    { name: "traditionalUse", label: "Traditional / culinary use", type: "textarea", rows: 2 },
    { name: "safety", label: "Safety & interactions", type: "textarea", rows: 2, hint: "Pregnancy, allergies, medication interactions, toxicity." },
    { name: "petSafety", label: "Pet safety", type: "textarea", rows: 2 },
    { name: "growing", label: "Growing notes", type: "textarea", rows: 2 },
    { name: "notes", label: "Notes", type: "textarea", rows: 2 },
  ],
  tool: [
    ...common(["Air", "Fire", "Water", "Earth", "Spirit", "Tool"]),
    { name: "purpose", label: "Purpose", type: "textarea", rows: 2 },
    { name: "uses", label: "How it's used", type: "textarea", rows: 2 },
    { name: "care", label: "Care & consecration", type: "textarea", rows: 2 },
    { name: "history", label: "History", type: "textarea", rows: 2 },
    { name: "notes", label: "Notes", type: "textarea", rows: 2 },
  ],
  wellness: [
    ...common(["meditation", "breathwork", "journaling", "bath_ritual", "grounding", "gratitude", "sleep", "movement", "other"], "Grounding tree meditation"),
    { name: "intention", label: "Intention", type: "textarea", rows: 2 },
    ...timing,
    { name: "duration", label: "Duration", type: "text" },
    { name: "steps", label: "Practice", type: "textarea", rows: 5 },
    { name: "prompts", label: "Journal prompts", type: "textarea", rows: 3 },
    { name: "notes", label: "Notes", type: "textarea", rows: 2 },
  ],
};

export const SAFETY_TONE: Record<string, "primary" | "olive" | "wine"> = { generally_safe: "primary", caution: "olive", toxic: "wine" };
export const SAFETY_LABEL: Record<string, string> = { generally_safe: "Generally safe", caution: "Use with caution", toxic: "Toxic — reference only" };

export const COLLECTION_FIELDS: FieldDef[] = [
  { name: "status", label: "Status", type: "select", options: opts("owned", ["wishlist", "Wish list"], "gifted"), required: true },
  { name: "quantity", label: "Quantity", type: "number" },
  { name: "acquiredOn", label: "Acquired", type: "date" },
  { name: "location", label: "Kept where", type: "text", placeholder: "Bedroom altar" },
  { name: "photo", label: "Photo of yours", type: "image" },
  { name: "notes", label: "Notes", type: "textarea", rows: 2 },
];

export const CELEBRATION_FIELDS: FieldDef[] = [
  { name: "name", label: "Celebration", type: "text", required: true, placeholder: "Family Samhain supper" },
  { name: "sabbat", label: "Sabbat", type: "select", options: SABBAT_OPTIONS },
  { name: "date", label: "Date", type: "date", required: true },
  { name: "budgetCents", label: "Budget ($)", type: "money" },
  { name: "image", label: "Image", type: "image" },
  { name: "guestList", label: "Guests", type: "textarea", rows: 2 },
  { name: "decorations", label: "Decorations", type: "textarea", rows: 2 },
  { name: "activities", label: "Activities", type: "textarea", rows: 2 },
  { name: "ritualPlan", label: "Ritual plan", type: "textarea", rows: 3 },
  { name: "supplies", label: "Supplies & shopping", type: "textarea", rows: 3, hint: "One per line. You can send these to a shopping list." },
  { name: "notes", label: "Notes", type: "textarea", rows: 2 },
];

export const GRIMOIRE_CATEGORIES = opts("reflection", ["moon_log", "Moon log"], ["dream", "Dream journal"], ["tarot", "Tarot reading"], ["sabbat", "Sabbat notes"], ["spell_log", "Spell log"], ["correspondence", "Correspondences"], "other");
