import type { Viewer } from "@/lib/dal";
import { MODULE_META, NAV_GROUPS } from "@/lib/modules";

export type NavItem = { href: string; label: string; icon: string; children?: { href: string; label: string }[] };

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
  "/spiritual": [
    { href: "/spiritual", label: "Dashboard" },
    { href: "/spiritual/moon", label: "Moon phases" },
    { href: "/spiritual/wheel", label: "Wheel of the Year" },
    { href: "/spiritual/celebrations", label: "Celebrations" },
    { href: "/spiritual/library/spell", label: "Spells" },
    { href: "/spiritual/library/ritual", label: "Rituals" },
    { href: "/spiritual/grimoire", label: "Grimoire" },
    { href: "/spiritual/library/crystal", label: "Crystals" },
    { href: "/spiritual/library/herb", label: "Herbs" },
    { href: "/spiritual/library/tool", label: "Tools" },
    { href: "/spiritual/library/wellness", label: "Spiritual wellness" },
    { href: "/spiritual/supplies", label: "Supplies" },
  ],
  "/library": [
    { href: "/library", label: "Dashboard" },
    { href: "/library/books", label: "All books" },
    { href: "/library/books?status=reading", label: "Currently reading" },
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
const FOOD_LABELS = { kitchen: { mine: "My Pantry" }, recipes: { mine: "My Recipes" }, meals: { mine: "My Meal Plans" }, shopping: { mine: "My Shopping List" } } as const;

export function buildNav(viewer: Viewer): NavSection[] {
  const sections: NavSection[] = NAV_GROUPS.map((group) => ({
    group,
    items: Object.values(MODULE_META)
      // Members with a private food space reach the food pages even without family access.
      .filter((m) => m.group === group && m.inNav && (viewer.can(m.id) || (FOOD_MODULES.includes(m.id) && viewer.member.privateFood)))
      .map((m) => ({ href: viewer.can(m.id) ? m.href : `${m.href}?space=mine`, label: viewer.can(m.id) ? m.label : (FOOD_LABELS[m.id as keyof typeof FOOD_LABELS]?.mine ?? m.label), icon: m.icon, children: SUBMENUS[m.href] })),
  }));
  sections[0]!.items.unshift({ href: "/", label: "Home", icon: "LayoutDashboard" });
  sections[1]!.items.unshift({ href: "/family", label: "Family", icon: "Users" });
  if (viewer.isParent) sections.push({ group: "Admin", items: [{ href: "/settings", label: "Settings", icon: "Settings" }] });
  return sections.filter((s) => s.items.length > 0);
}
