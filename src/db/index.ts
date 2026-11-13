import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { databaseUrl } from "./url";

const globalForDb = globalThis as unknown as { pool?: Pool };

/**
 * Serverless hosts (Netlify) run many short-lived instances, each with its own
 * pool, while hosted Postgres poolers (e.g. Supabase) cap total clients. Keep
 * each instance's pool small and release idle connections quickly.
 * PG_POOL_MAX overrides the size.
 */
const serverless = !!(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: databaseUrl(),
    max: Number(process.env.PG_POOL_MAX) || (serverless ? 2 : 10),
    idleTimeoutMillis: serverless ? 5_000 : 30_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: serverless,
  });
globalForDb.pool = pool;

export const db = drizzle(pool, { schema, casing: "snake_case" });
export type DB = typeof db;
export { schema, pool };
