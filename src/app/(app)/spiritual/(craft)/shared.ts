import { redirect } from "next/navigation";
import { getViewer } from "@/lib/dal";
import { faithHref, faithPathsOf } from "@/lib/faith-config";

export async function craftViewer() {
  const viewer = await getViewer();
  if (!viewer.can("witchcraft")) redirect("/");
  // The Spiritual path is one of the religions parents give each person in Account settings.
  const paths = faithPathsOf(viewer.member, viewer.family);
  if (!paths.includes("spiritual")) redirect(paths.length ? faithHref(paths[0]!) : "/");
  return viewer;
}
