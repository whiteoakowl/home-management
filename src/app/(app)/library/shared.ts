import { notFound } from "next/navigation";
import { getViewer } from "@/lib/dal";
import { memberOptions } from "@/lib/queries";

export async function libraryViewer(level: "view" | "edit" = "view") {
  const viewer = await getViewer();
  if (!viewer.can("library", level)) notFound();
  return viewer;
}

export { memberOptions };
