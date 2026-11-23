import { test } from "node:test";
import assert from "node:assert/strict";
import { splitSpokenItems, tidyItem } from "../src/lib/voice-list";

test("splits a spoken grocery list into items", () => {
  assert.deepEqual(splitSpokenItems("milk, eggs and two pounds of apples"), ["milk", "eggs", "2 lb apples"]);
  assert.deepEqual(splitSpokenItems("I need bread and butter and also a dozen eggs"), ["bread and butter", "1 dozen eggs"]);
  assert.deepEqual(splitSpokenItems("add mac and cheese, salt and pepper and bananas to the shopping list"), ["mac and cheese", "salt and pepper", "bananas"]);
  assert.deepEqual(splitSpokenItems("we're out of paper towels then dish soap plus coffee please"), ["paper towels", "dish soap", "coffee"]);
  assert.deepEqual(splitSpokenItems("milk and milk"), ["milk"]);
  assert.deepEqual(splitSpokenItems("   "), []);
});

test("tidies quantities and units", () => {
  assert.equal(tidyItem("three cans of black beans"), "3 can black beans");
  assert.equal(tidyItem("a gallon of milk"), "1 gal milk");
  assert.equal(tidyItem("a banana"), "banana");
  assert.equal(tidyItem("a couple of avocados"), "2 avocados");
  assert.equal(tidyItem("2 lbs ground beef"), "2 lb ground beef");
  assert.equal(tidyItem("half a pound of ham"), "0.5 lb ham");
  assert.equal(tidyItem("some strawberries"), "strawberries");
  assert.equal(tidyItem("Ice cream."), "Ice cream");
});

test("can keep the whole phrase as one item (to-do lists)", () => {
  assert.deepEqual(splitSpokenItems("call the plumber and book the car service", { split: false }), ["call the plumber and book the car service"]);
});
