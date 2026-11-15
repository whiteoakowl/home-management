/**
 * Personal food journal vocabulary. Neutral by design: an awareness record, not a
 * diet tool. No "good"/"bad" foods, no targets, no restriction language.
 */
export const FOOD_MEALS = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snack" },
  { key: "dessert", label: "Dessert" },
  { key: "beverage", label: "Beverage" },
  { key: "other", label: "Other" },
] as const;
export type FoodMeal = (typeof FOOD_MEALS)[number]["key"];
export const mealLabel = (k: string | null) => FOOD_MEALS.find((m) => m.key === k)?.label ?? "Other";

/** Planner slot to store alongside the meal category (the planner only knows 4 slots). */
export const slotForMeal = (m: string): "breakfast" | "lunch" | "dinner" | "snack" => (m === "breakfast" || m === "lunch" || m === "dinner" ? m : "snack");

export const HUNGER_LEVELS = ["Very hungry", "Hungry", "Neutral", "A little hungry", "Not hungry"] as const;
export const FULLNESS_LEVELS = ["Still hungry", "A little full", "Comfortable", "Full", "Very full"] as const;
export const FOOD_FEELINGS = ["Satisfied", "Energized", "Content", "Happy", "Calm", "Social", "Tired", "Stressed", "Rushed", "Distracted"];
