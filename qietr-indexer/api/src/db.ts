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
  // An error on an IDLE client (e.g. the DB closed the connection) is emitted
  // on the pool. Without a listener, Node treats it as an unhandled 'error'
  // event and crashes the whole process. Log and let the pool recycle.
  pool.on("error", (err) => {
    console.error("pg pool: idle client error (recovered):", err.message);
  });
  return pool;
}
