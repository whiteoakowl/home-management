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

/** Tabs for the House overview: everything that lives under House. */
export function HouseTabs({ active, viewer }: { active: string; viewer: Viewer }) {
  const tabs = [
    viewer.can("house") && { key: "overview", href: "/house", label: "Overview" },
    viewer.can("maintenance") && { key: "maintenance", href: "/maintenance", label: "Home maintenance" },
    viewer.can("projects") && { key: "projects", href: "/maintenance/projects", label: "House projects" },
    viewer.can("pool") && { key: "pool", href: "/pool", label: "Pool" },
    viewer.family.enabledModules.includes("info") && { key: "info", href: "/house/info", label: "Important info" },
    viewer.can("maintenance") && { key: "documents", href: "/maintenance/documents", label: "Documents" },
  ].filter(Boolean) as { key: string; href: string; label: string }[];
  return tabs.length > 1 ? <LinkTabs tabs={tabs} active={active} /> : null;
}
