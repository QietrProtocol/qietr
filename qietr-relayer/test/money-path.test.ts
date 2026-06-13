// =============================================================================
// money-path.test.ts — relayer economic + replay protections (§3 audit).
// =============================================================================

import { describe, it } from "node:test";
import assert from "node:assert";
import { Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { createHash } from "node:crypto";

import { createReplayGuard } from "../src/policy/replay-guard.js";
import { createSpendGuard } from "../src/policy/spend-guard.js";
import { decodeAndValidateDeposit, ValidationError } from "../src/tx-validation.js";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const PROGRAM_ID = new PublicKey("4XH6f74UFTvqx4j9UarXGrRZRrAwbnNNsRFBTfNqmWib");

function depositDisc(): Buffer {
  return createHash("sha256").update("global:deposit").digest().subarray(0, 8);
}

/** Build a base64 deposit tx: SPL transfer (to feeAta, amount) + deposit ix. */
function buildDepositTx(opts: {
  feePayer: PublicKey;
  depositor: PublicKey;
  feeDest: PublicKey;
  feeAmount: bigint;
}): string {
  const transferData = Buffer.alloc(9);
  transferData[0] = 3; // Transfer tag
  transferData.writeBigUInt64LE(opts.feeAmount, 1);
  const transferIx = new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: Keypair.generate().publicKey, isSigner: false, isWritable: true }, // source
      { pubkey: opts.feeDest, isSigner: false, isWritable: true }, // destination
      { pubkey: opts.depositor, isSigner: true, isWritable: false }, // authority
    ],
    data: transferData,
  });

  const depositData = Buffer.concat([depositDisc(), Buffer.from([1])]); // denom_id=1
  const depositIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: Keypair.generate().publicKey, isSigner: false, isWritable: false }, // config
      { pubkey: Keypair.generate().publicKey, isSigner: false, isWritable: true }, // denom
      { pubkey: Keypair.generate().publicKey, isSigner: false, isWritable: true }, // tree
      { pubkey: Keypair.generate().publicKey, isSigner: false, isWritable: true }, // vault
      { pubkey: Keypair.generate().publicKey, isSigner: false, isWritable: true }, // depositorAta
      { pubkey: opts.depositor, isSigner: true, isWritable: true }, // depositor (idx 5)
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token prog
    ],
    data: depositData,
  });

  const tx = new Transaction();
  tx.add(transferIx, depositIx);
  tx.feePayer = opts.feePayer;
  tx.recentBlockhash = "11111111111111111111111111111111";
  return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");
}

describe("replay guard", () => {
  it("admits a tx once and rejects the replay", () => {
    const g = createReplayGuard(120);
    assert.equal(g.admit("AAAA"), true);
    assert.equal(g.admit("AAAA"), false);
    assert.equal(g.admit("BBBB"), true);
  });
});

describe("spend guard", () => {
  const feePayer = Keypair.generate().publicKey;

  it("refuses below the balance floor", async () => {
    const conn = { getBalance: async () => 1_000_000 } as any;
    const g = createSpendGuard(conn, {
      feePayer,
      minBalanceLamports: 50_000_000,
      maxPerWindow: 100,
      windowSeconds: 60,
    });
    const d = await g.check();
    assert.equal(d.allowed, false);
    assert.equal(d.reason, "relayer_balance_low");
  });

  it("enforces the per-window cap", async () => {
    const conn = { getBalance: async () => 10_000_000_000 } as any;
    const g = createSpendGuard(conn, {
      feePayer,
      minBalanceLamports: 1,
      maxPerWindow: 2,
      windowSeconds: 60,
    });
    assert.equal((await g.check()).allowed, true);
    g.commit();
    assert.equal((await g.check()).allowed, true);
    g.commit();
    const d = await g.check();
    assert.equal(d.allowed, false);
    assert.equal(d.reason, "relayer_spend_cap");
  });

  it("fails closed when the balance lookup throws", async () => {
    const conn = { getBalance: async () => { throw new Error("rpc down"); } } as any;
    const g = createSpendGuard(conn, {
      feePayer,
      minBalanceLamports: 1,
      maxPerWindow: 100,
      windowSeconds: 60,
    });
    const d = await g.check();
    assert.equal(d.allowed, false);
    assert.equal(d.reason, "balance_check_failed");
  });
});

describe("deposit fee validation", () => {
  const feePayer = Keypair.generate().publicKey;
  const feeAta = Keypair.generate().publicKey;
  const depositor = Keypair.generate().publicKey;

  it("accepts a deposit paying the fee to the relayer ATA", () => {
    const tx = buildDepositTx({ feePayer, depositor, feeDest: feeAta, feeAmount: 50_000n });
    const v = decodeAndValidateDeposit(tx, PROGRAM_ID, feePayer, {
      feeAta,
      minFeeMicro: 50_000n,
    });
    assert.equal(v.feeAmountMicro, 50_000n);
    assert.ok(v.feeDestination.equals(feeAta));
  });

  it("rejects a fee routed to a different destination", () => {
    const wrong = Keypair.generate().publicKey;
    const tx = buildDepositTx({ feePayer, depositor, feeDest: wrong, feeAmount: 50_000n });
    assert.throws(
      () => decodeAndValidateDeposit(tx, PROGRAM_ID, feePayer, { feeAta, minFeeMicro: 50_000n }),
      (e: unknown) => e instanceof ValidationError && (e as ValidationError).code === "fee_to_wrong_destination",
    );
  });

  it("rejects a fee below the minimum", () => {
    const tx = buildDepositTx({ feePayer, depositor, feeDest: feeAta, feeAmount: 10n });
    assert.throws(
      () => decodeAndValidateDeposit(tx, PROGRAM_ID, feePayer, { feeAta, minFeeMicro: 50_000n }),
      (e: unknown) => e instanceof ValidationError && (e as ValidationError).code === "fee_too_low",
    );
  });
});
