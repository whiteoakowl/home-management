import { LinkTabs } from "@/components/ui/tabs";

export function CraftTabs({ active }: { active: string }) {
  return (
    <LinkTabs
      active={active}
      tabs={[
        { key: "dashboard", href: "/spiritual", label: "Dashboard" },
        { key: "moon", href: "/spiritual/moon", label: "Moon phases" },
        { key: "wheel", href: "/spiritual/wheel", label: "Wheel of the Year" },
        { key: "celebrations", href: "/spiritual/celebrations", label: "Celebrations" },
        { key: "spell", href: "/spiritual/library/spell", label: "Spells" },
        { key: "ritual", href: "/spiritual/library/ritual", label: "Rituals" },
        { key: "grimoire", href: "/spiritual/grimoire", label: "Grimoire" },
        { key: "devotions", href: "/spiritual/faith/spiritual/devotions", label: "Practice" },
        { key: "reading", href: "/spiritual/faith/spiritual/reading", label: "Reading" },
        { key: "crystal", href: "/spiritual/library/crystal", label: "Crystals" },
        { key: "herb", href: "/spiritual/library/herb", label: "Herbs" },
        { key: "tool", href: "/spiritual/library/tool", label: "Tools" },
        { key: "wellness", href: "/spiritual/library/wellness", label: "Spiritual wellness" },
        { key: "supplies", href: "/spiritual/supplies", label: "Supplies" },
      ]}
    />
  );
}
