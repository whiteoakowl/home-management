/**
 * Postgres connection string. DATABASE_URL wins; on Netlify the built-in
 * database (Netlify DB, powered by Neon) provides NETLIFY_DB_URL, or
 * NETLIFY_DATABASE_URL on older setups.
 */
export function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.NETLIFY_DB_URL || process.env.NETLIFY_DATABASE_URL || undefined;
}

/**
 * The connection string the running app uses. Supabase's pooler in session
 * mode (port 5432) keeps one database connection per open client, and
 * serverless hosts keep many clients open, so the database soon runs out of
 * connections ("max clients reached"). The same pooler in transaction mode
 * (port 6543) only holds a connection while a query runs, so the app uses
 * that automatically. Migrations keep using DATABASE_URL as given.
 */
export function runtimeDatabaseUrl(raw = databaseUrl()): string | undefined {
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    if (u.hostname.endsWith(".pooler.supabase.com") && (u.port === "5432" || u.port === "")) {
      u.port = "6543";
      return u.toString();
    }
  } catch {
    /* not a URL we understand: use as is */
  }
  return raw;
}
