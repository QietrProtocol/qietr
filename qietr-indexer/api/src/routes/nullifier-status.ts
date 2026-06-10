import type { FastifyInstance } from "fastify";
import { getPool } from "../db.js";
import { parseCommitmentParam } from "../poseidon-tree.js";

interface NullifierStatusQuery {
  denomId?: string;
  nullifierHash?: string;
}

interface NullifierRow {
  spent_at_slot: string;
  spent_at: Date;
}

export async function nullifierStatusRoute(
  app: FastifyInstance,
): Promise<void> {
  app.get<{ Querystring: NullifierStatusQuery }>(
    "/nullifier-status",
    async (req, reply) => {
      const { denomId, nullifierHash } = req.query;
      if (!denomId || !nullifierHash) {
        return reply.code(400).send({
          error: "missing_param",
          required: ["denomId", "nullifierHash"],
        });
      }

      const denomIdNum = Number.parseInt(denomId, 10);
      if (!Number.isInteger(denomIdNum) || denomIdNum < 0 || denomIdNum > 255) {
        return reply.code(400).send({ error: "invalid_denom_id" });
      }

      let nullifierBuf: Buffer;
      try {
        nullifierBuf = parseCommitmentParam(nullifierHash);
      } catch (e) {
        return reply.code(400).send({
          error: "invalid_nullifier_hash",
          message: (e as Error).message,
        });
      }

      const pool = getPool();
      const result = await pool.query<NullifierRow>(
        `SELECT spent_at_slot, spent_at
           FROM nullifiers
          WHERE denom_id = $1 AND nullifier_hash_be = $2
          LIMIT 1`,
        [denomIdNum, nullifierBuf],
      );

      if (result.rowCount === 0) {
        return reply.send({ spent: false });
      }

      const row = result.rows[0]!;
      return reply.send({
        spent: true,
        spentAtSlot: row.spent_at_slot,
        spentAt: row.spent_at.toISOString(),
      });
    },
  );
}
