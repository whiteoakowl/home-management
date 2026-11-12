import { LinkTabs } from "@/components/ui/tabs";

export function GardenTabs({ active }: { active: string }) {
  return (
    <LinkTabs
      active={active}
      tabs={[
        { key: "overview", href: "/garden", label: "Overview" },
        { key: "log", href: "/garden/log", label: "Plantings & log" },
        { key: "plants", href: "/garden/plants", label: "Plant database" },
        { key: "seeds", href: "/garden/seeds", label: "Seeds" },
      ]}
    />
  );
}
