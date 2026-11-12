import type { AccessLevel, Module } from "@/db/schema/_shared";

export type NavGroup = "Today" | "Household" | "Kitchen" | "Land" | "Personal" | "Money";

export type ModuleMeta = {
  id: Module;
  label: string;
  href: string;
  /** lucide-react icon name, resolved in components/icons.tsx */
  icon: string;
  group: NavGroup;
  /** Build phase that delivers this module (see docs/ARCHITECTURE.md). */
  phase: number;
  /** Shown in nav? (chores and shopping live inside House / Kitchen). */
  inNav: boolean;
  defaultMemberAccess: AccessLevel;
  tagline: string;
  /** Things the area will hold; drives the "coming soon" empty state. */
  highlights: string[];
};

export const MODULE_META: Record<Module, ModuleMeta> = {
  calendar: {
    id: "calendar",
    label: "Calendar",
    href: "/calendar",
    icon: "CalendarDays",
    group: "Today",
    phase: 2,
    inNav: true,
    defaultMemberAccess: "edit",
    tagline: "One calendar for the whole family, with per-event privacy.",
    highlights: ["Day, week, month & agenda views", "Colour by person or category", "Choose exactly who can see each event"],
  },
  house: {
    id: "house",
    label: "House",
    href: "/house",
    icon: "House",
    group: "Household",
    phase: 2,
    inNav: true,
    defaultMemberAccess: "view",
    tagline: "Cleaning, maintenance, projects and important home info.",
    highlights: ["Daily → annual cleaning schedules", "Maintenance & seasonal tasks", "Home documents & key info"],
  },
  chores: {
    id: "chores",
    label: "Chores",
    href: "/house/chores",
    icon: "ListChecks",
    group: "Household",
    phase: 2,
    inNav: false,
    defaultMemberAccess: "edit",
    tagline: "Assign, repeat and track chores for everyone.",
    highlights: ["Recurring chores", "Checklists per person", "Completion history"],
  },
  lists: {
    id: "lists",
    label: "Lists",
    href: "/lists",
    icon: "ClipboardList",
    group: "Household",
    phase: 2,
    inNav: true,
    defaultMemberAccess: "edit",
    tagline: "Checklists, to-dos and anything else worth writing down.",
    highlights: ["Checklist, bullet, numbered & to-do lists", "Assign items and set due dates", "Custom categories"],
  },
  kitchen: {
    id: "kitchen",
    label: "Kitchen",
    href: "/kitchen",
    icon: "Refrigerator",
    group: "Kitchen",
    phase: 3,
    inNav: true,
    defaultMemberAccess: "view",
    tagline: "Know what's in the pantry, fridge and freezer.",
    highlights: ["Barcode scanning", "Gentle expiration alerts", "Low-stock → shopping list"],
  },
  meals: {
    id: "meals",
    label: "Meals",
    href: "/meals",
    icon: "UtensilsCrossed",
    group: "Kitchen",
    phase: 3,
    inNav: true,
    defaultMemberAccess: "edit",
    tagline: "Plan the week's meals and shop only for what's missing.",
    highlights: ["Weekly breakfast / lunch / dinner grid", "Checks recipes against inventory", "Auto-builds the shopping list"],
  },
  recipes: {
    id: "recipes",
    label: "Recipes",
    href: "/recipes",
    icon: "BookOpen",
    group: "Kitchen",
    phase: 3,
    inNav: true,
    defaultMemberAccess: "edit",
    tagline: "Your family's recipe book, collected in one place.",
    highlights: ["Photos, ratings & collections", "Printable recipe books", "Add to meal plan in one tap"],
  },
  shopping: {
    id: "shopping",
    label: "Shopping",
    href: "/shopping",
    icon: "ShoppingBasket",
    group: "Kitchen",
    phase: 3,
    inNav: false,
    defaultMemberAccess: "view",
    tagline: "Smart shopping lists grouped by aisle.",
    highlights: ["Items from recipes & low stock", "Multiple lists & stores", "Check off as you shop"],
  },
  garden: {
    id: "garden",
    label: "Garden",
    href: "/garden",
    icon: "Sprout",
    group: "Land",
    phase: 4,
    inNav: true,
    defaultMemberAccess: "view",
    tagline: "Plan beds, track plantings and log every harvest.",
    highlights: ["Plant database", "Drag-and-drop garden blueprint", "Harvests flow into the kitchen"],
  },
  farm: {
    id: "farm",
    label: "Farm",
    href: "/farm",
    icon: "Tractor",
    group: "Land",
    phase: 4,
    inNav: true,
    defaultMemberAccess: "view",
    tagline: "Animals, production records and your farm map.",
    highlights: ["Animal records & health", "Egg, milk & honey tracking", "Drag-and-drop farm blueprint"],
  },
  journal: {
    id: "journal",
    label: "Journal",
    href: "/journal",
    icon: "NotebookPen",
    group: "Personal",
    phase: 5,
    inNav: true,
    defaultMemberAccess: "edit",
    tagline: "A private or shared place for the moments worth keeping.",
    highlights: ["Private or shared entries", "Photos, moods & tags", "Timeline & calendar browsing"],
  },
  goals: {
    id: "goals",
    label: "Goals",
    href: "/goals",
    icon: "Target",
    group: "Personal",
    phase: 5,
    inNav: true,
    defaultMemberAccess: "edit",
    tagline: "Savings, family and personal goals, 6 months to 20 years out.",
    highlights: ["Milestones & progress bars", "Monthly contribution tracking", "Linked to your budget"],
  },
  fitness: {
    id: "fitness",
    label: "Fitness",
    href: "/fitness",
    icon: "Dumbbell",
    group: "Personal",
    phase: 5,
    inNav: true,
    defaultMemberAccess: "edit",
    tagline: "Workout plans, progress and a simple food journal.",
    highlights: ["Weekly workout schedule", "Sets, reps & personal records", "Food journal linked to meals"],
  },
  budget: {
    id: "budget",
    label: "Budget",
    href: "/budget",
    icon: "Wallet",
    group: "Money",
    phase: 6,
    inNav: true,
    defaultMemberAccess: "none",
    tagline: "Income, bills, expenses and savings at a glance.",
    highlights: ["Custom budget categories", "Income vs. expenses charts", "Savings rate tracking"],
  },
  reports: {
    id: "reports",
    label: "Reports",
    href: "/reports",
    icon: "ChartColumn",
    group: "Money",
    phase: 7,
    inNav: true,
    defaultMemberAccess: "none",
    tagline: "History and trends across the whole household.",
    highlights: ["Cleaning, garden & farm history", "Kitchen waste", "Budget, fitness & goal progress"],
  },
};

export const NAV_GROUPS: NavGroup[] = ["Today", "Household", "Kitchen", "Land", "Personal", "Money"];

export function moduleByHref(href: string): ModuleMeta | undefined {
  return Object.values(MODULE_META).find((m) => m.href === href);
}
