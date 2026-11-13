import { pool } from "@/db";
import { databaseUrl } from "@/db/url";
import { explainDbError } from "@/lib/health";

export const dynamic = "force-dynamic";

/**
 * Setup check: is the database configured, reachable and set up? Safe to share:
 * shows no passwords, hostnames or family data, just yes/no answers and hints.
 * Open https://<your-site>/api/health
 */
export async function GET() {
  const url = databaseUrl();
  const via = process.env.DATABASE_URL ? "DATABASE_URL" : process.env.NETLIFY_DB_URL ? "NETLIFY_DB_URL" : process.env.NETLIFY_DATABASE_URL ? "NETLIFY_DATABASE_URL" : null;
  let kind = "not set";
  if (url) {
    try {
      const u = new URL(url);
      kind = u.hostname.endsWith("pooler.supabase.com") ? `Supabase pooler (${u.port === "6543" ? "transaction mode" : "session mode"})` : u.hostname.endsWith("supabase.co") ? "Supabase direct connection" : u.hostname.includes("neon") ? "Neon" : "PostgreSQL";
    } catch {
      kind = "unreadable connection string";
    }
  }
  const result: Record<string, unknown> = {
    ok: false,
    database: { configured: !!url, variable: via, kind },
    storage: process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) ? "Supabase Storage" : process.env.NETLIFY ? "Netlify Blobs" : "local disk",
    version: process.env.COMMIT_REF?.slice(0, 7) ?? null,
  };
  if (!url) {
    result.problem = "No database is configured. Add DATABASE_URL in Netlify → Site configuration → Environment variables, then redeploy.";
    return new Response(JSON.stringify(result, null, 2), { status: 503, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
  }
  try {
    const client = await pool.connect();
    try {
      await client.query("select 1");
      const tables = await client.query<{ n: number }>("select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_name in ('users','families','chores','family_members')");
      const users = tables.rows[0]!.n === 4 ? await client.query<{ n: number }>("select count(*)::int as n from users") : null;
      (result.database as Record<string, unknown>).reachable = true;
      (result.database as Record<string, unknown>).tablesCreated = tables.rows[0]!.n === 4;
      (result.database as Record<string, unknown>).accounts = users?.rows[0]?.n ?? 0;
      if (tables.rows[0]!.n !== 4) result.problem = explainDbError({ code: "42P01" }).hint;
      else if (!users?.rows[0]?.n) result.problem = "The database is set up but has no accounts. Redeploy to load the demo family, or sign up at /signup.";
      else result.ok = true;
    } finally {
      client.release();
    }
  } catch (e) {
    const { code, hint } = explainDbError(e);
    (result.database as Record<string, unknown>).reachable = false;
    (result.database as Record<string, unknown>).errorCode = code;
    result.problem = hint;
    console.error("Health check failed:", e);
  }
  return new Response(JSON.stringify(result, null, 2), { status: result.ok ? 200 : 503, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
