import { LinkTabs } from "@/components/ui/tabs";

export function CraftTabs({ active }: { active: string }) {
  return (
    <LinkTabs
      active={active}
      tabs={[
        { key: "dashboard", href: "/witchcraft", label: "Dashboard" },
        { key: "moon", href: "/witchcraft/moon", label: "Moon phases" },
        { key: "wheel", href: "/witchcraft/wheel", label: "Wheel of the Year" },
        { key: "celebrations", href: "/witchcraft/celebrations", label: "Celebrations" },
        { key: "spell", href: "/witchcraft/library/spell", label: "Spells" },
        { key: "ritual", href: "/witchcraft/library/ritual", label: "Rituals" },
        { key: "grimoire", href: "/witchcraft/grimoire", label: "Grimoire" },
        { key: "crystal", href: "/witchcraft/library/crystal", label: "Crystals" },
        { key: "herb", href: "/witchcraft/library/herb", label: "Herbs" },
        { key: "tool", href: "/witchcraft/library/tool", label: "Tools" },
        { key: "wellness", href: "/witchcraft/library/wellness", label: "Magical wellness" },
        { key: "supplies", href: "/witchcraft/supplies", label: "Supplies" },
      ]}
    />
  );
}
