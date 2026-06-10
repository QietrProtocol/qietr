// program.ts — instruction encoding tests.
// Confirms wire format matches qietr-pool/programs/qietr_pool/src/lib.rs.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PublicKey } from "@solana/web3.js";

import {
  buildDepositIx,
  buildWithdrawIx,
  findPoolConfigPda,
  findDenominationPda,
  findMerkleTreePda,
  findVaultPda,
  findNullifierPda,
  QIETR_POOL_PROGRAM_ID,
} from "../dist/index.js";

const dummyOwner = new PublicKey("11111111111111111111111111111111");

describe("buildDepositIx", () => {
  it("encodes (denom_id, commitment) as discriminator || u8 || 32 bytes", () => {
    const commitment = new Uint8Array(32);
    for (let i = 0; i < 32; i++) commitment[i] = i;

    const [config] = findPoolConfigPda();
    const [denom] = findDenominationPda(2);
    const [tree] = findMerkleTreePda(2);
    const [vault] = findVaultPda(2);
    const depositorAta = new PublicKey("So11111111111111111111111111111111111111112");

    const ix = buildDepositIx(2, commitment, {
      config,
      denomination: denom,
      tree,
      vault,
      depositorAta,
      depositor: dummyOwner,
    });

    assert.equal(ix.programId.toBase58(), QIETR_POOL_PROGRAM_ID.toBase58());
    assert.equal(ix.data.length, 8 + 1 + 32, "deposit ix data is 41 bytes");
    assert.equal(ix.data[8], 2, "denom_id at offset 8");
    for (let i = 0; i < 32; i++) {
      assert.equal(ix.data[9 + i], i, `commitment byte ${i}`);
    }
    assert.equal(ix.keys.length, 7, "deposit has 7 account metas");
    assert.equal(ix.keys[5].isSigner, true, "depositor is signer");
  });

  it("rejects non-32-byte commitments", () => {
    assert.throws(
      () =>
        buildDepositIx(
          0,
          new Uint8Array(16),
          {
            config: dummyOwner,
            denomination: dummyOwner,
            tree: dummyOwner,
            vault: dummyOwner,
            depositorAta: dummyOwner,
            depositor: dummyOwner,
          },
        ),
      /commitment must be 32 bytes/,
    );
  });
});

describe("buildWithdrawIx", () => {
  it("encodes proof + public signals in fixed 489-byte layout", () => {
    const nullifierHash = new Uint8Array(32).fill(0xab);
    const proof = new Uint8Array(256).fill(0xcd);
    const publicSignals = Array.from({ length: 6 }, (_, i) =>
      new Uint8Array(32).fill(i + 1),
    );

    const [config] = findPoolConfigPda();
    const [denom] = findDenominationPda(1);
    const [tree] = findMerkleTreePda(1);
    const [vault] = findVaultPda(1);
    const [nullifier] = findNullifierPda(1, nullifierHash);
    const recipientAta = new PublicKey("So11111111111111111111111111111111111111112");

    const ix = buildWithdrawIx(
      1,
      nullifierHash,
      proof,
      publicSignals,
      {
        config,
        denomination: denom,
        tree,
        vault,
        nullifier,
        recipientAta,
        feePayer: dummyOwner,
      },
    );

    assert.equal(ix.data.length, 8 + 1 + 32 + 256 + 192, "withdraw ix data is 489 bytes");
    assert.equal(ix.data[8], 1, "denom_id at offset 8");
    assert.equal(ix.keys.length, 10, "withdraw has 10 account metas (fee_vault added)");
    assert.equal(ix.keys[7].isSigner, true, "fee_payer is signer (index 7)");
  });

  it("includes fee_vault account when provided", () => {
    const nullifierHash = new Uint8Array(32).fill(0xab);
    const proof = new Uint8Array(256).fill(0xcd);
    const publicSignals = Array.from({ length: 6 }, () => new Uint8Array(32));
    const feeVault = new PublicKey("11111111111111111111111111111111");

    const [config] = findPoolConfigPda();
    const [denom] = findDenominationPda(1);
    const [tree] = findMerkleTreePda(1);
    const [vault] = findVaultPda(1);
    const [nullifier] = findNullifierPda(1, nullifierHash);

    const ix = buildWithdrawIx(1, nullifierHash, proof, publicSignals, {
      config, denomination: denom, tree, vault, nullifier,
      recipientAta: dummyOwner, feePayer: dummyOwner, feeVault,
    });

    assert.equal(ix.keys.length, 10);
    assert.equal(ix.keys[6].pubkey.toBase58(), feeVault.toBase58(), "fee_vault at index 6");
    assert.equal(ix.keys[7].isSigner, true, "fee_payer at index 7");
  });

  it("rejects malformed proof / signals lengths", () => {
    const [config] = findPoolConfigPda();
    const [denom] = findDenominationPda(0);
    const [tree] = findMerkleTreePda(0);
    const [vault] = findVaultPda(0);
    const [nullifier] = findNullifierPda(0, new Uint8Array(32));
    const accts = {
      config,
      denomination: denom,
      tree,
      vault,
      nullifier,
      recipientAta: dummyOwner,
      feePayer: dummyOwner,
    };
    const goodSignals = Array.from({ length: 6 }, () => new Uint8Array(32));

    assert.throws(
      () =>
        buildWithdrawIx(
          0,
          new Uint8Array(32),
          new Uint8Array(200),
          goodSignals,
          accts,
        ),
      /proof must be 256 bytes/,
    );
    assert.throws(
      () =>
        buildWithdrawIx(
          0,
          new Uint8Array(32),
          new Uint8Array(256),
          goodSignals.slice(0, 5),
          accts,
        ),
      /expected 6 public signals/,
    );
  });
});

describe("PDA derivations", () => {
  it("are deterministic", () => {
    const a = findPoolConfigPda();
    const b = findPoolConfigPda();
    assert.equal(a[0].toBase58(), b[0].toBase58());
    assert.equal(a[1], b[1]);
  });
  it("denom PDA depends on denom_id", () => {
    const a = findDenominationPda(0);
    const b = findDenominationPda(1);
    assert.notEqual(a[0].toBase58(), b[0].toBase58());
  });
  it("nullifier PDA depends on the hash bytes", () => {
    const h1 = new Uint8Array(32).fill(1);
    const h2 = new Uint8Array(32).fill(2);
    assert.notEqual(
      findNullifierPda(0, h1)[0].toBase58(),
      findNullifierPda(0, h2)[0].toBase58(),
    );
  });
});
