import "server-only";
import { farmPlans, gardenPlans } from "@/db/schema";
import { visibleTo, type Viewer } from "./dal";

/** Farm maps the viewer may see (family / selected people / Parents & me / Only me). */
export const farmPlanVisible = (viewer: Viewer) => visibleTo(viewer, { id: farmPlans.id, visibility: farmPlans.visibility, author: farmPlans.createdByMemberId }, "farm_plan");

/** Garden plans the viewer may see. */
export const gardenPlanVisible = (viewer: Viewer) => visibleTo(viewer, { id: gardenPlans.id, visibility: gardenPlans.visibility, author: gardenPlans.createdByMemberId }, "garden_plan");
