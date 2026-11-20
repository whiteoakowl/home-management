import { test } from "node:test";
import assert from "node:assert/strict";
import { runtimeDatabaseUrl } from "../src/db/url";

test("Supabase session-mode pooler is switched to transaction mode for the app", () => {
  const session = "postgresql://postgres.abcd:p%40ss@aws-0-us-east-1.pooler.supabase.com:5432/postgres";
  assert.equal(runtimeDatabaseUrl(session), "postgresql://postgres.abcd:p%40ss@aws-0-us-east-1.pooler.supabase.com:6543/postgres");
});

test("other connection strings are left alone", () => {
  for (const url of [
    "postgresql://postgres.abcd:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
    "postgresql://postgres:pw@db.abcd.supabase.co:5432/postgres",
    "postgres://hearth:hearth@localhost:5432/hearth_merge",
    "postgres://user:pw@ep-cool.us-east-2.aws.neon.tech/neondb?sslmode=require",
  ])
    assert.equal(runtimeDatabaseUrl(url), url);
  assert.equal(runtimeDatabaseUrl(undefined), undefined);
});
