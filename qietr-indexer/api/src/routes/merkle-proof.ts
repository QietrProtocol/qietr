import type { FastifyInstance } from "fastify";
import { getPool } from "../db.js";
import {
  beToBigInt,
  bigIntToHexBE32,
  buildInclusionPath,
  parseCommitmentParam,
} from "../poseidon-tree.js";

interface MerkleProofQuery {
  denomId?: string;
  commitment?: string;
}

interface LeafRow {
  leaf_index: string;
  commitment_be: Buffer;
}

interface RootRow {
  leaf_count: string;
  root_be: Buffer;
}

export async function merkleProofRoute(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: MerkleProofQuery }>(
    "/merkle-proof",
    async (req, reply) => {
      const { denomId, commitment } = req.query;
      if (!denomId || !commitment) {
        return reply
          .code(400)
          .send({ error: "missing_param", required: ["denomId", "commitment"] });
      }

      const denomIdNum = Number.parseInt(denomId, 10);
      if (!Number.isInteger(denomIdNum) || denomIdNum < 0 || denomIdNum > 255) {
        return reply.code(400).send({ error: "invalid_denom_id" });
      }

      let commitmentBuf: Buffer;
      try {
        commitmentBuf = parseCommitmentParam(commitment);
      } catch (e) {
        return reply.code(400).send({
          error: "invalid_commitment",
          message: (e as Error).message,
        });
      }

      const pool = getPool();

      const target = await pool.query<{ leaf_index: string }>(
        `SELECT leaf_index
           FROM commitments
          WHERE denom_id = $1 AND commitment_be = $2
          LIMIT 1`,
        [denomIdNum, commitmentBuf],
      );

      if (target.rowCount === 0) {
        return reply.code(404).send({ error: "commitment_not_found" });
      }

      const queryIndex = Number(target.rows[0]!.leaf_index);

      const allLeaves = await pool.query<LeafRow>(
        `SELECT leaf_index, commitment_be
           FROM commitments
          WHERE denom_id = $1
          ORDER BY leaf_index ASC`,
        [denomIdNum],
      );

      // Sparse-aware: if any leaf_index gaps existed they would break the
      // path. The on-chain tree is append-only, so this must be contiguous;
      // assert it explicitly to fail loud on ingest bugs.
      for (let i = 0; i < allLeaves.rows.length; i++) {
        if (Number(allLeaves.rows[i]!.leaf_index) !== i) {
          return reply.code(500).send({
            error: "ingest_gap",
            message: `expected contiguous leaf_index, found gap at ${i}`,
          });
        }
      }

      const leaves = allLeaves.rows.map((r) => beToBigInt(r.commitment_be));
      const path = await buildInclusionPath(leaves, queryIndex);

      // Cross-check against the latest stored root for this leaf-count, if
      // present. If the indexer's computed root doesn't match the chain's
      // stored root, the SDK proof will be wasted — better to fail here.
      const expectedSize = leaves.length;
      const rootRow = await pool.query<RootRow>(
        `SELECT leaf_count, root_be
           FROM roots
          WHERE denom_id = $1 AND leaf_count = $2
          LIMIT 1`,
        [denomIdNum, expectedSize],
      );
      if ((rootRow.rowCount ?? 0) > 0) {
        const onChainRoot = beToBigInt(rootRow.rows[0]!.root_be);
        if (onChainRoot !== path.root) {
          return reply.code(500).send({
            error: "root_mismatch",
            expectedRoot: bigIntToHexBE32(onChainRoot),
            computedRoot: bigIntToHexBE32(path.root),
          });
        }
      }

      return reply.send({
        denomId: denomIdNum,
        leafIndex: queryIndex,
        leafCount: leaves.length,
        root: bigIntToHexBE32(path.root),
        pathElements: path.pathElements.map(bigIntToHexBE32),
        pathIndices: path.pathIndices,
      });
    },
  );
}
