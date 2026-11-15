import { test } from "node:test";
import assert from "node:assert/strict";
import { contrastRatio, MEMBER_COLORS, onSolid } from "../src/lib/colors";
import { themeScale, themeStyle } from "../src/lib/theme";

test("every theme keeps white button text readable", () => {
  for (const [key, c] of Object.entries(MEMBER_COLORS)) {
    const s = themeScale(c.solid);
    assert.ok(contrastRatio("#ffffff", s[600]) >= 4.5, `${key} 600`);
    assert.ok(contrastRatio("#ffffff", s[700]) >= 7, `${key} 700`);
    assert.ok(contrastRatio("#ffffff", s[500]) >= 3, `${key} 500`);
  }
});

test("avatar text is readable on every member colour", () => {
  for (const key of Object.keys(MEMBER_COLORS)) assert.ok(contrastRatio(onSolid(key), MEMBER_COLORS[key as keyof typeof MEMBER_COLORS].solid) >= 3, key);
});

test("no theme means the default colours", () => {
  assert.equal(themeStyle(null), undefined);
  assert.equal(themeStyle("nope"), undefined);
  assert.ok(themeStyle("ocean")!["--color-primary-600"]!.startsWith("#"));
});
