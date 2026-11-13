/**
 * Postgres connection string. DATABASE_URL wins; on Netlify the built-in
 * database (Netlify DB, powered by Neon) provides NETLIFY_DB_URL, or
 * NETLIFY_DATABASE_URL on older setups.
 */
export function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.NETLIFY_DB_URL || process.env.NETLIFY_DATABASE_URL || undefined;
}
