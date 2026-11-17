import { test } from "node:test";
import assert from "node:assert/strict";
import { adviceFor, chlorineDose, chlorineTargets, formatAmount, lsi, statusOf, type PoolProfile } from "../src/lib/pool";

const pool: PoolProfile = { kind: "pool", gallons: 10000, sanitizer: "chlorine", surface: "plaster", chlorineProduct: "liquid10" };

test("chlorine doses match standard reference amounts (10,000 gal, +1 ppm)", () => {
  assert.equal(chlorineDose(pool, 1).amount, "13 fl oz"); // 10% liquid ≈ 12.8 fl oz
  assert.equal(chlorineDose({ ...pool, chlorineProduct: "liquid12" }, 1).amount, "10 fl oz"); // 12.5% ≈ 10.2 fl oz
  assert.equal(chlorineDose({ ...pool, chlorineProduct: "calhypo65" }, 1).amount, "2 oz"); // ≈ 2.05 oz
  assert.equal(chlorineDose({ ...pool, gallons: 20000 }, 5).amount, "1 gal"); // 128 fl oz
});

test("free chlorine targets scale with stabilizer", () => {
  assert.deepEqual(chlorineTargets(pool, 40), { min: 3, target: 4.6, max: 8, shock: 16 });
  const salt = chlorineTargets({ ...pool, sanitizer: "salt" }, 70);
  assert.ok(salt.min < chlorineTargets(pool, 70).min, "salt pools run lower FC");
  assert.equal(chlorineTargets(pool, 0).target, 2);
});

test("statuses", () => {
  assert.equal(statusOf(pool, "ph", { ph: 7.5 }), "ok");
  assert.equal(statusOf(pool, "ph", { ph: 7.3 }), "watch-low");
  assert.equal(statusOf(pool, "ph", { ph: 8.0 }), "high");
  assert.equal(statusOf(pool, "fc", { fc: 1, cya: 40 }), "low");
  assert.equal(statusOf(pool, "ch", { ch: 200 }), "watch-low"); // plaster likes 250+
  assert.equal(statusOf({ ...pool, surface: "vinyl" }, "ch", { ch: 200 }), "ok");
  assert.equal(statusOf(pool, "salt", { salt: 3000 }), null); // not a salt pool
});

test("advice: low FC, high pH, low TA with amounts", () => {
  const a = adviceFor(pool, { fc: 1, cya: 40, ph: 7.9, ta: 50, ch: 300 });
  const keys = a.map((x) => x.key);
  assert.deepEqual(keys, ["fc", "ph", "ta"]);
  assert.equal(a[0]!.amount, "46 fl oz"); // (4.6 - 1) ppm × 12.8
  assert.match(a[1]!.title, /pH is high/);
  assert.equal(a[2]!.amount, "4.2 lb"); // (80-50)/10 × 1.4 lb
});

test("advice: combined chlorine means shock", () => {
  const a = adviceFor(pool, { fc: 3, cc: 1, cya: 40 });
  assert.equal(a[0]!.key, "cc");
  assert.match(a[0]!.title, /Shock/);
});

test("balanced water has nothing to do", () => {
  assert.deepEqual(adviceFor(pool, { fc: 5, cc: 0, ph: 7.5, ta: 80, ch: 350, cya: 40 }), []);
});

test("LSI", () => {
  const l = lsi(pool, { ph: 7.5, ta: 80, ch: 350, cya: 40, tempF: 84 })!;
  assert.ok(l.value > -0.3 && l.value < 0.3, `balanced, got ${l.value}`);
  assert.equal(lsi(pool, { ph: 7.0, ta: 40, ch: 100, tempF: 60 })!.verdict, "corrosive");
  assert.equal(lsi(pool, { ph: 8.2, ta: 140, ch: 600, tempF: 90 })!.verdict, "scaling");
  assert.equal(lsi(pool, { ph: 7.5 }), null);
});

test("amount formatting", () => {
  assert.equal(formatAmount(200, "floz"), "1.6 gal");
  assert.equal(formatAmount(40, "oz"), "2.5 lb");
});
