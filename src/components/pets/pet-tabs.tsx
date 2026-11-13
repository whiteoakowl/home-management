import { LinkTabs } from "@/components/ui/tabs";

export function PetsTabs({ active }: { active: string }) {
  return (
    <LinkTabs
      active={active}
      tabs={[
        { key: "dashboard", href: "/pets", label: "Pet dashboard" },
        { key: "profiles", href: "/pets/profiles", label: "Pet profiles" },
        { key: "health", href: "/pets/health", label: "Medical records" },
        { key: "preventatives", href: "/pets/preventatives", label: "Preventatives" },
        { key: "supplies", href: "/pets/supplies", label: "Food & supplies" },
        { key: "care", href: "/pets/care", label: "Care schedule" },
        { key: "memories", href: "/pets/memories", label: "Memories" },
      ]}
    />
  );
}
