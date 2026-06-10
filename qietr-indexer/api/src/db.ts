// =============================================================================
// db.ts — Postgres connection holder.
//
// Reads DATABASE_URL at first call. Pool size 10, 30s idle timeout.
// =============================================================================

import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL not set");
  }
  pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
  return pool;
}
