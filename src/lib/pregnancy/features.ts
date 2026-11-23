/**
 * Which Pregnancy Tracker features are Free and which need Premium. This is
 * the one place to change it: every page and server action checks through
 * `pregnancyFeature`, using the app's existing plan (viewer.premium). No
 * prices or payment logic here.
 */
export type PregnancyFeature =
  | "tracker"
  | "weeks"
  | "appointments"
  | "questions"
  | "symptoms"
  | "mood"
  | "weight"
  | "measurements"
  | "kicks"
  | "contractions"
  | "medications"
  | "nutrition"
  | "sleep"
  | "journal"
  | "photos"
  | "documents"
  | "names"
  | "checklists"
  | "birthPlan"
  | "postpartum"
  | "timeline"
  | "reminders";

export const PREGNANCY_FEATURES: Record<PregnancyFeature, "free" | "premium"> = {
  tracker: "free",
  weeks: "free",
  appointments: "free",
  questions: "free",
  symptoms: "free",
  mood: "free",
  weight: "free",
  measurements: "free",
  kicks: "free",
  contractions: "free",
  medications: "free",
  nutrition: "premium",
  sleep: "premium",
  journal: "premium",
  photos: "premium",
  documents: "premium",
  names: "premium",
  checklists: "premium",
  birthPlan: "premium",
  postpartum: "premium",
  timeline: "premium",
  reminders: "free",
};

export const PREGNANCY_FEATURE_LABEL: Record<PregnancyFeature, string> = {
  tracker: "Pregnancy tracking",
  weeks: "Week-by-week guide",
  appointments: "Appointments",
  questions: "Questions for your provider",
  symptoms: "Symptom tracker",
  mood: "Mood tracker",
  weight: "Weight tracker",
  measurements: "Health logs",
  kicks: "Kick counter",
  contractions: "Contraction timer",
  medications: "Medicines & supplements",
  nutrition: "Nutrition & hydration",
  sleep: "Sleep tracker",
  journal: "Pregnancy journal",
  photos: "Bump & photo journal",
  documents: "Pregnancy documents",
  names: "Baby names",
  checklists: "Preparation checklists",
  birthPlan: "Birth Preferences Plan",
  postpartum: "Postpartum preparation",
  timeline: "Timeline & search",
  reminders: "Reminders",
};

/** May this family use the feature? (Premium covers paid plans and the free trial.) */
export const pregnancyFeature = (viewer: { premium: boolean }, f: PregnancyFeature) => PREGNANCY_FEATURES[f] === "free" || viewer.premium;
