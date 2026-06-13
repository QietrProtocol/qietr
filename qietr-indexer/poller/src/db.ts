// =============================================================================
// db.ts — Postgres writer for the poller.
//
// SQL here is a 1:1 port of qietr-indexer/geyser-plugin/src/writer.rs so the
// poller and the geyser plugin produce identical rows. All upserts are
// idempotent: re-running the poller over already-ingested slots is a no-op.
// =============================================================================

import pg from "pg";
import fs from "node:fs";
import type { ConnectionOptions } from "node:tls";

const { Pool } = pg;

// Mirrors qietr-indexer/api/src/ssl.ts — TLS on for managed Postgres (Neon).
function resolveSsl(connectionString: string): boolean | ConnectionOptions {
  const url = connectionString.toLowerCase();
  const envMode = (process.env.PGSSL ?? "").toLowerCase();
  if (envMode === "disable" || envMode === "false") return false;
  const wantsTls =
    envMode === "require" ||
    envMode === "true" ||
    url.includes("sslmode=require") ||
    url.includes("sslmode=verify") ||
    url.includes("ssl=true");
  if (!wantsTls) return false;
  const caPath = process.env.PGSSL_CA;
  if (caPath) {
    return { ca: fs.readFileSync(caPath, "utf8"), rejectUnauthorized: true };
  }
  return { rejectUnauthorized: false };
}

export class Db {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: resolveSsl(connectionString),
      max: 4,
      idleTimeoutMillis: 30_000,
    });
    this.pool.on("error", (err) => {
      console.error("pg pool: idle client error (recovered):", err.message);
    });
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async ping(): Promise<void> {
    await this.pool.query("SELECT 1");
  }

  async upsertDenomination(d: {
    denomId: number;
    amountMicroUsdc: bigint;
    depositCount: bigint;
    vaultAddress: string;
    lastSeenSlot: number;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO denominations
         (denom_id, amount_micro_usdc, deposit_count, vault_address, last_seen_slot, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (denom_id) DO UPDATE SET
         amount_micro_usdc = EXCLUDED.amount_micro_usdc,
         deposit_count     = EXCLUDED.deposit_count,
         vault_address     = EXCLUDED.vault_address,
         last_seen_slot    = GREATEST(denominations.last_seen_slot, EXCLUDED.last_seen_slot),
         updated_at        = NOW()`,
      [
        d.denomId,
        d.amountMicroUsdc.toString(),
        d.depositCount.toString(),
        d.vaultAddress,
        d.lastSeenSlot,
      ],
    );
  }

  async upsertRoot(r: {
    denomId: number;
    leafCount: bigint;
    rootBe: Buffer;
    insertedSlot: number;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO roots (denom_id, leaf_count, root_be, inserted_slot)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (denom_id, leaf_count) DO UPDATE SET
         root_be       = EXCLUDED.root_be,
         inserted_slot = LEAST(roots.inserted_slot, EXCLUDED.inserted_slot)`,
      [r.denomId, r.leafCount.toString(), r.rootBe, r.insertedSlot],
    );
  }

  async insertCommitment(c: {
    denomId: number;
    leafIndex: number;
    commitmentBe: Buffer;
    insertedSlot: number;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO commitments (denom_id, leaf_index, commitment_be, inserted_slot)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (denom_id, leaf_index) DO NOTHING`,
      [c.denomId, c.leafIndex, c.commitmentBe, c.insertedSlot],
    );
  }

  async insertNullifier(n: {
    denomId: number;
    nullifierHashBe: Buffer;
    spentAtSlot: number;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO nullifiers (denom_id, nullifier_hash_be, spent_at_slot)
       VALUES ($1, $2, $3)
       ON CONFLICT (denom_id, nullifier_hash_be) DO NOTHING`,
      [n.denomId, n.nullifierHashBe, n.spentAtSlot],
    );
  }

  async checkpoint(c: {
    component: string;
    lastSlot: number;
    lastSignature: string | null;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO ingest_progress (component, last_slot, last_signature, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (component) DO UPDATE SET
         last_slot      = GREATEST(ingest_progress.last_slot, EXCLUDED.last_slot),
         last_signature = EXCLUDED.last_signature,
         updated_at     = NOW()`,
      [c.component, c.lastSlot, c.lastSignature],
    );
  }

  /** Read the last processed signature for resume, if any. */
  async getCheckpoint(
    component: string,
  ): Promise<{ lastSlot: number; lastSignature: string | null } | null> {
    const res = await this.pool.query<{
      last_slot: string;
      last_signature: string | null;
    }>(
      `SELECT last_slot, last_signature FROM ingest_progress WHERE component = $1`,
      [component],
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      lastSlot: Number(row.last_slot),
      lastSignature: row.last_signature,
    };
  }

  /**
   * Highest leaf_index already stored for a denom, or -1 if none. The poller
   * uses this to assign leaf_index to new commitments, mirroring the geyser
   * plugin's in-memory counter but persisted across restarts.
   */
  async maxLeafIndex(denomId: number): Promise<number> {
    const res = await this.pool.query<{ max: string | null }>(
      `SELECT MAX(leaf_index)::bigint AS max FROM commitments WHERE denom_id = $1`,
      [denomId],
    );
    const max = res.rows[0]?.max;
    return max == null ? -1 : Number(max);
  }

  /**
   * Whether this commitment value is already indexed for the denom.
   * Commitments are cryptographically unique (Poseidon of secret/nullifier,
   * and change commitments likewise), so value-dedup makes re-scans idempotent:
   * an already-seen leaf is skipped without consuming a leaf_index, which keeps
   * indices correct even if a signature batch is replayed after a crash.
   */
  async commitmentExists(denomId: number, commitmentBe: Buffer): Promise<boolean> {
    const res = await this.pool.query(
      `SELECT 1 FROM commitments WHERE denom_id = $1 AND commitment_be = $2 LIMIT 1`,
      [denomId, commitmentBe],
    );
    return (res.rowCount ?? 0) > 0;
  }
}
