import { pool } from "@/db";
import { databaseUrl, runtimeDatabaseUrl } from "@/db/url";
import { explainDbError } from "@/lib/health";
import { readSessionUser } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/billing";
import { storage, supabaseBaseUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

const json = (body: unknown, status: number) => new Response(JSON.stringify(body, null, 2), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

/**
 * Who sees the full report: platform admins (signed in), anyone holding
 * HEALTH_CHECK_KEY (?key=…), and anyone while the site is still being set up
 * (no database or no accounts yet). Everyone else just gets ok / not ok, so
 * the public can't read infrastructure details or account numbers.
 */
export async function GET(req: Request) {
  const key = process.env.HEALTH_CHECK_KEY;
  if (!databaseUrl() || (key && new URL(req.url).searchParams.get("key") === key)) return fullReport();
  try {
    const user = await readSessionUser();
    if (user && isPlatformAdmin(user.email)) return fullReport();
    const client = await pool.connect();
    try {
      const r = await client.query<{ n: number }>("select count(*)::int as n from users");
      if (!r.rows[0]?.n) return fullReport();
    } finally {
      client.release();
    }
    return json({ ok: true }, 200);
  } catch {
    // Not set up yet (no tables) or unreachable: the full report explains what to fix.
    return fullReport();
  }
}

/**
 * Setup check: is the database configured, reachable and set up? Safe to share:
 * shows no passwords, hostnames or family data, just yes/no answers and hints.
 * Open https://<your-site>/api/health
 */
async function fullReport(): Promise<Response> {
  const url = databaseUrl();
  const via = process.env.DATABASE_URL ? "DATABASE_URL" : process.env.NETLIFY_DB_URL ? "NETLIFY_DB_URL" : process.env.NETLIFY_DATABASE_URL ? "NETLIFY_DATABASE_URL" : null;
  let kind = "not set";
  if (url) {
    try {
      const u = new URL(runtimeDatabaseUrl(url) ?? url);
      const switched = runtimeDatabaseUrl(url) !== url;
      kind = u.hostname.endsWith("pooler.supabase.com") ? `Supabase pooler (${u.port === "6543" ? `transaction mode${switched ? ", switched automatically from session mode" : ""}` : "session mode"})` : u.hostname.endsWith("supabase.co") ? "Supabase direct connection" : u.hostname.includes("neon") ? "Neon" : "PostgreSQL";
    } catch {
      kind = "unreadable connection string";
    }
  }
  const result: Record<string, unknown> = {
    ok: false,
    database: { configured: !!url, variable: via, kind },
    storage: process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) ? "Supabase Storage" : process.env.NETLIFY ? "Netlify Blobs" : "local disk",
    ...(process.env.SUPABASE_URL ? { storageAddress: supabaseBaseUrl(process.env.SUPABASE_URL), storageAddressAsEntered: process.env.SUPABASE_URL.trim() === supabaseBaseUrl(process.env.SUPABASE_URL) ? "ok" : "had extra parts; the app now ignores them" } : {}),
    version: process.env.COMMIT_REF?.slice(0, 7) ?? null,
  };
  // Photo storage: write, read back and delete a tiny test file.
  try {
    const drv = storage();
    const key = `_health/${Date.now()}.txt`;
    const t0 = Date.now();
    await drv.put(key, Buffer.from("ok"), "text/plain");
    const back = await drv.get(key);
    await drv.remove(key);
    result.storageCheck = back.toString() === "ok" ? { ok: true, driver: drv.name, ms: Date.now() - t0 } : { ok: false, driver: drv.name, problem: "Read back the wrong data." };
  } catch (e) {
    console.error("Storage check failed:", e);
    result.storageCheck = { ok: false, problem: String((e as Error).message ?? e).slice(0, 300), hint: "Photos can't be saved. In Netlify check SUPABASE_URL (https://<project>.supabase.co) and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY), then redeploy." };
  }
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
      else if (!users?.rows[0]?.n) result.problem = "The database is set up but has no accounts. Create your family at /signup.";
      else if ((result.storageCheck as { ok?: boolean })?.ok === false) result.problem = (result.storageCheck as { hint?: string }).hint;
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
