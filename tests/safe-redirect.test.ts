import { test } from "node:test";
import assert from "node:assert/strict";
import { safePath } from "../src/lib/safe-redirect";

test("keeps paths on this site", () => {
  assert.equal(safePath("/calendar"), "/calendar");
  assert.equal(safePath("/house/chores?tab=overdue#x"), "/house/chores?tab=overdue#x");
  assert.equal(safePath("/wellness", "/"), "/wellness");
});

test("blocks other sites and tricks", () => {
  for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "\\\\evil.com", "/\t/evil.com", "javascript:alert(1)", "evil.com", "", null, undefined, 42]) {
    assert.equal(safePath(bad, "/home"), "/home", String(bad));
  }
});
