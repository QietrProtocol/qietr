// Locks the TS decoders to the SAME byte vectors the geyser crate's Rust
// tests assert (qietr-indexer/geyser-plugin/src/decode.rs). If these drift,
// the poller would write rows the API/SDK can't reconcile — fail loud.
//
// Run: node --test test/decode.test.mjs   (after `npm run build`)

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DISC,
  decodeDenomination,
  decodeMerkleTree,
  decodeNullifierRecord,
  parseDepositIx,
  parseWithdrawIx,
  MERKLE_DEPTH,
  ROOT_HISTORY_LEN,
} from "../dist/decode.js";

const hex = (b) => Buffer.from(b).toString("hex");

test("account discriminators match decode.rs vectors", () => {
  assert.equal(hex(DISC.poolConfig), "1a6c0e7b74e6812b");
  assert.equal(hex(DISC.denomination), "ff5ff62838a36b55");
  assert.equal(hex(DISC.merkleTree), "623333e2a21449d4");
  assert.equal(hex(DISC.nullifierRecord), "381239af45cabd46");
});

test("instruction discriminators match decode.rs vectors", () => {
  assert.equal(hex(DISC.depositIx), "f223c68952e1f2b6");
  assert.equal(hex(DISC.withdrawIx), "b712469c946da122");
});

test("decodeDenomination reads borsh layout", () => {
  const buf = Buffer.concat([
    DISC.denomination, // disc(8)
    Buffer.from([3]), // denom_id = 3
    le64(1_000_000n), // amount_micro_usdc
    le64(42n), // deposit_count
    Buffer.alloc(32, 0xaa), // vault
    Buffer.alloc(32, 0xbb), // mint
    Buffer.from([1]), // vault_bump
    Buffer.from([2]), // bump
  ]);
  const d = decodeDenomination(buf);
  assert.ok(d);
  assert.equal(d.denomId, 3);
  assert.equal(d.amountMicroUsdc, 1_000_000n);
  assert.equal(d.depositCount, 42n);
  assert.equal(hex(d.vault), "aa".repeat(32));
});

test("decodeMerkleTree picks the cursor-indexed root", () => {
  const filled = Buffer.alloc(32 * MERKLE_DEPTH, 0);
  const history = Buffer.alloc(32 * ROOT_HISTORY_LEN, 0);
  // put a recognizable root at cursor index 5
  Buffer.alloc(32, 0x77).copy(history, 5 * 32);
  const zeros = Buffer.alloc(32 * MERKLE_DEPTH, 0);
  const buf = Buffer.concat([
    DISC.merkleTree,
    Buffer.from([2]), // denom_id
    le64(7n), // next_leaf_index
    filled,
    history,
    Buffer.from([5]), // root_cursor
    Buffer.from([9]), // bump
    zeros,
  ]);
  const t = decodeMerkleTree(buf);
  assert.ok(t);
  assert.equal(t.denomId, 2);
  assert.equal(t.nextLeafIndex, 7n);
  assert.equal(t.rootCursor, 5);
  assert.equal(hex(t.latestRoot), "77".repeat(32));
});

test("decodeMerkleTree returns null root for out-of-range cursor", () => {
  const filled = Buffer.alloc(32 * MERKLE_DEPTH, 0);
  const history = Buffer.alloc(32 * ROOT_HISTORY_LEN, 0);
  const zeros = Buffer.alloc(32 * MERKLE_DEPTH, 0);
  const buf = Buffer.concat([
    DISC.merkleTree,
    Buffer.from([0]),
    le64(0n),
    filled,
    history,
    Buffer.from([ROOT_HISTORY_LEN]), // cursor == len → out of range
    Buffer.from([0]),
    zeros,
  ]);
  const t = decodeMerkleTree(buf);
  assert.ok(t);
  assert.equal(t.latestRoot, null);
});

test("decodeNullifierRecord reads borsh layout", () => {
  const buf = Buffer.concat([
    DISC.nullifierRecord,
    Buffer.from([4]), // denom_id
    Buffer.alloc(32, 0xcd), // nullifier_hash
    le64(123456n), // spent_at_slot
    Buffer.from([1]), // bump
  ]);
  const n = decodeNullifierRecord(buf);
  assert.ok(n);
  assert.equal(n.denomId, 4);
  assert.equal(hex(n.nullifierHash), "cd".repeat(32));
  assert.equal(n.spentAtSlot, 123456n);
});

test("parseDepositIx extracts denom_id + commitment", () => {
  const commitment = Buffer.alloc(32, 0xef);
  const buf = Buffer.concat([DISC.depositIx, Buffer.from([6]), commitment]);
  const d = parseDepositIx(buf);
  assert.ok(d);
  assert.equal(d.denomId, 6);
  assert.equal(hex(d.commitment), "ef".repeat(32));
});

test("parseDepositIx rejects non-deposit ix", () => {
  const buf = Buffer.concat([DISC.withdrawIx, Buffer.alloc(33, 0)]);
  assert.equal(parseDepositIx(buf), null);
});

test("parseWithdrawIx extracts denom_id + change commitment (public_signals[5])", () => {
  // disc(8) | denom_id(1) | nullifier_hash(32) | proof(256) | 6×signal(32)
  const change = Buffer.alloc(32, 0x5c);
  const signals = Buffer.concat([
    Buffer.alloc(32, 0x10), // [0] amount
    Buffer.alloc(32, 0x11), // [1] root
    Buffer.alloc(32, 0x12), // [2] nullifier
    Buffer.alloc(32, 0x13), // [3] recipient
    Buffer.alloc(32, 0x14), // [4] payment
    change, //                 [5] change commitment
  ]);
  const buf = Buffer.concat([
    DISC.withdrawIx,
    Buffer.from([9]), // denom_id
    Buffer.alloc(32, 0xaa), // nullifier_hash_arg
    Buffer.alloc(256, 0xbb), // proof
    signals,
  ]);
  const w = parseWithdrawIx(buf);
  assert.ok(w);
  assert.equal(w.denomId, 9);
  assert.equal(hex(w.changeCommitment), "5c".repeat(32));
});

test("parseWithdrawIx rejects deposit ix and short data", () => {
  assert.equal(parseWithdrawIx(Buffer.concat([DISC.depositIx, Buffer.alloc(481, 0)])), null);
  assert.equal(parseWithdrawIx(Buffer.concat([DISC.withdrawIx, Buffer.alloc(10, 0)])), null);
});

function le64(n) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}
