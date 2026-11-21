import type { Viewer } from "@/lib/dal";
import { FAITH_META, faithHref, faithPathsOf } from "@/lib/faith-config";
import { MODULE_META, NAV_GROUPS } from "@/lib/modules";
import { isPremiumModule } from "@/lib/plan-tiers";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  children?: { href: string; label: string }[];
  /** Premium section on the Free plan (view-only): shows a small lock. */
  locked?: boolean;
};

/** Submenus for the larger areas (shown under the active item in the sidebar). */
export const SUBMENUS: Record<string, { href: string; label: string }[]> = {
  "/medical": [
    { href: "/medical", label: "Dashboard" },
    { href: "/medical/members", label: "Family members" },
    { href: "/medical/allergies", label: "Allergies" },
    { href: "/medical/diet", label: "Food restrictions" },
    { href: "/medical/conditions", label: "Conditions" },
    { href: "/medical/medications", label: "Medications" },
    { href: "/medical/documents", label: "Documents" },
    { href: "/medical/calendar", label: "Medical calendar" },
  ],
  "/pets": [
    { href: "/pets", label: "Pet dashboard" },
    { href: "/pets/profiles", label: "Pet profiles" },
    { href: "/pets/health", label: "Medical records" },
    { href: "/pets/preventatives", label: "Preventatives" },
    { href: "/pets/supplies", label: "Food & supplies" },
    { href: "/pets/care", label: "Care schedule" },
    { href: "/pets/memories", label: "Memories" },
  ],
  "/library": [
    { href: "/library", label: "Dashboard" },
    { href: "/library/books", label: "All books" },
    { href: "/library/reading", label: "Reading log" },
    { href: "/library/categories", label: "Categories" },
    { href: "/library/scan", label: "Scan barcode" },
    { href: "/library/add", label: "Add a book" },
  ],
  "/maintenance": [
    { href: "/maintenance", label: "Dashboard" },
    { href: "/maintenance/rooms", label: "Rooms & systems" },
    { href: "/maintenance/schedule", label: "Maintenance schedule" },
    { href: "/maintenance/repairs", label: "Repair log" },
    { href: "/maintenance/projects", label: "Remodeling projects" },
    { href: "/maintenance/todo", label: "To-do lists" },
    { href: "/maintenance/documents", label: "Documents & warranties" },
    { href: "/maintenance/inventory", label: "Home inventory" },
    { href: "/maintenance/vendors", label: "Service providers" },
    { href: "/maintenance/manual", label: "Household manual" },
    { href: "/maintenance/calendar", label: "Calendar" },
  ],
};
export type NavSection = { group: string; items: NavItem[] };

/** Builds the nav a viewer is allowed to see (permissions + enabled areas). */
const FOOD_MODULES: string[] = ["kitchen", "recipes", "meals", "shopping"];
const FOOD_LABELS = {
  kitchen: { mine: "My Pantry" },
  recipes: { mine: "My Recipes" },
  meals: { mine: "My Meal Plans" },
  shopping: { mine: "My Shopping List" },
} as const;

