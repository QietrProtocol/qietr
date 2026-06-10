// =============================================================================
// poseidon-tree.ts — server-side Poseidon Merkle helper.
//
// Mirrors qietr-sdk/src/merkle.ts and qietr-pool/src/merkle.rs. Used by the
// merkle-proof route to build inclusion paths from the flat `commitments`
// table.
//
// Depth and zero-hash convention MUST stay in lockstep with the on-chain
// program (depth 20, zero-hash chain starts at 0n).
// =============================================================================

import { buildPoseidon } from "circomlibjs";

export const MERKLE_DEPTH = 20;

interface PoseidonHasher {
  (xs: bigint[]): unknown;
  F: { toObject(x: unknown): bigint };
}

let cached: PoseidonHasher | null = null;
async function getHasher(): Promise<PoseidonHasher> {
  if (cached) return cached;
  cached = (await buildPoseidon()) as unknown as PoseidonHasher;
  return cached;
}

let cachedZeros: bigint[] | null = null;
async function getZeroHashes(): Promise<bigint[]> {
  if (cachedZeros) return cachedZeros;
  const p = await getHasher();
  const zeros: bigint[] = [0n];
  for (let i = 0; i < MERKLE_DEPTH; i++) {
    zeros.push(p.F.toObject(p([zeros[i]!, zeros[i]!])));
  }
  cachedZeros = zeros;
  return zeros;
}

export interface InclusionPath {
  pathElements: bigint[];
  pathIndices: number[];
  root: bigint;
}

/**
 * Build inclusion proof for `queryIndex` against the given ordered leaves.
 * Leaves array length must equal the tree's current leaf-count. Missing
 * siblings are filled with the zero-hash at the right level.
 */
export async function buildInclusionPath(
  leaves: bigint[],
  queryIndex: number,
): Promise<InclusionPath> {
  if (queryIndex < 0 || queryIndex >= leaves.length) {
    throw new Error(`leaf index ${queryIndex} out of range (size=${leaves.length})`);
  }
  const p = await getHasher();
  const zeros = await getZeroHashes();

  const pathElements: bigint[] = [];
  const pathIndices: number[] = [];

  let level = leaves.slice();
  let idx = queryIndex;
  for (let d = 0; d < MERKLE_DEPTH; d++) {
    const isRight = idx & 1;
    pathIndices.push(isRight);
    const sibIdx = idx ^ 1;
    const sibling = sibIdx < level.length ? level[sibIdx]! : zeros[d]!;
    pathElements.push(sibling);
    idx = idx >> 1;

    const next: bigint[] = [];
    const half = Math.ceil(level.length / 2);
    for (let i = 0; i < half; i++) {
      const l = level[2 * i]!;
      const r = 2 * i + 1 < level.length ? level[2 * i + 1]! : zeros[d]!;
      next.push(p.F.toObject(p([l, r])));
    }
    level = next;
  }

  const root = level.length === 0 ? zeros[MERKLE_DEPTH]! : level[0]!;
  return { pathElements, pathIndices, root };
}

/** Big-endian Buffer (≤32 bytes) → bigint. */
export function beToBigInt(buf: Buffer): bigint {
  let n = 0n;
  for (const b of buf) n = (n << 8n) | BigInt(b);
  return n;
}

/** bigint → 32-byte big-endian hex string with 0x prefix. */
export function bigIntToHexBE32(n: bigint): string {
  let hex = n.toString(16);
  if (hex.length > 64) throw new Error("value exceeds 32 bytes");
  hex = hex.padStart(64, "0");
  return "0x" + hex;
}

/**
 * Parse a commitment query parameter that may be hex (`0x...`) or decimal.
 * Returns big-endian 32-byte Buffer for DB lookup.
 */
export function parseCommitmentParam(s: string): Buffer {
  let n: bigint;
  if (s.startsWith("0x") || s.startsWith("0X")) {
    n = BigInt(s);
  } else {
    n = BigInt(s);
  }
  let hex = n.toString(16);
  if (hex.length > 64) throw new Error("commitment exceeds 32 bytes");
  hex = hex.padStart(64, "0");
  return Buffer.from(hex, "hex");
}
