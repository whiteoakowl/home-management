/**
 * Plain-English explanations for database connection errors, for the
 * /api/health page and the error screen. Pure (unit-tested). Never echoes
 * secrets: only error codes and our own wording.
 */
export function explainDbError(e: unknown): { code: string; hint: string } {
  const err = e as { code?: string; message?: string };
  const code = err?.code ?? "";
  const msg = (err?.message ?? String(e)).toLowerCase();
  const out = (c: string, hint: string) => ({ code: c || "error", hint });
  if (!msg && !code) return out("unknown", "Unknown database error.");
  if (msg.includes("max clients") || msg.includes("emaxconn") || code === "53300" || msg.includes("too many clients") || msg.includes("remaining connection slots"))
    return out(code || "too_many_connections", "The database has run out of connections. In Supabase use the Transaction pooler connection string (port 6543) for DATABASE_URL, then redeploy.");
  if (code === "28P01" || msg.includes("password authentication failed"))
    return out(code, "Wrong database password in DATABASE_URL. Copy the connection string again and fill in your Supabase database password (no [ ] brackets).");
  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || msg.includes("getaddrinfo"))
    return out(code, "The database address can't be found. Use Supabase's pooler connection string (…pooler.supabase.com), not the Direct connection one.");
  if (code === "ECONNREFUSED" || msg.includes("econnrefused"))
    return out(code, "Nothing is listening at the database address. Check DATABASE_URL is set in Netlify (if it's missing the app tries this computer).");
  if (code === "ETIMEDOUT" || msg.includes("timeout") || msg.includes("timed out"))
    return out(code || "timeout", "The database didn't answer in time. If the Supabase project is paused, open Supabase and click Restore project; otherwise check the connection string.");
  if (code === "42P01" || (msg.includes("relation") && msg.includes("does not exist")))
    return out(code, "The database tables haven't been created. Redeploy in Netlify (Clear cache and deploy site) so the setup step runs, and check the deploy log for \"migrations applied\".");
  if (code === "3D000" || (msg.includes("database") && msg.includes("does not exist")))
    return out(code, "The database name in DATABASE_URL doesn't exist. Use the connection string exactly as Supabase shows it (database \"postgres\").");
  if (msg.includes("tenant or user not found"))
    return out(code || "tenant", "Supabase doesn't recognise the user in the connection string. Copy it again from Connect; pooler usernames look like postgres.<project-ref>.");
  if (msg.includes("ssl") || msg.includes("certificate"))
    return out(code || "ssl", "The database requires a secure (SSL) connection setting. Copy the connection string again from Supabase.");
  return out(code, "The database returned an unexpected error.");
}
