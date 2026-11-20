import "server-only";
import { pool } from "@/db";

/**
 * "Download our data": every record that belongs to a family, as JSON,
 * for the account holder. Respects the app's privacy promises: other
 * people's private items (private visibility, private spaces, personal
 * journals, health, cycle and wellness tracking) are left out; only the
 * account holder's own are included. Secrets are never exported.
 */

/** Tables that are personal to one person: only the account holder's own rows are exported. */
const PERSONAL = new Set([
  "journal_entries",
  "faith_practices",
  "faith_practice_logs",
  "faith_texts",
  "faith_reading_logs",
  "faith_prayers",
  "faith_entries",
  "journal_entry_members",
  "period_days",
  "personal_health_profiles",
  "wellness_check_ins",
  "wellness_goals",
  "food_journal_entries",
  "privacy_settings",
  "record_access",
  "body_metrics",
  "personal_records",
  "notifications",
  "message_reads",
  "notification_preferences",
  "dashboard_layouts",
  "section_layouts",
  "quote_favorites",
  "workout_logs",
  "fitness_plans",
]);
/** Never exported: service tables and secrets. */
const SKIP = new Set(["users", "sessions", "auth_tokens", "platform_settings", "rate_limits", "stripe_events", "families"]);
const SECRET_COLUMNS = new Set(["password_hash", "token_hash"]);
const AUTHOR_COLS = ["author_member_id", "created_by_member_id", "owner_member_id", "member_id"];

type Row = Record<string, unknown>;
const q = <T = Row,>(text: string, params: unknown[] = []) => pool.query(text, params).then((r) => r.rows as T[]);
const ident = (s: string) => `"${s.replace(/"/g, '""')}"`;

export async function exportFamily(familyId: string, holderMemberId: string) {
  const cols = await q<{ table_name: string; column_name: string }>(
    "select c.table_name, c.column_name from information_schema.columns c join information_schema.tables t on t.table_name = c.table_name and t.table_schema = 'public' and t.table_type = 'BASE TABLE' where c.table_schema = 'public'",
  );
  const columns = new Map<string, Set<string>>();
  for (const c of cols) (columns.get(c.table_name) ?? columns.set(c.table_name, new Set()).get(c.table_name)!).add(c.column_name);
  const fks = await q<{ child: string; col: string; parent: string; pcol: string }>(
    `select tc.table_name as child, kcu.column_name as col, ccu.table_name as parent, ccu.column_name as pcol
     from information_schema.table_constraints tc
     join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
     join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
     where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'`,
  );

  /** May the account holder take this row away? */
  const allowed = (table: string, r: Row) => {
    const has = (c: string) => columns.get(table)?.has(c);
    const author = AUTHOR_COLS.map((c) => (has(c) ? (r[c] as string | null) : null)).find((v) => v);
    if (PERSONAL.has(table)) return !has("member_id") && !has("author_member_id") ? true : (r.member_id ?? r.author_member_id) === holderMemberId;
    if (has("visibility") && r.visibility === "private" && author && author !== holderMemberId) return false;
    if (has("private_owner_id") && r.private_owner_id && r.private_owner_id !== holderMemberId) return false;
    if (has("private_owner_member_id") && r.private_owner_member_id && r.private_owner_member_id !== holderMemberId) return false;
    if (has("owner_member_id") && r.owner_member_id && r.owner_member_id !== holderMemberId && table !== "families") return false;
    if (table === "contacts" && r.private && r.created_by_member_id !== holderMemberId) return false;
    if (table === "list_items" && r.personal_for_member_id && r.personal_for_member_id !== holderMemberId) return false;
    return true;
  };
  const clean = (table: string, r: Row) => {
    const out: Row = {};
    for (const [k, v] of Object.entries(r)) if (!SECRET_COLUMNS.has(k)) out[k] = v;
    // Keep gift surprises: no "who's buying" on your own wishlist.
    if (table === "wishlist_items" && r.member_id === holderMemberId) {
      delete out.claimed_by_member_id;
      delete out.purchased;
    }
    return out;
  };

  const tables: Record<string, Row[]> = {};
  const ids = new Map<string, Set<string>>();
  const keep = (table: string, rows: Row[]) => {
    const kept = rows.filter((r) => allowed(table, r)).map((r) => clean(table, r));
    if (kept.length) tables[table] = kept;
    ids.set(table, new Set(kept.map((r) => String(r.id ?? ""))));
  };

  // 1. Tables with a family_id.
  for (const [table, set] of columns) {
    if (SKIP.has(table) || !set.has("family_id")) continue;
    keep(table, await q(`select * from ${ident(table)} where family_id = $1`, [familyId]));
  }
  // 2. Child tables, reached through a parent that was exported (repeat for grandchildren).
  let pending = [...columns.keys()].filter((t) => !SKIP.has(t) && !columns.get(t)!.has("family_id"));
  for (let pass = 0; pass < 4 && pending.length; pass++) {
    const next: string[] = [];
    for (const table of pending) {
      const link = fks.find((f) => f.child === table && ids.has(f.parent) && f.pcol === "id");
      if (!link) {
        next.push(table);
        continue;
      }
      const parentIds = [...ids.get(link.parent)!].filter(Boolean);
      keep(table, parentIds.length ? await q(`select * from ${ident(table)} where ${ident(link.col)} = any($1::uuid[])`, [parentIds]) : []);
    }
    pending = next;
  }

  const [family] = await q("select id, name, timezone, location_name, enabled_modules, theme, settings, created_at from families where id = $1", [familyId]);
  const people = await q("select m.id, m.display_name, m.role, u.email from family_members m left join users u on u.id = m.user_id where m.family_id = $1", [familyId]);
  return {
    exportedAt: new Date().toISOString(),
    about:
      "Everything your family has added, as JSON (one list per kind of record). Other people's private items (private journals, health, cycle and wellness tracking, private spaces) are not included; each person can ask for their own. Photos and documents are listed by name; download them from the app.",
    family,
    people,
    tables,
  };
}
