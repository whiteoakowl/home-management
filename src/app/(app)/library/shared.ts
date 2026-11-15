import { notFound } from "next/navigation";
import { getViewer } from "@/lib/dal";
import { canAddBooks, currentLibrarySpace } from "@/lib/library";
import { memberOptions } from "@/lib/queries";

/** "edit" = may add books to the library that's open (the Family Library, or My Library). */
export async function libraryViewer(level: "view" | "edit" = "view") {
  const viewer = await getViewer();
  if (!viewer.can("library", "view")) notFound();
  const space = await currentLibrarySpace();
  if (level === "edit" && !canAddBooks(viewer, space)) notFound();
  return Object.assign(viewer, { librarySpace: space });
}

export { memberOptions };
