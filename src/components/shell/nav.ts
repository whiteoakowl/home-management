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
  "/witchcraft": [
    { href: "/witchcraft", label: "Dashboard" },
    { href: "/witchcraft/moon", label: "Moon phases" },
    { href: "/witchcraft/wheel", label: "Wheel of the Year" },
    { href: "/witchcraft/celebrations", label: "Celebrations" },
    { href: "/witchcraft/library/spell", label: "Spells" },
    { href: "/witchcraft/library/ritual", label: "Rituals" },
    { href: "/witchcraft/grimoire", label: "Grimoire" },
    { href: "/witchcraft/library/crystal", label: "Crystals" },
    { href: "/witchcraft/library/herb", label: "Herbs" },
    { href: "/witchcraft/library/tool", label: "Tools" },
    { href: "/witchcraft/library/wellness", label: "Magical wellness" },
    { href: "/witchcraft/supplies", label: "Supplies" },
  ],
  "/maintenance": [
    { href: "/maintenance", label: "Dashboard" },
    { href: "/maintenance/rooms", label: "Rooms & systems" },
    { href: "/maintenance/schedule", label: "Maintenance schedule" },
    { href: "/maintenance/repairs", label: "Repair log" },
    { href: "/maintenance/projects", label: "Remodeling projects" },
    { href: "/maintenance/todo", label: "To-do lists" },
    { href: "/maintenance/documents", label: "Documents & warranties" },
    { href: "/maintenance/calendar", label: "Calendar" },
  ],
};
export type NavSection = { group: string; items: NavItem[] };

/** Builds the nav a viewer is allowed to see (permissions + enabled areas). */
export function buildNav(viewer: Viewer): NavSection[] {
  const sections: NavSection[] = NAV_GROUPS.map((group) => ({
    group,
    items: Object.values(MODULE_META)
      .filter((m) => m.group === group && m.inNav && viewer.can(m.id))
      .map((m) => ({ href: m.href, label: m.label, icon: m.icon, children: SUBMENUS[m.href] })),
  }));
  sections[0]!.items.unshift({ href: "/", label: "Home", icon: "LayoutDashboard" });
  sections[1]!.items.unshift({ href: "/family", label: "Family", icon: "Users" });
  if (viewer.isParent) sections.push({ group: "Admin", items: [{ href: "/settings", label: "Settings", icon: "Settings" }] });
  return sections.filter((s) => s.items.length > 0);
}
