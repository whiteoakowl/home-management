import { test } from "node:test";
import assert from "node:assert/strict";
import { durationMinutes, parseRecipeHtml, parseRecipeText, timersIn } from "../src/lib/recipe-import";

const page = `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage","name":"x"},{"@type":["Recipe"],"name":"Lemon &amp; Herb Chicken","description":"<p>Bright weeknight dinner.</p>","image":[{"@type":"ImageObject","url":"/img/chicken.jpg"}],"recipeYield":["4","4 servings"],"prepTime":"PT15M","cookTime":"PT1H5M","recipeCategory":"Dinner","keywords":"easy, chicken","recipeIngredient":["2 lb chicken thighs","1 lemon, zested","2 tbsp olive oil"],"recipeInstructions":[{"@type":"HowToSection","name":"Prep","itemListElement":[{"@type":"HowToStep","text":"Heat oven to 425°F."}]},{"@type":"HowToStep","text":"Roast 35&#8211;40 minutes."}]}]}</script></head></html>`;

test("schema.org recipe in @graph", () => {
  const r = parseRecipeHtml(page, "https://example.com/recipes/chicken")!;
  assert.equal(r.name, "Lemon & Herb Chicken");
  assert.equal(r.description, "Bright weeknight dinner.");
  assert.deepEqual(r.ingredients, ["2 lb chicken thighs", "1 lemon, zested", "2 tbsp olive oil"]);
  assert.deepEqual(r.instructions, ["Heat oven to 425°F.", "Roast 35–40 minutes."]);
  assert.equal(r.servings, 4);
  assert.equal(r.prepMinutes, 15);
  assert.equal(r.cookMinutes, 65);
  assert.equal(r.imageUrl, "https://example.com/img/chicken.jpg");
  assert.deepEqual(r.tags, ["dinner", "easy", "chicken"]);
});

test("no recipe → null", () => {
  assert.equal(parseRecipeHtml("<html><body>hello</body></html>"), null);
});

test("durations", () => {
  assert.equal(durationMinutes("PT1H30M"), 90);
  assert.equal(durationMinutes("P0DT0H20M"), 20);
  assert.equal(durationMinutes("nonsense"), null);
});

test("pasted text", () => {
  const r = parseRecipeText(`Grandma's Pancakes\nFluffy Sunday pancakes.\nServes 4\n\nIngredients\n- 2 cups flour\n- 2 eggs\n- 1 1/2 cups milk\n\nDirections\n1. Whisk everything together.\n2. Cook on a hot griddle 2-3 minutes per side.`)!;
  assert.equal(r.name, "Grandma's Pancakes");
  assert.equal(r.servings, 4);
  assert.deepEqual(r.ingredients, ["2 cups flour", "2 eggs", "1 1/2 cups milk"]);
  assert.equal(r.instructions.length, 2);
  assert.equal(r.description, "Fluffy Sunday pancakes.");
});

test("timers in steps", () => {
  assert.deepEqual(timersIn("Roast 35–40 minutes, then rest 5 min."), [
    { label: "35–40 minutes", seconds: 2400 },
    { label: "5 min", seconds: 300 },
  ]);
  assert.deepEqual(timersIn("Simmer for 1 hour"), [{ label: "1 hour", seconds: 3600 }]);
  assert.deepEqual(timersIn("Add 2 cups"), []);
});
