import "server-only";
import { inArray, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { files } from "@/db/schema";
import { storage } from "./storage";

/**
 * Keeps the database and file storage from filling up with things nobody
 * needs. Runs from the hourly job (/api/cron/daily). Every step is small and
 * batched, so it never slows the app; whatever is left is picked up next hour.
 * Family records (events, chores, journals, logs, photos in use…) are never
 * touched here.
 */
export async function cleanupOldRows() {
  const run = async (q: string) => (await pool.query(q)).rowCount ?? 0;
  const out = {
    // Signed-out / expired sign-ins.
    sessions: await run(`delete from sessions where id in (select id from sessions where expires_at < now() - interval '1 day' limit 5000)`),
    // Used or expired password-reset and email-confirmation links.
    authTokens: await run(`delete from auth_tokens where id in (select id from auth_tokens where expires_at < now() - interval '7 days' limit 5000)`),
    // Notifications: read ones after 90 days, any after a year.
    notifications: await run(
      `delete from notifications where id in (select id from notifications where (read_at is not null and created_at < now() - interval '90 days') or created_at < now() - interval '365 days' limit 10000)`,
    ),
    // The "what's been happening" feed: 13 months is plenty.
    activity: await run(`delete from activity_log where id in (select id from activity_log where created_at < now() - interval '395 days' limit 10000)`),
    // Record of timed event reminders already sent.
    eventReminders: await run(`delete from event_reminders_sent where sent_at < now() - interval '30 days'`),
    // Comments, reactions and favorites on photos or memories that were deleted.
    mediaSocial:
      (await run(`delete from media_comments c where (c.entity_type = 'photo' and not exists (select 1 from entity_photos p where p.id = c.entity_id)) or (c.entity_type = 'memory' and not exists (select 1 from memories m where m.id = c.entity_id))`)) +
      (await run(`delete from media_reactions c where (c.entity_type = 'photo' and not exists (select 1 from entity_photos p where p.id = c.entity_id)) or (c.entity_type = 'memory' and not exists (select 1 from memories m where m.id = c.entity_id))`)) +
      (await run(`delete from media_favorites c where (c.entity_type = 'photo' and not exists (select 1 from entity_photos p where p.id = c.entity_id)) or (c.entity_type = 'memory' and not exists (select 1 from memories m where m.id = c.entity_id))`)),
    // Abuse-protection counters.
    rateLimits: await run(`delete from rate_limits where window_start < now() - interval '2 days'`),
  };
  return out;
}

/** Every column that can hold a file id (…file_id), found from the database itself. */
async function fileColumns(): Promise<{ table: string; column: string }[]> {
  const { rows } = await pool.query<{ table_name: string; column_name: string }>(
    `select table_name, column_name from information_schema.columns
     where table_schema = 'public' and table_name <> 'files' and data_type = 'uuid' and column_name like '%file\\_id'`,
  );
  return rows.map((r) => ({ table: r.table_name, column: r.column_name }));
}

/**
 * Files no record points to any more (a photo replaced, an item deleted, an
 * upload whose save failed). Only files older than 2 days are removed, and
 * only when no column anywhere still uses them.
 */
export async function cleanupOrphanFiles(limit = 300, dryRun = false) {
  const cols = await fileColumns();
  if (!cols.length) return { removed: 0 };
  const notUsed = cols.map(({ table, column }) => `not exists (select 1 from public."${table}" x where x."${column}" = f.id)`).join(" and ");
  const { rows } = await pool.query<{ id: string; storage_key: string; thumbnail_key: string | null }>(
    `select f.id, f.storage_key, f.thumbnail_key from files f where f.created_at < now() - interval '2 days' and ${notUsed} order by f.created_at limit $1`,
    [limit],
  );
  if (dryRun || !rows.length) return { removed: 0, found: rows.length };
  await db.delete(files).where(inArray(files.id, rows.map((r) => r.id)));
  const keys = rows.flatMap((r) => [r.storage_key, r.thumbnail_key].filter((k): k is string => !!k));
  await removeKeys(keys);
  return { removed: rows.length };
}

/** Remove stored objects, several at a time. */
export async function removeKeys(keys: string[]) {
  const s = storage();
  if (s.removeMany) {
    for (let i = 0; i < keys.length; i += 500) await s.removeMany(keys.slice(i, i + 500)).catch((e) => console.error("Storage cleanup failed:", e));
    return;
  }
  for (let i = 0; i < keys.length; i += 20) await Promise.all(keys.slice(i, i + 20).map((k) => s.remove(k).catch(() => undefined)));
}

/** Bytes a family stores (originals; thumbnails add about 3%). */
export async function familyStorageBytes(familyId: string) {
  const [row] = await db.select({ n: sql<string>`coalesce(sum(${files.sizeBytes}), 0)` }).from(files).where(sql`${files.familyId} = ${familyId}`);
  return Number(row?.n ?? 0);
}

/** Per-family file storage allowance (FAMILY_STORAGE_GB, default 10 GB). */
export const familyStorageLimit = () => Math.max(1, Number(process.env.FAMILY_STORAGE_GB) || 10) * 1024 ** 3;
