import type { Module } from "@/db/schema/_shared";

export type CategoryDomain = "chore" | "budget" | "farm" | "garden" | "inventory" | "household" | "calendar";

export type OnboardingStep = {
  n: number;
  key: string;
  title: string;
  description: string;
  /** Modules the family can switch on/off on this step. */
  modules?: { module: Module; label: string; description: string }[];
  /** Quick-pick suggestions that become rows (rooms or categories). */
  picks?: { target: "rooms" | CategoryDomain; label: string; options: string[] };
};

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { n: 1, key: "family", title: "Create your family", description: "Give your household a name. You can change it any time." },
  { n: 2, key: "parents", title: "Add parents", description: "Parents are the admins: they manage members, permissions and settings." },
  { n: 3, key: "members", title: "Add family members", description: "Kids, grandparents, anyone in the household. Logins are optional; young kids can just appear on chore charts." },
  { n: 4, key: "permissions", title: "Set permissions", description: "Choose what each family member can see and edit. Sensible defaults are already set." },
  {
    n: 5,
    key: "home",
    title: "Set up your home",
    description: "Which rooms and spaces do you have? These organise cleaning and maintenance.",
    modules: [
      { module: "house", label: "House management", description: "Cleaning, chores and important home info" },
      { module: "maintenance", label: "Home maintenance & remodeling", description: "Systems, maintenance schedules, repairs, projects and warranties" },
    ],
    picks: {
      target: "rooms",
      label: "Rooms",
      options: ["Kitchen", "Living room", "Dining room", "Primary bedroom", "Kids' bedroom", "Bathroom", "Laundry", "Garage", "Office", "Basement", "Porch", "Yard"],
    },
  },
  {
    n: 6,
    key: "chores",
    title: "Set up chores",
    description: "Pick chore categories to start with. You'll create the chores themselves from the House area.",
    modules: [
      { module: "chores", label: "Chores", description: "Assign and track chores for everyone" },
      { module: "lists", label: "Lists", description: "Checklists and to-dos" },
      { module: "calendar", label: "Family calendar", description: "Shared events with per-person privacy" },
    ],
    picks: { target: "chore", label: "Chore categories", options: ["Kitchen", "Laundry", "Tidying", "Pets", "Outdoor", "Trash & recycling", "Bedrooms", "Bathrooms"] },
  },
  {
    n: 7,
    key: "kitchen",
    title: "Set up the kitchen",
    description: "Track food at home, plan meals and build smarter shopping lists.",
    modules: [
      { module: "kitchen", label: "Kitchen inventory", description: "Pantry, fridge, freezer and supplies" },
      { module: "recipes", label: "Recipes", description: "Your family recipe book" },
      { module: "meals", label: "Meal planning", description: "Weekly meal planner" },
      { module: "shopping", label: "Shopping lists", description: "Grouped by aisle, built from your plans" },
    ],
    picks: { target: "inventory", label: "Inventory categories", options: ["Baking", "Canned goods", "Grains & pasta", "Snacks", "Spices", "Beverages", "Condiments", "Cleaning supplies", "Paper goods"] },
  },
  {
    n: 8,
    key: "land",
    title: "Garden & farm",
    description: "Do you grow food or keep animals? Turn these on only if they apply to you.",
    modules: [
      { module: "garden", label: "Garden", description: "Plant database, bed planner and harvest log" },
      { module: "farm", label: "Farm", description: "Animals, production and farm map" },
    ],
    picks: { target: "farm", label: "Animals you keep", options: ["Chickens", "Ducks", "Goats", "Cows", "Sheep", "Pigs", "Rabbits", "Bees", "Horses"] },
  },
  {
    n: 9,
    key: "budget",
    title: "Set up your budget",
    description: "Pick the categories you spend on. Budget is visible to parents only by default.",
    modules: [{ module: "budget", label: "Budget", description: "Income, bills, expenses and savings" }],
    picks: {
      target: "budget",
      label: "Budget categories",
      options: ["Mortgage/Rent", "Utilities", "Groceries", "Transportation", "Insurance", "School", "Medical", "Entertainment", "Farm", "Garden", "Savings", "Other"],
    },
  },
  {
    n: 10,
    key: "goals",
    title: "Set your goals",
    description: "What is your family working toward? Add a first goal, or skip and add goals later.",
    modules: [
      { module: "goals", label: "Goals & savings", description: "6-month to 20-year goals with milestones" },
      { module: "fitness", label: "Fitness", description: "Workout plans and progress" },
      { module: "journal", label: "Journal", description: "Private or shared family journal" },
      { module: "reports", label: "Reports", description: "History and trends" },
      { module: "medical", label: "Medical & health", description: "Private health records, allergies, medications and appointments" },
      { module: "pets", label: "Pets", description: "Pet profiles, vet records, preventatives and care schedules" },
      { module: "witchcraft", label: "Witchcraft & spirituality", description: "Moon phases, Wheel of the Year, spells, crystals and herbs" },
    ],
  },
];

export const LAST_STEP = ONBOARDING_STEPS.length;

export const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Berlin",
  "Australia/Sydney",
  "Pacific/Auckland",
];
