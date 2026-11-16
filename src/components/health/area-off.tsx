import { notFound } from "next/navigation";

/**
 * An area a parent set to "No access" for this person (Period Tracker / Mental
 * Wellness) doesn't exist for them at all: no menu entry, no tab, and the page
 * itself is "not found". Nothing they saved is deleted.
 */
export function AreaOff({ label: _label }: { label: string }): never {
  notFound();
}
