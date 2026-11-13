import { LinkTabs } from "@/components/ui/tabs";

export function MaintenanceTabs({ active }: { active: string }) {
  return (
    <LinkTabs
      active={active}
      tabs={[
        { key: "dashboard", href: "/maintenance", label: "Dashboard" },
        { key: "rooms", href: "/maintenance/rooms", label: "Rooms & systems" },
        { key: "schedule", href: "/maintenance/schedule", label: "Maintenance schedule" },
        { key: "repairs", href: "/maintenance/repairs", label: "Repair log" },
        { key: "projects", href: "/maintenance/projects", label: "Remodeling projects" },
        { key: "todo", href: "/maintenance/todo", label: "To-do lists" },
        { key: "documents", href: "/maintenance/documents", label: "Documents & warranties" },
        { key: "calendar", href: "/maintenance/calendar", label: "Calendar" },
      ]}
    />
  );
}
