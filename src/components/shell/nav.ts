import type { Viewer } from "@/lib/dal";
import { MODULE_META, NAV_GROUPS } from "@/lib/modules";

export type NavItem = { href: string; label: string; icon: string };
export type NavSection = { group: string; items: NavItem[] };

/** Builds the nav a viewer is allowed to see (permissions + enabled areas). */
export function buildNav(viewer: Viewer): NavSection[] {
  const sections: NavSection[] = NAV_GROUPS.map((group) => ({
    group,
    items: Object.values(MODULE_META)
      .filter((m) => m.group === group && m.inNav && viewer.can(m.id))
      .map((m) => ({ href: m.href, label: m.label, icon: m.icon })),
  }));
  sections[0]!.items.unshift({ href: "/", label: "Home", icon: "LayoutDashboard" });
  sections[1]!.items.unshift({ href: "/family", label: "Family", icon: "Users" });
  if (viewer.isParent) sections.push({ group: "Admin", items: [{ href: "/settings", label: "Settings", icon: "Settings" }] });
  return sections.filter((s) => s.items.length > 0);
}