export function buildNav(viewer: Viewer): NavSection[] {
  const sections: NavSection[] = NAV_GROUPS.map((group) => ({
    group,
    items: Object.values(MODULE_META)
      // Members with a private food space reach the food pages even without family access.
      .filter(
        (m) =>
          m.group === group &&
          m.inNav &&
          (viewer.can(m.id) ||
            // Important Info: every family member can open it; each entry decides who sees it.
            (m.id === "info" && viewer.family.enabledModules.includes("info")) ||
            (FOOD_MODULES.includes(m.id) && viewer.member.privateFood) ||
            (m.id === "budget" && viewer.member.privateFinance) ||
            (m.id === "projects" &&
              viewer.member.privateProjects &&
              !viewer.isParent) ||
            (m.id === "vehicles" &&
              viewer.member.privateVehicles &&
              !viewer.isParent)),
      )
      .map((m) => ({ m, locked: !viewer.premium && isPremiumModule(m.id) }))
      .map(({ m, locked }) => ({ locked, ...(
        // Members never see the family budget; with a private money space they get "My Budget".
        m.id === "budget" && !viewer.can("budget")
          ? { href: "/budget?space=mine", label: "My Budget", icon: m.icon }
          : // A teen's own car: "My Vehicles" (parents can't see it).
            m.id === "vehicles" && !viewer.can("vehicles")
            ? { href: "/vehicles", label: "My Vehicles", icon: m.icon }
            : // Older kids with a home of their own: "My Home Projects" (parents can't see it).
              m.id === "projects" && !viewer.can("projects")
              ? {
                  href: "/maintenance/projects?space=mine",
                  label: "My Home Projects",
                  icon: m.icon,
                }
              : {
                  href: viewer.can(m.id) ? m.href : `${m.href}?space=mine`,
                  label: viewer.can(m.id)
                    ? m.label
                    : (FOOD_LABELS[m.id as keyof typeof FOOD_LABELS]?.mine ??
                      m.label),
                  icon: m.icon,
                  children: SUBMENUS[m.href],
                }) })),
  }));
  sections[0]!.items.unshift({
    href: "/",
    label: "Home",
    icon: "LayoutDashboard",
  });
  // Grocery Shopping sits right under Calendar.
  const today = sections[0]!.items;
  const shopAt = today.findIndex((i) => i.href.startsWith("/shopping"));
  const calAt = today.findIndex((i) => i.href === "/calendar");
  if (shopAt > -1) {
    const [shop] = today.splice(shopAt, 1);
    today.splice(calAt > -1 ? calAt + 1 : 1, 0, shop!);
  }
  // Cleaning & Chores: the chore board's Tasks and Rewards get their own menu entries.
  const chores = sections.find((s) => s.group === "Cleaning & Chores");
  if (chores && viewer.can("chores"))
    chores.items.push(
      { href: "/house/tasks", label: "Tasks", icon: "ListTodo" },
      { href: "/house/rewards", label: "Rewards", icon: "Trophy" },
    );
  // Personal spaces belong to each person (private unless shared), so everyone has them.
  const personal = sections.find((s) => s.group === "Personal");
  const hidden = viewer.member.hiddenAreas;
  const mine: NavItem[] = [
    {
      href: "/health",
      label: "Personal Health",
      icon: "HeartPulse",
      children: [
        { href: "/health", label: "Overview" },
        ...(hidden.includes("period")
          ? []
          : [{ href: "/health/period", label: "Period Tracker" }]),
        { href: "/privacy", label: "Privacy Center" },
      ],
    },
    { href: "/health/food", label: "Food Journal", icon: "Utensils" },
    ...(hidden.includes("wellness")
      ? []
      : [{ href: "/wellness", label: "Mental Wellness", icon: "Smile" }]),
  ];
  if (personal) personal.items.unshift(...mine);
  // Spiritual: one entry per path the member chose (none = hidden from their menu).
  const paths = faithPathsOf(viewer.member, viewer.family);
  for (const sec of sections) {
    const at = sec.items.findIndex((i) => i.href === "/spiritual");
    if (at < 0) continue;
    if (!paths.length) sec.items.splice(at, 1);
    else sec.items[at] = { ...sec.items[at]!, children: paths.length > 1 ? paths.map((f) => ({ href: faithHref(f), label: FAITH_META[f].tab })) : undefined };
  }
  sections[1]!.items.unshift({
    href: "/family",
    label: "Family",
    icon: "Users",
  });
  if (viewer.isParent)
    sections.push({
      group: "Admin",
      items: [{ href: "/settings", label: "Account settings", icon: "Settings" }],
    });
  // Everyone can reach the Help Center.
  sections.push({ group: "Help", items: [{ href: "/help", label: "Help & Support", icon: "LifeBuoy" }] });
  return sections.filter((s) => s.items.length > 0);
}
