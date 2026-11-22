import "server-only";
import { headers } from "next/headers";
import { lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";

/**
 * Fixed-window rate limiting stored in the database (serverless functions
 * share no memory). Returns true when the action may go ahead.
 * Fails open if the database hiccups, so a glitch never locks people out.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  try {
    const [row] = await db
      .insert(rateLimits)
      .values({ key, count: 1, windowStart: new Date() })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: sql`case when ${rateLimits.windowStart} < now() - make_interval(secs => ${windowSeconds}) then 1 else ${rateLimits.count} + 1 end`,
          windowStart: sql`case when ${rateLimits.windowStart} < now() - make_interval(secs => ${windowSeconds}) then now() else ${rateLimits.windowStart} end`,
        },
      })
      .returning({ count: rateLimits.count });
    // Now and then, clear out old counters.
    if (Math.random() < 0.01) await db.delete(rateLimits).where(lt(rateLimits.windowStart, sql`now() - interval '1 day'`));
    return (row?.count ?? 0) <= limit;
  } catch (e) {
    console.error("Rate limit check failed:", e);
    return true;
  }
}

/** The visitor's IP address (Netlify's header first, then the usual proxy header). */
export async function clientIp() {
  const h = await headers();
  return h.get("x-nf-client-connection-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
}

export const TOO_MANY = "Too many attempts. Please wait a few minutes and try again.";
