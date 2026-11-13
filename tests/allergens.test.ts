import { test } from "node:test";
import assert from "node:assert/strict";
import { expandKeyword, ingredientMatches } from "../src/lib/allergen-groups";

const flags = (ingredient: string, keyword: string) => expandKeyword(keyword).some((k) => ingredientMatches(ingredient, k));

test("groups expand", () => {
  assert.ok(flags("mozzarella", "cheese"));
  assert.ok(flags("unsalted butter", "dairy"));
  assert.ok(flags("all-purpose flour", "gluten"));
  assert.ok(flags("chopped walnuts", "tree nuts"));
  assert.ok(flags("shrimp", "shellfish"));
  assert.ok(flags("2 large eggs", "egg"));
});

test("substring and plural matches", () => {
  assert.ok(flags("buttermilk", "milk"));
  assert.ok(flags("peanuts", "peanut"));
  assert.ok(flags("creamy peanut butter", "peanut"));
});

test("avoids obvious false positives", () => {
  assert.ok(!flags("nutmeg", "nut"));
  assert.ok(!flags("eggplant", "egg"));
  assert.ok(!flags("spinach", "dairy"));
  assert.ok(!flags("coconut milk", "peanut"));
});
