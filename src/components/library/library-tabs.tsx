import { LinkTabs } from "@/components/ui/tabs";

export function LibraryTabs({ active, canEdit }: { active: string; canEdit?: boolean }) {
  return (
    <LinkTabs
      active={active}
      tabs={[
        { key: "dashboard", href: "/library", label: "Dashboard" },
        { key: "books", href: "/library/books", label: "All books" },
        { key: "reading", href: "/library/books?status=reading", label: "Currently reading" },
        { key: "categories", href: "/library/categories", label: "Categories" },
        ...(canEdit
          ? [
              { key: "scan", href: "/library/scan", label: "Scan barcode" },
              { key: "add", href: "/library/add", label: "Add manually" },
            ]
          : []),
      ]}
    />
  );
}
