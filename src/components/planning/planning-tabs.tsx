import { LinkTabs } from "@/components/ui/tabs";
import type { Viewer } from "@/lib/dal";

/** Tabs across the Planning & Lists section: Goals, Lists, Travel and Party plans. */
export function PlanningTabs({ active, viewer }: { active: "goals" | "lists" | "travel" | "parties"; viewer: Viewer }) {
  const tabs = [
    viewer.can("goals") && { key: "goals", href: "/goals", label: "Goals" },
    viewer.can("lists") && { key: "lists", href: "/lists", label: "Lists" },
    viewer.can("plans") && { key: "travel", href: "/plans", label: "Travel" },
    viewer.can("parties") && { key: "parties", href: "/parties", label: "Party plans" },
  ].filter(Boolean) as { key: string; href: string; label: string }[];
  return tabs.length > 1 ? <LinkTabs tabs={tabs} active={active} /> : null;
}
