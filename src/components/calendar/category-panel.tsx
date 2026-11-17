"use client";

import { useState } from "react";
import { Tags, X } from "lucide-react";
import { CategoryManager } from "@/app/(app)/settings/forms";
import { Button } from "@/components/ui/button";

/** "Categories" button on the calendar: add, rename, recolour or delete event categories in place. */
export function CalendarCategoriesButton({ items }: { items: { id: string; name: string; color: string | null }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" icon={open ? <X className="size-4" /> : <Tags className="size-4" />} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? "Close categories" : "Categories"}
      </Button>
      {open && (
        <div className="basis-full">
          <CategoryManager domain="calendar" label="Event categories" items={items} />
          <p className="mt-2 text-xs text-muted">Shared with the whole family. A category&apos;s colour is used for its events unless an event has its own.</p>
        </div>
      )}
    </>
  );
}
