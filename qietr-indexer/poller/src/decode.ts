// =============================================================================
// decode.ts — TS mirror of qietr-indexer/geyser-plugin/src/decode.rs.
//
// The geyser plugin reads on-chain accounts off the validator's banking
// thread; this poller reads the same accounts over RPC instead. Both must
// decode byte-identically, so the borsh layouts and Anchor discriminators
// below are a 1:1 port of decode.rs. If a pool struct changes there, mirror
// it here — the discriminator self-tests in the geyser crate guard renames.
//
// Discriminator = sha256("account:<StructName>")[0..8].
// =============================================================================

import { createHash } from "node:crypto";

export const MERKLE_DEPTH = 20;
export const ROOT_HISTORY_LEN = 30;

function accountDisc(name: string): Buffer {
  return createHash("sha256").update(`account:${name}`).digest().subarray(0, 8);
}

function ixDisc(method: string): Buffer {
  return createHash("sha256").update(`global:${method}`).digest().subarray(0, 8);
}

export const DISC = {
  poolConfig: accountDisc("PoolConfig"),
  denomination: accountDisc("Denomination"),
  merkleTree: accountDisc("MerkleTree"),
  nullifierRecord: accountDisc("NullifierRecord"),
  depositIx: ixDisc("deposit"),
  withdrawIx: ixDisc("withdraw"),
} as const;

export type AccountKind =
  | "PoolConfig"
  | "Denomination"
  | "MerkleTree"
  | "NullifierRecord";

export function accountKind(data: Buffer): AccountKind | null {
  if (data.length < 8) return null;
  const head = data.subarray(0, 8);
  if (head.equals(DISC.poolConfig)) return "PoolConfig";
  if (head.equals(DISC.denomination)) return "Denomination";
  if (head.equals(DISC.merkleTree)) return "MerkleTree";
  if (head.equals(DISC.nullifierRecord)) return "NullifierRecord";
  return null;
}

// --- Borsh layouts (after the 8-byte discriminator) --------------------------

export interface Denomination {
  denomId: number;
  amountMicroUsdc: bigint;
  depositCount: bigint;
  vault: Buffer; // 32 raw bytes
}

export function decodeDenomination(data: Buffer): Denomination | null {
  // disc(8) | denom_id(1) | amount_micro_usdc(u64) | deposit_count(u64)
  //        | vault(32) | mint(32) | vault_bump(1) | bump(1)
  if (data.length < 8 + 1 + 8 + 8 + 32 + 32 + 1 + 1) return null;
  let o = 8;
  const denomId = data.readUInt8(o); o += 1;
  const amountMicroUsdc = data.readBigUInt64LE(o); o += 8;
  const depositCount = data.readBigUInt64LE(o); o += 8;
  const vault = Buffer.from(data.subarray(o, o + 32)); o += 32;
  return { denomId, amountMicroUsdc, depositCount, vault };
}

export interface MerkleTreeState {
  denomId: number;
  nextLeafIndex: bigint;
  rootCursor: number;
  latestRoot: Buffer | null; // 32 raw bytes, or null if cursor out of range
}

export function decodeMerkleTree(data: Buffer): MerkleTreeState | null {
  // disc(8) | denom_id(1) | next_leaf_index(u64)
  //        | filled_subtree([32;20]) | root_history([32;30])
  //        | root_cursor(1) | bump(1) | zero_hashes([32;20])
  const filledLen = 32 * MERKLE_DEPTH;
  const historyLen = 32 * ROOT_HISTORY_LEN;
  const minLen = 8 + 1 + 8 + filledLen + historyLen + 1 + 1 + 32 * MERKLE_DEPTH;
  if (data.length < minLen) return null;

  let o = 8;
  const denomId = data.readUInt8(o); o += 1;
  const nextLeafIndex = data.readBigUInt64LE(o); o += 8;
  o += filledLen; // skip filled_subtree
  const historyStart = o;
  o += historyLen;
  const rootCursor = data.readUInt8(o); o += 1;

  // latest_root() — bounds-checked exactly like decode.rs::latest_root.
  let latestRoot: Buffer | null = null;
  if (rootCursor < ROOT_HISTORY_LEN) {
    const start = historyStart + rootCursor * 32;
    latestRoot = Buffer.from(data.subarray(start, start + 32));
  }
  return { denomId, nextLeafIndex, rootCursor, latestRoot };
}

export interface NullifierRecord {
  denomId: number;
  nullifierHash: Buffer; // 32 raw bytes
  spentAtSlot: bigint;
}

export function decodeNullifierRecord(data: Buffer): NullifierRecord | null {
  // disc(8) | denom_id(1) | nullifier_hash(32) | spent_at_slot(u64) | bump(1)
  if (data.length < 8 + 1 + 32 + 8 + 1) return null;
  let o = 8;
  const denomId = data.readUInt8(o); o += 1;
  const nullifierHash = Buffer.from(data.subarray(o, o + 32)); o += 32;
  const spentAtSlot = data.readBigUInt64LE(o); o += 8;
  return { denomId, nullifierHash, spentAtSlot };
}

// --- deposit instruction --------------------------------------------------

export interface DepositIx {
  denomId: number;
  commitment: Buffer; // 32 raw bytes (big-endian on chain)
}

/**
 * Parse a `deposit` instruction's data, mirroring
 * geyser-plugin/src/lib.rs::handle_pool_ix.
 *
 * Wire format: discriminator(8) || denom_id(1) || commitment(32).
 * Returns null if the data isn't a deposit ix or is too short.
 */
export function parseDepositIx(data: Buffer): DepositIx | null {
  if (data.length < 8 + 1 + 32) return null;
  if (!data.subarray(0, 8).equals(DISC.depositIx)) return null;
  const denomId = data.readUInt8(8);
  const commitment = Buffer.from(data.subarray(9, 9 + 32));
  return { denomId, commitment };
}

// --- withdraw instruction -------------------------------------------------
//
// A withdraw ALSO appends a leaf to the tree: the change commitment
// (`public_signals[5]`), see qietr-pool/src/lib.rs::withdraw (tree.append).
// The indexer MUST capture it or the reconstructed tree diverges from chain
// and every later proof fails its root check.
//
// Wire format (Anchor, fixed-size arrays inline, no length prefixes):
//   disc(8) | denom_id(1) | nullifier_hash(32) | proof(256)
//          | public_signals(6 × 32)
// change_commitment = public_signals[5].
const WITHDRAW_PROOF_BYTES = 256;
const WITHDRAW_PUBLIC_SIGNAL_COUNT = 6;
const WITHDRAW_CHANGE_OFFSET = 8 + 1 + 32 + WITHDRAW_PROOF_BYTES + 5 * 32; // 457
const WITHDRAW_MIN_LEN = 8 + 1 + 32 + WITHDRAW_PROOF_BYTES + WITHDRAW_PUBLIC_SIGNAL_COUNT * 32; // 489

export interface WithdrawIx {
  denomId: number;
  changeCommitment: Buffer; // 32 raw bytes (big-endian on chain)
}

/**
 * Parse a `withdraw` instruction's change commitment. Returns null if the
 * data isn't a withdraw ix or is too short.
 */
export function parseWithdrawIx(data: Buffer): WithdrawIx | null {
  if (data.length < WITHDRAW_MIN_LEN) return null;
  if (!data.subarray(0, 8).equals(DISC.withdrawIx)) return null;
  const denomId = data.readUInt8(8);
  const changeCommitment = Buffer.from(
    data.subarray(WITHDRAW_CHANGE_OFFSET, WITHDRAW_CHANGE_OFFSET + 32),
  );
  return { denomId, changeCommitment };
}
