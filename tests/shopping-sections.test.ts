import { test } from "node:test";
import assert from "node:assert/strict";
import { guessShoppingCategory as g, sectionFor, SHOPPING_CATEGORY_KEYS, SHOPPING_SECTIONS } from "../src/lib/shopping-category";
import { shoppingCategory } from "../src/db/schema/lists";

test("items land in the right store section", () => {
  const cases: [string, string][] = [
    ["Bananas", "produce"], ["2 avocados", "produce"], ["Strawberries", "produce"],
    ["Sourdough bread", "bakery"], ["Hamburger buns", "bakery"], ["Tortillas", "bakery"],
    ["Ground beef", "meat"], ["Chicken breasts", "meat"], ["Salmon fillets", "seafood"], ["Shrimp", "seafood"],
    ["Sliced turkey deli", "deli"], ["Hummus", "deli"],
    ["Milk", "dairy"], ["Eggs", "dairy"], ["Cheddar cheese", "dairy"], ["Butter", "dairy"],
    ["Peanut butter", "condiments"], ["Ketchup", "condiments"],
    ["Ice cream", "frozen"], ["Frozen peas", "frozen"],
    ["Chicken broth", "canned"], ["Black beans", "canned"],
    ["Flour", "baking"], ["Cinnamon", "baking"],
    ["Cereal", "breakfast"], ["Oatmeal", "breakfast"],
    ["Coffee", "beverages"], ["Orange juice", "beverages"],
    ["Potato chips", "snacks"], ["Pecans", "snacks"],
    ["Spaghetti", "pantry"], ["Rice", "pantry"],
    ["Paper towels", "household"], ["Dish soap", "household"],
    ["Toothpaste", "personal"], ["Diapers", "baby"], ["Dog food", "pet"], ["Potting soil", "garden"],
    ["Mystery thing", "other"],
  ];
  for (const [text, want] of cases) assert.equal(g(text), want, text);
});

test("sections: every key has a section, matches the database, and 'other' is re-guessed", () => {
  assert.deepEqual([...SHOPPING_CATEGORY_KEYS].sort(), [...shoppingCategory.enumValues].sort());
  assert.deepEqual(SHOPPING_SECTIONS.map((s) => s.value).sort(), [...SHOPPING_CATEGORY_KEYS].sort());
  assert.equal(SHOPPING_SECTIONS[0]!.value, "produce");
  assert.equal(sectionFor({ text: "Bagels", shoppingCategory: "other" }), "bakery");
  assert.equal(sectionFor({ text: "Bagels", shoppingCategory: null }), "bakery");
  assert.equal(sectionFor({ text: "Bagels", shoppingCategory: "frozen" }), "frozen", "a chosen section wins");
});
