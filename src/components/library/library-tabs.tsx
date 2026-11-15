import { BookLock, LibraryBig } from "lucide-react";
import { setLibrarySpace } from "@/app/actions/library";
import { LinkTabs } from "@/components/ui/tabs";
import type { LibrarySpace } from "@/lib/library";
import { cn } from "@/lib/utils";

/** Family Library ⇄ My Library (a private shelf only you can see). */
export function LibrarySpaceSwitch({ space }: { space: LibrarySpace }) {
  const btn = (value: LibrarySpace, label: string, Icon: typeof LibraryBig) => (
    <form action={setLibrarySpace}>
      <input type="hidden" name="space" value={value} />
      <button
        type="submit"
        aria-pressed={space === value}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium",
          space === value ? "bg-primary-600 text-white" : "text-ink-soft hover:bg-sunken",
        )}
      >
        <Icon className="size-4" aria-hidden /> {label}
      </button>
    </form>
  );
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="flex gap-1 rounded-full border border-line bg-surface p-1">
        {btn("family", "Family Library", LibraryBig)}
        {btn("mine", "My Library", BookLock)}
      </div>
      {space === "mine" && <p className="text-sm text-muted">Your personal books. Only you can see them.</p>}
    </div>
  );
}

export function LibraryTabs({ active, canEdit, space = "family" }: { active: string; canEdit?: boolean; space?: LibrarySpace }) {
  return (
    <>
      <LibrarySpaceSwitch space={space} />
      <LinkTabs
        active={active}
        tabs={[
          { key: "dashboard", href: "/library", label: "Dashboard" },
          { key: "books", href: "/library/books", label: space === "mine" ? "My books" : "All books" },
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
    </>
  );
}
