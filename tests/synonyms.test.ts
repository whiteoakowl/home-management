import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkIngredients } from "../src/lib/ingredients";
import { aliasesFor, matchesWithAliases } from "../src/lib/synonyms";

describe("ingredient other names", () => {
  it("keyword bank links words that mean the same", () => {
    assert.ok(matchesWithAliases("green onions", aliasesFor("Scallions")));
    assert.ok(matchesWithAliases("cilantro", aliasesFor("fresh coriander")));
    assert.ok(matchesWithAliases("confectioners' sugar", aliasesFor("Powdered sugar")));
    assert.ok(!matchesWithAliases("bell pepper", aliasesFor("Black pepper")), "different peppers stay different");
  });

  it("an item's own tags count", () => {
    assert.ok(matchesWithAliases("poultry", aliasesFor("Chicken breast", ["poultry"])));
    assert.ok(!matchesWithAliases("poultry", aliasesFor("Chicken breast")));
  });

  it("family groups add to the bank", () => {
    const groups = [["pop", "soda", "soft drink"]];
    assert.ok(matchesWithAliases("soft drink", aliasesFor("Pop", [], groups), groups));
  });

  it("recipe check uses them", () => {
    const [s] = checkIngredients([{ name: "green onions", quantity: null, unit: null }], [{ id: "1", name: "Scallions", quantity: 1, unit: null, aliases: aliasesFor("Scallions") }]);
    assert.equal(s!.have, true);
    assert.equal(s!.matchedItem, "Scallions");
  });
});
