import type { FastifyInstance } from "fastify";
import { getPool } from "../db.js";

interface DenominationRow {
  denom_id: number;
  amount_micro_usdc: string;
  deposit_count: string;
  vault_address: string;
  last_seen_slot: string;
  updated_at: Date;
}

interface RootRow {
  denom_id: number;
  leaf_count: string;
  root_be: Buffer;
}

function bufferToHex(buf: Buffer): string {
  return "0x" + buf.toString("hex");
}

export async function denominationsRoute(app: FastifyInstance): Promise<void> {
  app.get("/denominations", async (_req, reply) => {
    const pool = getPool();

    const denomsResult = await pool.query<DenominationRow>(
      `SELECT denom_id, amount_micro_usdc, deposit_count, vault_address,
              last_seen_slot, updated_at
         FROM denominations
        ORDER BY denom_id ASC`,
    );

    if (denomsResult.rowCount === 0) {
      return reply.send({ denominations: [] });
    }

    const denomIds = denomsResult.rows.map((r) => r.denom_id);
    const rootsResult = await pool.query<RootRow>(
      `SELECT DISTINCT ON (denom_id) denom_id, leaf_count, root_be
         FROM roots
        WHERE denom_id = ANY($1::smallint[])
        ORDER BY denom_id ASC, leaf_count DESC`,
      [denomIds],
    );
    const latestRootByDenom = new Map<number, RootRow>();
    for (const r of rootsResult.rows) latestRootByDenom.set(r.denom_id, r);

    return reply.send({
      denominations: denomsResult.rows.map((row) => {
        const latest = latestRootByDenom.get(row.denom_id);
        return {
          denomId: row.denom_id,
          amountMicroUsdc: row.amount_micro_usdc,
          depositCount: row.deposit_count,
          vaultAddress: row.vault_address,
          lastSeenSlot: row.last_seen_slot,
          currentRoot: latest ? bufferToHex(latest.root_be) : null,
          leafCount: latest ? latest.leaf_count : "0",
          updatedAt: row.updated_at.toISOString(),
        };
      }),
    });
  });
}
