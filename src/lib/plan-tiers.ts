/**
 * Free vs Premium. Pure rules (no DB), shared by the server and the UI.
 *
 * Every new family gets a free trial of everything (no card needed). Afterwards
 * a family without a paid plan is on Free: the everyday family hub stays free
 * forever; Premium sections stay visible, read-only, with everything saved, so
 * nothing is lost and it all comes back on upgrade.
 */
import type { Module } from "@/db/schema/_shared";

export type PlanTier = "premium" | "trial" | "free";

/** Always free: the daily family hub. */
export const FREE_MODULES: readonly Module[] = ["calendar", "shopping", "chores", "lists", "messages", "contacts", "info", "sounds"];

/** Everything else is Premium. */
export const isPremiumModule = (m: Module) => !FREE_MODULES.includes(m);

/** Limits on the Free plan. */
export const FREE_LIMITS = {
  /** Family members (active), including parents. */
  members: 6,
  /** Lists (to-do, packing, wishlists…). */
  lists: 5,
} as const;

/** Extras inside free sections that are Premium. */
export const PREMIUM_EXTRAS = {
  templates: "Event templates",
  reminders: "Timed event reminders",
  sync: "Calendar sync with Google, Outlook & Apple",
  rewards: "Chore points rewards",
  rotation: "Chore rotation",
  automations: "Automations",
} as const;
export type PremiumExtra = keyof typeof PREMIUM_EXTRAS;

/** Shown on the upgrade page, the website and in help. */
export const FREE_FEATURES = [
  "Shared family calendar with repeating events",
  "Grocery shopping list",
  "Chores with check-off and streaks, plus tasks",
  `Up to ${FREE_LIMITS.lists} lists`,
  "Family Chat and announcements",
  "Contacts",
  "Important Info (family binder)",
  `Up to ${FREE_LIMITS.members} family members, each with their own login`,
  "Phone notifications",
  "Personal Health, Food Journal and Mental Wellness",
  "Sleep Sounds: white & brown noise, rain, ocean and fan, with a sleep timer and favorites",
  "Download all your information",
];

export const PREMIUM_FEATURES = [
  "Meal plans, recipes (import & cook mode) and the Family Pantry",
  "Chore rewards, rotation and cleaning scores",
  "Budget, goals and reports",
  "Medical records, pets, vehicles, home maintenance and pool",
  "Garden and farm",
  "Sports, dance and work schedules",
  "Travel, party plans and the baby tracker",
  "Every Sleep Sound, the mixer, saved and shared mixes, presets, all timers and fade-out",
  "Calendar sync, event templates and timed reminders",
  "Automations",
  "Spiritual & faith tabs",
  "Journal, Book Library and Fitness",
  "Memories, milestones and photo albums",
  "Period Tracker",
  "Unlimited family members and lists",
];

/**
 * A family's tier. `billingOn` false (payments not set up) means everyone has
 * everything. `paid` = complimentary, active, Stripe trial or past-due (while
 * Stripe retries). Otherwise the no-card trial runs `trialDays` from when the
 * family was created.
 */
export function tierOf(opts: { billingOn: boolean; paid: boolean; familyCreatedAt: Date; trialDays: number; now?: Date }): { tier: PlanTier; trialEndsAt: Date | null; trialDaysLeft: number } {
  const now = opts.now ?? new Date();
  const trialEndsAt = opts.trialDays > 0 ? new Date(opts.familyCreatedAt.getTime() + opts.trialDays * 86_400_000) : null;
  const trialDaysLeft = trialEndsAt && trialEndsAt > now ? Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86_400_000) : 0;
  if (!opts.billingOn || opts.paid) return { tier: "premium", trialEndsAt, trialDaysLeft };
  if (trialDaysLeft > 0) return { tier: "trial", trialEndsAt, trialDaysLeft };
  return { tier: "free", trialEndsAt, trialDaysLeft: 0 };
}

/** Free-plan access cap: Premium sections become view-only. */
export function capForPlan<L extends string>(m: Module, level: L, premium: boolean): L | "view" | "none" {
  if (premium || !isPremiumModule(m) || level === "none") return level;
  return "view";
}

/** Website Features page: which sections are free, and the Premium tabs inside free sections. */
export const FREE_SECTION_NAMES = ["Sleep Sounds", "Home", "Calendar", "Family Chat", "Family", "Contacts", "House", "Lists", "Grocery Shopping", "Personal Health", "Mental Wellness", "Account settings", "Notifications", "Feedback & feature ideas"];
export const PREMIUM_TABS: Record<string, string[]> = {
  Calendar: ["Event templates", "Reminders", "Sync"],
  House: ["Overview", "Rewards", "Cleaning"],
  "Personal Health": ["Period tracker"],
  "Sleep Sounds": ["Mixer & my mixes", "Favorites, recents & presets"],
};
