// =============================================================================
// hash.ts — single Poseidon binding used across SDK modules.
//
// Centralizing the `buildPoseidon` call avoids loading the hasher three
// times (deposit / prover / merkle) and gives one obvious place to swap
// the implementation if we ever move off circomlibjs.
// =============================================================================

import { buildPoseidon } from "circomlibjs";

export interface PoseidonHasher {
  (xs: ReadonlyArray<bigint | string | number>): unknown;
  F: { toObject(x: unknown): bigint; p: bigint };
}

let cached: PoseidonHasher | null = null;

export async function getPoseidon(): Promise<PoseidonHasher> {
  if (cached) return cached;
  cached = (await buildPoseidon()) as unknown as PoseidonHasher;
  return cached;
}

/** `Poseidon3(secret, nullifier, amount)` returning a decimal-string field. */
export async function commitmentHash(
  secretDec: string,
  nullifierDec: string,
  amountMicroUsdc: bigint,
): Promise<string> {
  const p = await getPoseidon();
  const h = p([BigInt(secretDec), BigInt(nullifierDec), amountMicroUsdc]);
  return p.F.toObject(h).toString();
}

/** `Poseidon1(nullifier)` returning a decimal-string field. */
export async function nullifierHash(nullifierDec: string): Promise<string> {
  const p = await getPoseidon();
  const h = p([BigInt(nullifierDec)]);
  return p.F.toObject(h).toString();
}
