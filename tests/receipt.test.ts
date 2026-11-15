import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanItemName, parseReceipt, parseReceiptDate, sameProduct } from "../src/lib/receipt";

const RECEIPT = `INGLES MARKETS #42
123 Main St. Asheville NC
(828) 555-0100
11/12/2026 5:42 PM
MILK 2% GAL            4.29 F
EGGS LARGE 12CT        3.99 F
CHICKEN BREAST
  1.32 lb @ 6.43 /lb   8.49 F
APPLES GALA            5.25 F
2 BANANAS              1.18 F
PAPER TOWELS 6PK       9.99 T
SUBTOTAL              33.19
TAX                    0.70
TOTAL                 33.89
VISA ************1234 33.89
CHANGE                 0.00
THANK YOU FOR SHOPPING`;

test("parses store, date, total and items from a grocery receipt", () => {
  const r = parseReceipt(RECEIPT);
  assert.equal(r.store, "Ingles");
  assert.equal(r.date, "2026-11-12");
  assert.equal(r.totalCents, 3389);
  assert.deepEqual(
    r.items.map((i) => [i.name, i.quantity, i.unit, i.priceCents, i.category, i.location]),
    [
      ["Milk 2% gal", 1, null, 429, "dairy", "fridge"],
      ["Eggs Large 12ct", 1, null, 399, "dairy", "fridge"],
      ["Chicken Breast", 1.32, "lb", 849, "meat", "fridge"],
      ["Apples Gala", 1, null, 525, "produce", "fridge"],
      ["Bananas", 2, null, 118, "produce", "fridge"],
      ["Paper Towels 6pk", 1, null, 999, "household", "supplies"],
    ],
  );
});

test("skips payment lines, discounts and junk", () => {
  const r = parseReceipt("FOOD LION\nBREAD 2.49\nCOUPON -1.00\nYOU SAVED 1.00\nBALANCE DUE 1.49\nDEBIT 1.49");
  assert.equal(r.store, "Food Lion");
  assert.deepEqual(r.items.map((i) => i.name), ["Bread"]);
  assert.equal(r.totalCents, 149);
});

test("dates, names and duplicate matching", () => {
  assert.equal(parseReceiptDate("Date: 3/7/26"), "2026-03-07");
  assert.equal(parseReceiptDate("2026-01-05 10:00"), "2026-01-05");
  assert.equal(parseReceiptDate("13/45/26"), null);
  assert.equal(cleanItemName("4011 ** BANANAS ##"), "Bananas");
  assert.ok(sameProduct("Milk 2% Gal", "milk"));
  assert.ok(sameProduct("Eggs", "Large Eggs"));
  assert.ok(!sameProduct("Milk", "Chocolate chips"));
});
