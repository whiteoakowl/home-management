/** Shopping aisles and where groceries are stored. Pure module (shared by lists, receipts, put-away). */
export const SHOPPING_CATEGORY_KEYS = ["produce", "meat", "dairy", "pantry", "frozen", "household", "personal", "garden", "farm", "other"] as const;
export type ShoppingCategoryKey = (typeof SHOPPING_CATEGORY_KEYS)[number];

/** Very small keyword classifier for shopping aisles. */
export function guessShoppingCategory(text: string): ShoppingCategoryKey {
  const t = text.toLowerCase();
  const has = (words: string[]) => words.some((w) => t.includes(w));
  if (has(["apple", "banana", "lettuce", "tomato", "onion", "potato", "carrot", "berr", "fruit", "pepper", "garlic", "lemon", "lime", "spinach", "avocado", "herb", "cucumber", "celery", "grape", "orange", "broccoli", "salad"])) return "produce";
  if (has(["chicken", "beef", "pork", "turkey", "bacon", "sausage", "fish", "salmon", "steak", "ham", "ground", "shrimp", "tuna"])) return "meat";
  if (has(["milk", "cheese", "yogurt", "yoghurt", "butter", "cream", "egg"])) return "dairy";
  if (has(["frozen", "ice cream", "peas", "pizza"])) return "frozen";
  if (has(["soap", "detergent", "paper towel", "toilet", "trash bag", "sponge", "bleach", "foil", "wrap", "napkin", "tissue"])) return "household";
  if (has(["shampoo", "toothpaste", "deodorant", "razor", "lotion", "vitamin"])) return "personal";
  if (has(["seed", "soil", "mulch", "fertilizer", "compost"])) return "garden";
  if (has(["feed", "hay", "straw", "bedding", "layer pellet", "scratch"])) return "farm";
  if (has(["flour", "sugar", "rice", "pasta", "bean", "oil", "salt", "cereal", "bread", "sauce", "spice", "oat", "can", "coffee", "tea", "soup", "chip", "cracker", "peanut", "juice"])) return "pantry";
  return "other";
}

export type StorageLoc = "pantry" | "fridge" | "freezer" | "supplies" | "farm" | "garden" | "other";
/** Default storage place for an aisle. */
export const locationForCategory = (cat: string | null): StorageLoc =>
  cat === "frozen" ? "freezer" : cat === "dairy" || cat === "meat" || cat === "produce" ? "fridge" : cat === "household" || cat === "personal" ? "supplies" : cat === "farm" ? "farm" : cat === "garden" ? "garden" : "pantry";
