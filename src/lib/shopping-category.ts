/**
 * Grocery store sections and where groceries are stored. Pure module (shared
 * by lists, receipts, put-away and printing). Sections are listed in the
 * order most stores are walked: produce first, frozen near the end.
 */
export const SHOPPING_CATEGORY_KEYS = [
  "produce",
  "meat",
  "dairy",
  "pantry",
  "frozen",
  "household",
  "personal",
  "garden",
  "farm",
  "other",
  "bakery",
  "deli",
  "seafood",
  "breakfast",
  "canned",
  "baking",
  "condiments",
  "snacks",
  "beverages",
  "baby",
  "pet",
] as const;
export type ShoppingCategoryKey = (typeof SHOPPING_CATEGORY_KEYS)[number];

/** Store sections in walking order (labels shown on the list and the printout). */
export const SHOPPING_SECTIONS: { value: ShoppingCategoryKey; label: string; emoji: string }[] = [
  { value: "produce", label: "Produce", emoji: "🥬" },
  { value: "bakery", label: "Bakery & Bread", emoji: "🍞" },
  { value: "deli", label: "Deli", emoji: "🥪" },
  { value: "meat", label: "Meat", emoji: "🥩" },
  { value: "seafood", label: "Seafood", emoji: "🐟" },
  { value: "dairy", label: "Dairy & Eggs", emoji: "🥛" },
  { value: "breakfast", label: "Breakfast & Cereal", emoji: "🥣" },
  { value: "pantry", label: "Pasta, Rice & Dry Goods", emoji: "🍝" },
  { value: "canned", label: "Canned & Soups", emoji: "🥫" },
  { value: "baking", label: "Baking & Spices", emoji: "🧂" },
  { value: "condiments", label: "Condiments & Sauces", emoji: "🥫" },
  { value: "snacks", label: "Snacks", emoji: "🍿" },
  { value: "beverages", label: "Beverages", emoji: "🧃" },
  { value: "frozen", label: "Frozen", emoji: "🧊" },
  { value: "household", label: "Household & Cleaning", emoji: "🧻" },
  { value: "personal", label: "Health & Beauty", emoji: "🧴" },
  { value: "baby", label: "Baby", emoji: "🍼" },
  { value: "pet", label: "Pet", emoji: "🐾" },
  { value: "garden", label: "Garden", emoji: "🌱" },
  { value: "farm", label: "Farm & Feed", emoji: "🐓" },
  { value: "other", label: "Other", emoji: "🛒" },
];

/**
 * Most specific phrases first, so "peanut butter" isn't dairy, "ice cream"
 * isn't dairy, "chicken broth" isn't meat and "frozen peas" is frozen.
 */
