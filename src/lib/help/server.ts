import "server-only";
import { cache } from "react";
import { getViewer } from "@/lib/dal";
import { faithPathsOf } from "@/lib/faith-config";
import { helpFor, toHelpViewer } from ".";

/** The help this signed-in person may read (redirects to sign-in when signed out). */
export const getHelp = cache(async () => {
  const viewer = await getViewer();
  const help = helpFor(toHelpViewer(viewer, faithPathsOf(viewer.member, viewer.family).length > 0));
  return { viewer, ...help };
});
