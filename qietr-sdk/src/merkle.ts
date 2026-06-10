// =============================================================================
// merkle.ts — off-chain mirror of the Poseidon-2 append-only Merkle tree.
//
// Mirrors qietr-pool/src/merkle.rs (on-chain) and the in-circuit
// MerkleTreeChecker template in qietr_payment.circom.
//
// Used by the SDK to construct inclusion proofs when an indexer is not
// available (notably in tests). In production the SDK fetches paths from
// the indexer API and only uses this for verification.
// =============================================================================

import { buildPoseidon } from "circomlibjs";

export interface MerkleInclusionProof {
  root: bigint;
  pathElements: bigint[];
  pathIndices: number[];
}

export class PoseidonMerkleTree {
  readonly depth: number;
  private readonly poseidon: ReturnType<typeof buildPoseidon> extends Promise<infer P>
    ? P
    : never;
  private readonly F: { toObject: (x: unknown) => bigint; p: bigint };
  private readonly zeros: bigint[];
  private readonly leaves: bigint[] = [];

  private constructor(depth: number, poseidon: unknown) {
    this.depth = depth;
    this.poseidon = poseidon as never;
    this.F = (poseidon as { F: { toObject: (x: unknown) => bigint; p: bigint } }).F;

    this.zeros = [0n];
    for (let i = 0; i < depth; i++) {
      const h = (poseidon as (xs: bigint[]) => unknown)([this.zeros[i]!, this.zeros[i]!]);
      this.zeros.push(this.F.toObject(h));
    }
  }

  static async create(depth: number): Promise<PoseidonMerkleTree> {
    const poseidon = await buildPoseidon();
    return new PoseidonMerkleTree(depth, poseidon);
  }

  /** Append a leaf. Returns the new tree size. */
  insert(leaf: bigint): number {
    this.leaves.push(leaf);
    return this.leaves.length;
  }

  /** Current Merkle root. */
  root(): bigint {
    return this._walkRoot();
  }

  /** Inclusion proof for the leaf at `index`. */
  proof(index: number): MerkleInclusionProof {
    if (index < 0 || index >= this.leaves.length) {
      throw new Error(`leaf index ${index} out of range`);
    }
    return this._walkProof(index);
  }

  private _walkRoot(): bigint {
    const r = this._walk(-1);
    return r as bigint;
  }

  private _walkProof(queryIndex: number): MerkleInclusionProof {
    return this._walk(queryIndex) as MerkleInclusionProof;
  }

  private _walk(queryIndex: number): bigint | MerkleInclusionProof {
    let level = this.leaves.slice();
    const pathElements: bigint[] = [];
    const pathIndices: number[] = [];
    let idx = queryIndex;

    const p = this.poseidon as (xs: bigint[]) => unknown;
    for (let d = 0; d < this.depth; d++) {
      if (idx >= 0) {
        const isRight = idx & 1;
        pathIndices.push(isRight);
        const sibIdx = idx ^ 1;
        const sibling = sibIdx < level.length ? level[sibIdx]! : this.zeros[d]!;
        pathElements.push(sibling);
        idx = idx >> 1;
      }

      const next: bigint[] = [];
      const half = Math.ceil(level.length / 2);
      for (let i = 0; i < half; i++) {
        const l = level[2 * i]!;
        const r = 2 * i + 1 < level.length ? level[2 * i + 1]! : this.zeros[d]!;
        next.push(this.F.toObject(p([l, r])));
      }
      level = next;
    }

    const root = level.length === 0 ? this.zeros[this.depth]! : level[0]!;
    if (queryIndex < 0) return root;
    return { root, pathElements, pathIndices };
  }
}
