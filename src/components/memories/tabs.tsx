import { LinkTabs } from "@/components/ui/tabs";

export function MemoriesTabs({ active }: { active: "timeline" | "milestones" | "albums" | "favorites" | "dates" }) {
  return (
    <LinkTabs
      active={active}
      tabs={[
        { key: "timeline", href: "/memories", label: "Timeline" },
        { key: "milestones", href: "/memories?milestones=1", label: "Milestones" },
        { key: "albums", href: "/photos", label: "Albums" },
        { key: "favorites", href: "/memories/favorites", label: "Favorites" },
        { key: "dates", href: "/memories/dates", label: "Birthdays & anniversaries" },
      ]}
    />
  );
}
