/**
 * Runs after migrations on every deploy (scripts/db-setup.mjs). Adds an index
 * for every foreign-key column that doesn't have one yet (family_id,
 * member_id, file ids…). As families add lots of records, this keeps pages
 * that filter by family fast, and keeps deletes (a family, a person, a photo)
 * from scanning whole tables. Safe to run often: existing indexes are left
 * alone, and tables added later are covered automatically.
 */
import pg from "pg";

const url = process.env.DATABASE_URL || process.env.NETLIFY_DB_URL || process.env.NETLIFY_DATABASE_URL;
if (!url) process.exit(0);
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  // Clean up any half-built index from an interrupted earlier run.
  const { rows: invalid } = await client.query(
    "select ic.relname from pg_index i join pg_class ic on ic.oid = i.indexrelid join pg_namespace n on n.oid = ic.relnamespace where n.nspname = 'public' and not i.indisvalid and ic.relname like '%\\_fk\\_idx'",
  );
  for (const r of invalid) await client.query(`drop index if exists public."${r.relname}"`);

  const { rows } = await client.query(`
    select c.conrelid::regclass::text as tbl, a.attname as col
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace and n.nspname = 'public'
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and array_length(c.conkey, 1) = 1
      and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])
    order by 1, 2`);
  let made = 0;
  for (const { tbl, col } of rows) {
    const table = tbl.replace(/^public\./, "").replace(/"/g, "");
    const name = `${table}_${col}_fk_idx`.slice(0, 63);
    // CONCURRENTLY: never blocks the live app while building on a big table.
    await client.query(`create index concurrently if not exists "${name}" on public."${table}" ("${col}")`);
    made++;
  }
  console.log(made ? `Added ${made} database index${made === 1 ? "" : "es"} for faster lookups.` : "Database indexes checked.");
} finally {
  await client.end();
}
