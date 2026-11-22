/**
 * Runs after migrations on every deploy (scripts/db-setup.mjs). Keeps every
 * app table closed to Supabase's public API keys (anon / authenticated):
 * Row Level Security on, and no table privileges for those roles. The app
 * and the stripe-webhook Edge Function connect as the tables' owner, which
 * RLS doesn't restrict, so nothing in the app changes. Safe to run often.
 */
import pg from "pg";

const url = process.env.DATABASE_URL || process.env.NETLIFY_DB_URL || process.env.NETLIFY_DATABASE_URL;
if (!url) process.exit(0);
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const { rows } = await client.query("select tablename from pg_tables where schemaname = 'public' and tableowner = current_user and not rowsecurity");
  for (const r of rows) await client.query(`alter table public."${r.tablename.replace(/"/g, '""')}" enable row level security`);
  for (const role of ["anon", "authenticated"]) {
    const { rows: has } = await client.query("select 1 from pg_roles where rolname = $1", [role]);
    if (!has.length) continue;
    await client.query(`revoke all on all tables in schema public from ${role}`);
    await client.query(`revoke all on all sequences in schema public from ${role}`);
  }
  console.log(`Table security checked${rows.length ? ` (row level security turned on for ${rows.length} new table${rows.length === 1 ? "" : "s"})` : ""}.`);
} finally {
  await client.end();
}
