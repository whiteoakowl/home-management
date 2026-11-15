/**
 * Removes the demo ("Vanderbilt") sample records that older versions loaded on
 * first deploy, while keeping every account and family member.
 *
 *   npm run db:remove-demo            # remove demo records
 *   npm run db:remove-demo -- --dry   # only report what would be removed
 *
 * Runs on every deploy (scripts/db-setup.mjs). Safe to run repeatedly.
 *
 * How demo records are recognised (never a blanket wipe):
 *  1. A family is a demo family only if it still holds the seed's signature
 *     announcements, which the seed inserts as one of its last steps.
 *  2. Only rows of that family created no later than the seed finished
 *     (signature time + a small margin) are demo rows. Anything a person
 *     added afterwards is real and kept.
 *  3. A demo record that real records now hang off (e.g. a demo list you
 *     added your own items to, a demo pet with new vet records) is kept.
 *
 * Never touched: users, sessions, families, family members, permissions,
 * dashboard layouts, notification preferences, family settings, and the
 * built-in reference libraries (plants / spiritual reference with no family).
 */
import pg from "pg";

const SIGNATURES = ["Grandma arrives next Saturday! Rooms tidy by Friday, please 💜", "New egg record: 11 eggs on Tuesday. Way to go, ladies 🐔"];
const DEMO_ACTIVITY = [
  'completed "Kitchen reset"',
  "collected 11 eggs (added to the kitchen)",
  "added Chicken Parmesan to today's dinner",
  "harvested 2 lb of Tomato",
  'added the recipe "Garden harvest salad"',
  'completed "Feed & water the chickens"',
];
const MARGIN = "2 minutes";

/** Never deleted by this script. */
const NEVER = new Set(["families", "family_members", "member_permissions", "dashboard_layouts", "notification_preferences", "users", "sessions", "record_access", "files"]);
/** Shared structure: removed only when nothing that remains still uses it. */
const STRUCTURE = ["categories", "rooms", "recurrence_rules", "products", "plants", "recipe_collections"];
/** Handled explicitly below. */
const SPECIAL = new Set(["activity_log", "notifications", ...STRUCTURE]);

/** Demo parents are kept when a person added child records to them after the seed. */
const KEEP_IF_REAL_CHILDREN = {
  lists: [["list_items", "list_id"]],
  recipes: [["meal_plan_entries", "recipe_id"]],
  pets: [["pet_care_notes", "pet_id"], ["pet_medical_records", "pet_id"], ["pet_preventatives", "pet_id"], ["pet_photos", "pet_id"], ["pet_supplies", "pet_id"]],
  animals: [["animal_health_records", "animal_id"], ["production_logs", "animal_id"], ["feed_logs", "animal_id"]],
  goals: [["goal_contributions", "goal_id"], ["transactions", "goal_id"]],
  home_projects: [["project_stages", "project_id"], ["project_materials", "project_id"], ["home_photos", "project_id"]],
  garden_plans: [["garden_plantings", "plan_id"]],
  garden_plantings: [["garden_logs", "planting_id"]],
  fitness_plans: [["workouts", "plan_id"]],
  inventory_items: [["pet_supplies", "inventory_item_id"], ["craft_item_supplies", "inventory_item_id"]],
  calendar_events: [["event_attachments", "event_id"]],
  chores: [],
};

/** Demo child rows (no family_id of their own) inside a kept or deleted parent. */
const CHILD_TABLES = [
  ["list_items", "list_id", "lists"],
  ["project_stages", "project_id", "home_projects"],
  ["project_materials", "project_id", "home_projects"],
  ["pet_care_notes", "pet_id", "pets"],
  ["pet_medical_records", "pet_id", "pets"],
  ["pet_preventatives", "pet_id", "pets"],
  ["pet_supplies", "pet_id", "pets"],
  ["animal_health_records", "animal_id", "animals"],
  ["goal_contributions", "goal_id", "goals"],
  ["workouts", "plan_id", "fitness_plans"],
];

