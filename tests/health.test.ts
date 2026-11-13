import { test } from "node:test";
import assert from "node:assert/strict";
import { explainDbError } from "../src/lib/health";

test("explains common database errors in plain English", () => {
  assert.match(explainDbError({ message: "(EMAXCONNSESSION) max clients reached in session mode" }).hint, /Transaction pooler/);
  assert.match(explainDbError({ code: "28P01", message: "password authentication failed for user" }).hint, /password/);
  assert.match(explainDbError({ code: "ENOTFOUND", message: "getaddrinfo ENOTFOUND db.abc.supabase.co" }).hint, /pooler/);
  assert.match(explainDbError({ code: "42P01", message: 'relation "users" does not exist' }).hint, /tables/);
  assert.match(explainDbError({ message: "Tenant or user not found" }).hint, /postgres\./);
  assert.match(explainDbError({ code: "ECONNREFUSED" }).hint, /DATABASE_URL/);
});