const RULES: [ShoppingCategoryKey, string[]][] = [
  ["dairy", ["almond milk", "oat milk", "soy milk"]],
  ["frozen", ["frozen", "ice cream", "popsicle", "ice pop", "waffles", "tater tot", "fish stick", "pizza rolls", "frozen pizza", "ice"]],
  ["baby", ["diaper", "baby wipe", "wipes", "baby food", "formula", "pacifier", "pull-up", "pull ups"]],
  ["pet", ["dog food", "cat food", "cat litter", "litter", "dog treat", "cat treat", "pet food", "kibble", "flea"]],
  ["farm", ["chicken feed", "layer pellet", "scratch grains", "hay", "straw", "goat feed", "horse feed", "feed"]],
  ["garden", ["seeds", "potting soil", "soil", "mulch", "fertilizer", "compost", "plant food"]],
  ["condiments", ["peanut butter", "almond butter", "jelly", "jam", "ketchup", "mustard", "mayo", "mayonnaise", "relish", "salsa", "hot sauce", "bbq sauce", "barbecue sauce", "soy sauce", "dressing", "vinegar", "pickles", "honey", "syrup", "pasta sauce", "marinara", "pesto", "olive oil", "vegetable oil", "cooking spray"]],
  ["canned", ["broth", "stock", "soup", "canned", "can of", "beans", "chickpea", "tomato paste", "diced tomatoes", "tomato sauce", "tuna", "chili"]],
  ["baking", ["flour", "sugar", "baking soda", "baking powder", "yeast", "vanilla", "cocoa", "chocolate chips", "sprinkles", "cake mix", "brownie mix", "frosting", "cornstarch", "salt", "pepper flakes", "black pepper", "cinnamon", "paprika", "cumin", "oregano", "spice", "seasoning", "extract"]],
  ["breakfast", ["cereal", "oatmeal", "oats", "granola", "pancake mix", "pop-tart", "pop tart", "breakfast bar"]],
  ["beverages", ["water", "sparkling", "soda", "pop", "juice", "coffee", "tea", "lemonade", "sports drink", "gatorade", "kombucha", "wine", "beer", "seltzer", "drink mix"]],
  ["snacks", ["chips", "crackers", "pretzels", "popcorn", "cookies", "candy", "chocolate", "granola bar", "nuts", "pecan", "almond", "walnut", "cashew", "pistachio", "peanut", "trail mix", "fruit snacks", "goldfish", "jerky", "snack"]],
  ["bakery", ["bread", "bagel", "bun", "roll", "tortilla", "pita", "croissant", "muffin", "english muffin", "cake", "donut", "pie crust", "naan"]],
  ["deli", ["deli", "sliced turkey", "lunch meat", "lunchmeat", "salami", "pepperoni", "prosciutto", "hummus", "rotisserie"]],
  ["seafood", ["salmon", "shrimp", "fish", "cod", "tilapia", "crab", "lobster", "scallop", "mussels"]],
  ["meat", ["chicken", "beef", "pork", "turkey", "bacon", "sausage", "steak", "ham", "ground", "lamb", "hot dog", "meatball", "ribs", "brisket"]],
  ["dairy", ["milk", "cheese", "yogurt", "yoghurt", "butter", "cream", "egg", "sour cream", "cottage", "half and half", "creamer", "margarine"]],
  ["produce", ["apple", "banana", "lettuce", "tomato", "onion", "potato", "carrot", "berr", "fruit", "pepper", "garlic", "lemon", "lime", "spinach", "avocado", "herb", "cucumber", "celery", "grape", "orange", "broccoli", "salad", "cilantro", "parsley", "basil", "mushroom", "zucchini", "squash", "corn", "kale", "cabbage", "pear", "peach", "melon", "pineapple", "mango", "ginger", "green bean", "asparagus", "cauliflower", "veggie", "vegetable"]],
  ["household", ["paper towel", "toilet paper", "tissue", "napkin", "trash bag", "garbage bag", "detergent", "dish soap", "dishwasher", "bleach", "cleaner", "sponge", "foil", "plastic wrap", "ziploc", "zip bag", "light bulb", "battery", "batteries", "laundry", "dryer sheet", "soap"]],
  ["personal", ["shampoo", "conditioner", "toothpaste", "toothbrush", "floss", "deodorant", "razor", "lotion", "sunscreen", "vitamin", "medicine", "ibuprofen", "tylenol", "band-aid", "bandage", "tampon", "pads", "body wash", "makeup", "lip balm"]],
  ["pantry", ["rice", "pasta", "spaghetti", "noodle", "macaroni", "quinoa", "couscous", "lentil", "mac and cheese", "ramen", "breadcrumb", "stuffing"]],
];

/** Match whole words (and simple plurals), so "can" doesn't match "pecans". */
const hasWord = (text: string, word: string) => new RegExp(`(^|[^a-z])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(e?s)?([^a-z]|$)`).test(text);

/** Store section for a grocery item, from its name. */
export function guessShoppingCategory(text: string): ShoppingCategoryKey {
  const t = text.toLowerCase();
  for (const [cat, words] of RULES) if (words.some((w) => (w.endsWith("berr") ? t.includes(w) : hasWord(t, w)))) return cat;
  return "other";
}

/** The section to show an item under: its chosen section, or a fresh guess when it has none (or "other"). */
export const sectionFor = (item: { text: string; shoppingCategory: string | null }): ShoppingCategoryKey => {
  const c = item.shoppingCategory as ShoppingCategoryKey | null;
  return c && c !== "other" && SHOPPING_CATEGORY_KEYS.includes(c) ? c : guessShoppingCategory(item.text);
};

export type StorageLoc = "pantry" | "fridge" | "freezer" | "supplies" | "farm" | "garden" | "other";
/** Default storage place for a store section. */
export const locationForCategory = (cat: string | null): StorageLoc =>
  cat === "frozen"
    ? "freezer"
    : cat === "dairy" || cat === "meat" || cat === "seafood" || cat === "deli" || cat === "produce"
      ? "fridge"
      : cat === "household" || cat === "personal" || cat === "baby" || cat === "pet"
        ? "supplies"
        : cat === "farm"
          ? "farm"
          : cat === "garden"
            ? "garden"
            : "pantry";