export async function removeDemoData(client, { dry = false, log = console.log } = {}) {
  const q = (text, params) => client.query(text, params);
  const report = [];

  const { rows: fams } = await q(
    `select f.id, f.name, max(a.created_at) as seed_end
       from families f join announcements a on a.family_id = f.id and a.body = any($1)
      where coalesce(f.settings->>'demoDataRemovedAt', '') = ''
      group by f.id, f.name`,
    [SIGNATURES],
  );
  if (!fams.length) {
    log("Demo data: nothing to remove.");
    return report;
  }

  const { rows: cols } = await q(
    `select table_name, array_agg(column_name::text) as cols
       from information_schema.columns where table_schema = 'public' group by table_name`,
  );
  const colsOf = Object.fromEntries(cols.map((r) => [r.table_name, new Set(r.cols)]));
  const familyTables = Object.keys(colsOf)
    .filter((t) => colsOf[t].has("family_id") && colsOf[t].has("created_at") && !NEVER.has(t) && !SPECIAL.has(t))
    .sort();

  for (const fam of fams) {
    const removed = {};
    const kept = [];
    await q("begin");
    try {
      const { rows: [{ w }] } = await q(`select ($1::timestamptz + interval '${MARGIN}') as w`, [fam.seed_end]);
      const { rows: memberRows } = await q("select id from family_members where family_id = $1", [fam.id]);
      const memberIds = memberRows.map((r) => r.id);
      await q("create temp table if not exists _demo_deleted (entity_id uuid) on commit drop");

      // Demo rows inside parents (handled first so "real children" checks only see real ones).
      for (const [table, fk, parent] of CHILD_TABLES) {
        if (!colsOf[table]?.has("created_at")) continue;
        const r = await q(
          `delete from ${table} c using ${parent} p where c.${fk} = p.id and p.family_id = $1 and c.created_at <= $2 returning c.id`,
          [fam.id, w],
        );
        if (r.rowCount) removed[table] = (removed[table] ?? 0) + r.rowCount;
      }
      // Member-level demo rows without a family column.
      for (const table of ["body_metrics", "food_journal_entries"]) {
        if (!colsOf[table]?.has("member_id") || colsOf[table]?.has("family_id")) continue;
        const r = await q(`delete from ${table} where member_id = any($1) and created_at <= $2`, [memberIds, w]);
        if (r.rowCount) removed[table] = (removed[table] ?? 0) + r.rowCount;
      }
      // personal_records has no timestamps: remove only the seed's exact record.
      if (colsOf.personal_records) {
        const r = await q(`delete from personal_records where member_id = any($1) and exercise = 'Deadlift' and value = '225' and unit = 'lb' and workout_log_id is null`, [memberIds]);
        if (r.rowCount) removed.personal_records = r.rowCount;
      }

      for (const table of familyTables) {
        const guards = (KEEP_IF_REAL_CHILDREN[table] ?? [])
          .filter(([child, fk]) => colsOf[child]?.has(fk) && colsOf[child]?.has("created_at"))
          .map(([child, fk]) => `and not exists (select 1 from ${child} c where c.${fk} = t.id and c.created_at > $2)`)
          .join(" ");
        if (guards) {
          const k = await q(`select count(*)::int n from ${table} t where t.family_id = $1 and t.created_at <= $2 and not (true ${guards})`, [fam.id, w]);
          if (k.rows[0].n) kept.push(`${k.rows[0].n} ${table} (you added to them)`);
        }
        const r = await q(`delete from ${table} t where t.family_id = $1 and t.created_at <= $2 ${guards} returning t.id`, [fam.id, w]);
        if (r.rowCount) {
          removed[table] = r.rowCount;
          await q("insert into _demo_deleted select unnest($1::uuid[])", [r.rows.map((x) => x.id)]);
        }
      }

      // Shared structure the demo created, if nothing remaining uses it.
      const structure = {
        categories: [["chores", "category_id"], ["inventory_items", "category_id"], ["recipes", "category_id"], ["lists", "category_id"], ["transactions", "category_id"], ["calendar_events", "category_id"], ["household_info", "category_id"], ["home_documents", "category_id"], ["budget_limits", "category_id"]],
        rooms: [["chores", "room_id"], ["home_documents", "room_id"], ["home_items", "room_id"], ["home_photos", "room_id"], ["home_projects", "room_id"], ["home_repairs", "room_id"]],
        recurrence_rules: [["chores", "recurrence_rule_id"], ["calendar_events", "recurrence_rule_id"], ["list_items", "recurrence_rule_id"], ["transactions", "recurrence_rule_id"], ["workouts", "recurrence_rule_id"]],
        products: [["inventory_items", "product_id"]],
        plants: [["garden_plantings", "plant_id"], ["garden_logs", "plant_id"], ["seed_inventory", "plant_id"], ["craft_items", "plant_id"]],
        recipe_collections: [["recipe_collection_items", "collection_id"]],
      };
      for (const table of STRUCTURE) {
        if (!colsOf[table]) continue;
        const refs = structure[table].filter(([t, c]) => colsOf[t]?.has(c));
        const notUsed = refs.map(([t, c]) => `and not exists (select 1 from ${t} x where x.${c} = s.id)`).join(" ");
        // Reference libraries have no family and are never matched here.
        const r = await q(`delete from ${table} s where s.family_id = $1 and s.created_at <= $2 ${notUsed}`, [fam.id, w]);
        if (r.rowCount) removed[table] = r.rowCount;
      }

      // Activity and notifications produced by the seed.
      const a = await q(`delete from activity_log where family_id = $1 and (created_at <= $2 or summary = any($3))`, [fam.id, w, DEMO_ACTIVITY]);
      if (a.rowCount) removed.activity_log = a.rowCount;
      const n = await q(`delete from notifications where family_id = $1 and created_at <= $2`, [fam.id, w]);
      if (n.rowCount) removed.notifications = n.rowCount;

      // Sharing rows that pointed at removed records.
      const ra = await q(`delete from record_access where family_id = $1 and entity_id in (select entity_id from _demo_deleted)`, [fam.id]);
      if (ra.rowCount) removed.record_access = ra.rowCount;

      if (!dry) {
        await q(`update families set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{demoDataRemovedAt}', to_jsonb(now()::text)) where id = $1`, [fam.id]);
      }
      await q(dry ? "rollback" : "commit");
    } catch (e) {
      await q("rollback");
      throw e;
    }
    const total = Object.values(removed).reduce((s, n) => s + n, 0);
    log(`${dry ? "[dry run] Would remove" : "Removed"} ${total} demo records from the ${fam.name} family (accounts and members kept).`);
    for (const [t, n] of Object.entries(removed)) log(`   ${t}: ${n}`);
    for (const k of kept) log(`   kept ${k}`);
    report.push({ familyId: fam.id, removed, kept });
  }
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_URL || process.env.NETLIFY_DB_URL || process.env.NETLIFY_DATABASE_URL;
  if (!url) {
    console.warn("No database configured; skipping demo-data cleanup.");
    process.exit(0);
  }
  // Same connection settings as the app (src/db/index.ts).
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await removeDemoData(client, { dry: process.argv.includes("--dry") });
  } finally {
    await client.end();
  }
}
