import type { Viewer } from "./dal";
import type { FoodSpace } from "./food-space";

/** First weekday (0 = Sunday … 6 = Saturday) of the meal planner's week in this space. Defaults to Monday. */
export function mealWeekStartsOn(viewer: Viewer, space: FoodSpace): number {
  const s = viewer.family.settings ?? {};
  const v = space.kind === "private" ? s.privateMealWeekStartsOn?.[space.memberId] : s.mealWeekStartsOn;
  return typeof v === "number" && v >= 0 && v <= 6 ? v : 1;
}
