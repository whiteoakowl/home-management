import { LinkTabs } from "@/components/ui/tabs";

export function FarmTabs({ active }: { active: string }) {
  return (
    <LinkTabs
      active={active}
      tabs={[
        { key: "overview", href: "/farm", label: "Overview" },
        { key: "animals", href: "/farm/animals", label: "Animals" },
        { key: "production", href: "/farm/production", label: "Production" },
      ]}
    />
  );
}
