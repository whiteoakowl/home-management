import { redirect } from "next/navigation";
import { getViewer } from "@/lib/dal";

export async function craftViewer() {
  const viewer = await getViewer();
  if (!viewer.can("witchcraft")) redirect("/");
  return viewer;
}
