import { LinkTabs } from "@/components/ui/tabs";
import type { Viewer } from "@/lib/dal";

/**
 * Tabs for the Cleaning & Chores pages (chores, tasks, rewards, cleaning), the
 * same group as in the menu.
 */
export function ChoreTabs({ active, viewer }: { active: string; viewer: Viewer }) {
  const tabs = [
    viewer.can("chores") && { key: "chores", href: "/house/chores", label: "Chores" },
    viewer.can("chores") && { key: "tasks", href: "/house/tasks", label: "Tasks" },
    viewer.can("chores") && { key: "rewards", href: "/house/rewards", label: "Rewards" },
    viewer.can("cleaning") && { key: "cleaning", href: "/house/cleaning", label: "Cleaning" },
  ].filter(Boolean) as { key: string; href: string; label: string }[];
  return tabs.length > 1 ? <LinkTabs tabs={tabs} active={active} /> : null;
}

/** Tabs for the House overview: the other Household pages. */
export function HouseTabs({ active, viewer }: { active: string; viewer: Viewer }) {
  const tabs = [
    viewer.can("house") && { key: "overview", href: "/house", label: "Overview" },
    viewer.can("maintenance") && { key: "maintenance", href: "/maintenance", label: "Home maintenance" },
    viewer.can("projects") && { key: "projects", href: "/maintenance/projects", label: "House projects" },
    viewer.family.enabledModules.includes("info") && { key: "info", href: "/house/info", label: "Important info" },
  ].filter(Boolean) as { key: string; href: string; label: string }[];
  return tabs.length > 1 ? <LinkTabs tabs={tabs} active={active} /> : null;
}
