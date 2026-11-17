/**
 * Ingredient keyword bank: groups of words that mean the same groceries, so a
 * recipe's "green onions" finds the pantry's "scallions". Families add their
 * own groups on top of these (Family Pantry → Keyword bank). Pure; tested.
 * Plain one-word names ("pepper", "milk") are left out on purpose: they would
 * tie together different things (black pepper / bell pepper, milk / almond milk).
 */
import { namesMatch, normalizeName } from "./ingredients";

export const BUILT_IN_SYNONYMS: string[][] = [
  ["scallion", "green onion", "spring onion"],
  ["cilantro", "coriander leaves", "fresh coriander"],
  ["garbanzo bean", "chickpea"],
  ["powdered sugar", "confectioners sugar", "icing sugar"],
  ["heavy cream", "heavy whipping cream", "whipping cream", "double cream"],
  ["half and half", "half & half"],
  ["zucchini", "courgette"],
  ["eggplant", "aubergine"],
  ["arugula", "rocket"],
  ["bell pepper", "sweet pepper", "capsicum"],
  ["ground beef", "hamburger meat", "minced beef", "beef mince"],
  ["ground turkey", "turkey mince"],
  ["cornstarch", "corn starch", "cornflour"],
  ["baking soda", "bicarbonate of soda", "bicarb"],
  ["all purpose flour", "plain flour", "ap flour"],
  ["self rising flour", "self raising flour"],
  ["shrimp", "prawn"],
  ["jelly", "jam", "preserves"],
  ["romaine", "romaine lettuce", "cos lettuce"],
  ["chili flakes", "red pepper flakes", "crushed red pepper"],
  ["green beans", "string beans", "snap beans"],
  ["snow peas", "mangetout"],
  ["beet", "beetroot"],
  ["molasses", "treacle"],
  ["parmesan", "parmigiano reggiano", "parmigiano"],
  ["semisweet chocolate chips", "chocolate chips", "chocolate morsels"],
  ["granulated sugar", "white sugar", "cane sugar"],
  ["brown sugar", "light brown sugar", "dark brown sugar"],
  ["unsalted butter", "salted butter"],
  ["whole milk", "vitamin d milk"],
  ["large egg", "extra large egg"],
  ["chicken broth", "chicken stock"],
  ["beef broth", "beef stock"],
  ["vegetable broth", "vegetable stock"],
  ["tomato sauce", "passata"],
  ["soy sauce", "shoyu", "tamari"],
  ["vegetable oil", "canola oil", "cooking oil"],
  ["kosher salt", "sea salt", "table salt"],
  ["black pepper", "ground black pepper", "cracked black pepper"],
];

/** Every name an item (or ingredient) may go by: itself, its tags, and keyword-bank partners. */
export function aliasesFor(name: string, tags: string[] = [], groups: string[][] = BUILT_IN_SYNONYMS): string[] {
  const out = new Set<string>([name, ...tags].map((x) => x.trim()).filter(Boolean));
  for (const base of [...out]) {
    const n = normalizeName(base);
    for (const g of groups) {
      // Exact (normalised) phrase match only, so "pepper" doesn't pull in every pepper.
      if (g.some((w) => normalizeName(w) === n)) for (const w of g) out.add(w);
    }
  }
  return [...out];
}

/** Does an ingredient match an item, counting each side's other names? */
export function matchesWithAliases(ingredient: string, itemNames: string[], groups: string[][] = BUILT_IN_SYNONYMS) {
  const ing = aliasesFor(ingredient, [], groups);
  return itemNames.some((n) => ing.some((i) => namesMatch(i, n)));
}
