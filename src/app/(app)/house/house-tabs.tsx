import { LinkTabs } from "@/components/ui/tabs";
import type { Viewer } from "@/lib/dal";

/** Sub-navigation shared by every House page. */
export function HouseTabs({ active, viewer }: { active: string; viewer: Viewer }) {
  const tabs = [
    viewer.can("house") && { key: "overview", href: "/house", label: "Overview" },
    viewer.can("chores") && { key: "tasks", href: "/house/tasks", label: "Tasks" },
    viewer.can("chores") && { key: "chores", href: "/house/chores", label: "Chores" },
    viewer.can("chores") && { key: "rewards", href: "/house/rewards", label: "Rewards" },
    viewer.can("cleaning") && { key: "cleaning", href: "/house/cleaning", label: "Cleaning" },
    viewer.can("maintenance") && { key: "maintenance", href: "/maintenance", label: "Maintenance ↗" },
    viewer.can("projects") && { key: "projects", href: "/maintenance/projects", label: "House projects ↗" },
    viewer.can("info") && { key: "info", href: "/house/info", label: "Important info" },
  ].filter(Boolean) as { key: string; href: string; label: string }[];
  return <LinkTabs tabs={tabs} active={active} />;
}
