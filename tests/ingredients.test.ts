import { test } from "node:test";
import assert from "node:assert/strict";
import { checkIngredients, formatQty, namesMatch, parseIngredientLine as p } from "../src/lib/ingredients";

test("parses quantities, units and names", () => {
  assert.deepEqual(p("2 eggs"), { original: "2 eggs", quantity: 2, unit: null, name: "eggs", optional: false });
  const flour = p("1 1/2 cups all-purpose flour, sifted")!;
  assert.equal(flour.quantity, 1.5);
  assert.equal(flour.unit, "cup");
  assert.equal(flour.name, "all-purpose flour");
  assert.equal(p("½ tsp salt")!.quantity, 0.5);
  assert.equal(p("2 large tomatoes, diced")!.name, "tomatoes");
  assert.equal(p("3 cloves garlic, minced")!.unit, "clove");
});

test("matches inventory names loosely", () => {
  assert.ok(namesMatch("eggs", "Large Eggs"));
  assert.ok(namesMatch("chicken breast", "Chicken"));
  assert.ok(!namesMatch("flour", "Tortillas"));
});

test("compares a recipe with the pantry (spec example)", () => {
  const inv = [
    { id: "1", name: "Eggs", quantity: "12", unit: null },
    { id: "2", name: "Flour", quantity: "4", unit: "cup" },
    { id: "3", name: "Tomatoes", quantity: "1", unit: null },
  ];
  const r = checkIngredients(
    [
      { name: "eggs", quantity: "2", unit: null },
      { name: "flour", quantity: "1", unit: "cup" },
      { name: "chicken", quantity: "1", unit: "lb" },
      { name: "tomatoes", quantity: "2", unit: null },
    ],
    inv,
  );
  assert.deepEqual(r.map((x) => x.have), [true, true, false, false]);
  assert.equal(r[3]!.shortBy, 1);
});

test("formats fractions", () => {
  assert.equal(formatQty(1.5), "1½");
  assert.equal(formatQty(0.25), "¼");
});
