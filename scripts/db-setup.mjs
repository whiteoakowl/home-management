/**
 * Runs on every deploy (see netlify.toml): applies database migrations, then
 * removes the sample records older versions loaded on first deploy (accounts
 * and family members are always kept; see scripts/remove-demo-data.mjs).
 * It never adds sample data. Safe to run repeatedly.
 * Without a database URL it warns and exits cleanly so the site still deploys.
 */
import { execSync } from "node:child_process";

const url = process.env.DATABASE_URL || process.env.NETLIFY_DB_URL || process.env.NETLIFY_DATABASE_URL;
if (!url) {
  console.warn("\n⚠️  No database configured (DATABASE_URL / NETLIFY_DB_URL). Skipping migrations.\n   Sign-in will not work until a database is added. See README → Deploying.\n");
  process.exit(0);
}
const run = (cmd) => execSync(cmd, { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
run("npx drizzle-kit migrate");
run("node scripts/secure-tables.mjs");
run("node scripts/ensure-indexes.mjs");
if (process.env.KEEP_DEMO_DATA !== "1") run("node scripts/remove-demo-data.mjs");
