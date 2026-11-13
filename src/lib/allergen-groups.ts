import { namesMatch, normalizeName } from "./ingredients";

/**
 * Common allergen / food-group expansions so a restriction on "cheese" also
 * flags "mozzarella", "dairy" flags "butter", and so on. Deliberately broad:
 * a false warning is better than a missed one. Pure module (unit-tested).
 */
const CHEESES = ["cheese", "mozzarella", "parmesan", "cheddar", "ricotta", "feta", "brie", "gouda", "provolone", "swiss", "monterey jack", "colby", "cream cheese", "mascarpone", "goat cheese", "queso", "pecorino", "gruyere", "romano", "cottage cheese", "american cheese"];
const DAIRY = ["milk", "butter", "cream", "yogurt", "yoghurt", "buttermilk", "ghee", "whey", "casein", "half and half", "ice cream", "sour cream", "custard", ...CHEESES];
const TREE_NUTS = ["almond", "walnut", "pecan", "cashew", "pistachio", "hazelnut", "macadamia", "brazil nut", "pine nut", "praline", "marzipan", "nutella", "chestnut"];
const GLUTEN = ["wheat", "flour", "bread", "pasta", "noodle", "breadcrumb", "panko", "couscous", "barley", "rye", "semolina", "spelt", "farro", "bulgur", "cracker", "tortilla", "pie crust", "biscuit", "seitan", "malt"];
const SHELLFISH = ["shrimp", "prawn", "crab", "lobster", "crawfish", "crayfish", "scallop", "clam", "mussel", "oyster", "squid", "calamari"];
const FISH = ["fish", "salmon", "tuna", "cod", "tilapia", "halibut", "trout", "anchovy", "sardine", "mackerel", "catfish", "haddock", "fish sauce", "worcestershire"];

export const ALLERGEN_GROUPS: Record<string, string[]> = {
  dairy: DAIRY,
  milk: DAIRY,
  lactose: DAIRY,
  cheese: CHEESES,
  egg: ["egg", "mayonnaise", "mayo", "meringue", "aioli", "custard", "eggnog"],
  peanut: ["peanut", "peanut butter", "groundnut", "peanut oil"],
  "tree nut": TREE_NUTS,
  nut: [...TREE_NUTS, "peanut"],
  gluten: GLUTEN,
  wheat: GLUTEN,
  shellfish: SHELLFISH,
  fish: FISH,
  soy: ["soy", "soy sauce", "tofu", "edamame", "miso", "tempeh", "tamari", "soybean"],
  sesame: ["sesame", "tahini", "sesame oil", "hummus"],
  pork: ["pork", "bacon", "ham", "sausage", "prosciutto", "pancetta", "chorizo", "lard", "pepperoni"],
  beef: ["beef", "steak", "ground beef", "veal", "brisket"],
  meat: ["beef", "pork", "chicken", "turkey", "lamb", "bacon", "ham", "sausage", "veal", "venison", "duck"],
  corn: ["corn", "cornmeal", "cornstarch", "polenta", "grits", "corn syrup", "tortilla chip"],
  sugar: ["sugar", "honey", "syrup", "molasses", "agave", "candy", "chocolate"],
  nightshade: ["tomato", "potato", "pepper", "eggplant", "paprika", "chili", "cayenne"],
};

/** A keyword plus everything in its group(s). */
export function expandKeyword(keyword: string): string[] {
  const k = keyword.toLowerCase().trim().replace(/s$/, "");
  const out = new Set([keyword]);
  for (const [group, items] of Object.entries(ALLERGEN_GROUPS)) {
    if (k === group || k === `${group} allergy` || k === `${group}-free` || k === `no ${group}`) for (const i of items) out.add(i);
  }
  if (/lactose|dairy/.test(k)) for (const i of DAIRY) out.add(i);
  if (/gluten|celiac|coeliac/.test(k)) for (const i of GLUTEN) out.add(i);
  return [...out];
}

/**
 * Does an ingredient contain a keyword? Word-subset match, substring for longer
 * keywords ("milk" → "buttermilk"), word-start for short ones ("egg" → "eggs",
 * but "nut" does not flag "nutmeg"... it does flag "nuts").
 */
export function ingredientMatches(ingredient: string, keyword: string) {
  const a = normalizeName(ingredient);
  const b = normalizeName(keyword);
  if (!a || !b) return false;
  return namesMatch(ingredient, keyword) || (b.length >= 4 ? a.includes(b) : a.split(" ").some((w) => w === b || (w.startsWith(b) && w.length <= b.length + 2)));
}
