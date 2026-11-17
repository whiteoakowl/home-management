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

test("custom colours: exact hex kept, readable, and accepted everywhere", async () => {
  const { memberColor, cleanColor } = await import("../src/lib/colors");
  for (const hex of ["#1e6091", "#ff66cc", "#ffee00", "#00a86b", "#222222", "#f0f0f0"]) {
    const s = themeScale(hex);
    assert.ok(contrastRatio("#ffffff", s[600]) >= 4.5, `${hex} 600`);
    assert.ok(contrastRatio("#ffffff", s[700]) >= 7, `${hex} 700`);
    assert.equal(memberColor(hex).solid, hex);
    assert.ok(contrastRatio(onSolid(hex), hex) >= 3, `${hex} avatar text`);
  }
  assert.equal(themeScale("#1e6091")[600], "#1e6091");
  assert.ok(themeStyle("#ff66cc"));
  assert.equal(cleanColor("#FF66CC"), "#ff66cc");
  assert.equal(cleanColor("plum"), "plum");
  assert.equal(cleanColor("red; drop"), null);
});
