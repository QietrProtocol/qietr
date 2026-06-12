// =============================================================================
// program.ts — qietr_pool on-chain interface (PDAs + instruction builders).
//
// Hand-crafted because the Anchor IDL won't ship until `anchor build`
// completes (see SESSION_STATE.md toolchain blocker). Discriminators and
// account ordering MUST match qietr-pool/programs/qietr_pool/src/lib.rs.
//
// When the IDL lands the bodies here can be replaced with @coral-xyz/anchor
// program builders, but the PDA helpers stay.
// =============================================================================

import { sha256 } from "@noble/hashes/sha2";
import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";

/** Pool program-id — matches `declare_id!` in qietr_pool/src/lib.rs. */
export const QIETR_POOL_PROGRAM_ID = new PublicKey(
  "4XH6f74UFTvqx4j9UarXGrRZRrAwbnNNsRFBTfNqmWib",
);

/** SPL Token program-id (canonical). */
export const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);

/**
 * Anchor's instruction discriminator: first 8 bytes of
 * `sha256("global:<snake_case_method_name>")`.
 */
export function anchorIxDiscriminator(name: string): Uint8Array {
  const full = sha256(new TextEncoder().encode(`global:${name}`));
  return full.slice(0, 8);
}

// -----------------------------------------------------------------------------
// PDA derivations
// -----------------------------------------------------------------------------

export function findPoolConfigPda(
  programId: PublicKey = QIETR_POOL_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("config")], programId);
}

export function findDenominationPda(
  denomId: number,
  programId: PublicKey = QIETR_POOL_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("denom"), Uint8Array.from([denomId & 0xff])],
    programId,
  );
}

export function findMerkleTreePda(
  denomId: number,
  programId: PublicKey = QIETR_POOL_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("tree"), Uint8Array.from([denomId & 0xff])],
    programId,
  );
}

export function findVaultPda(
  denomId: number,
  programId: PublicKey = QIETR_POOL_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), Uint8Array.from([denomId & 0xff])],
    programId,
  );
}

export function findNullifierPda(
  denomId: number,
  nullifierHashBe: Uint8Array,
  programId: PublicKey = QIETR_POOL_PROGRAM_ID,
): [PublicKey, number] {
  if (nullifierHashBe.length !== 32) {
    throw new Error(`nullifier hash must be 32 bytes, got ${nullifierHashBe.length}`);
  }
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("nullifier"),
      Uint8Array.from([denomId & 0xff]),
      nullifierHashBe,
    ],
    programId,
  );
}

// -----------------------------------------------------------------------------
// SPL Token transfer instruction builder (no spl-token dep needed)
// -----------------------------------------------------------------------------

/**
 * Build an SPL Token `Transfer` instruction.
 * Tag 3 = Transfer, amount is 8-byte LE.
 */
export function buildTransferIx(
  source: PublicKey,
  destination: PublicKey,
  authority: PublicKey,
  amountMicro: bigint | number,
  tokenProgram: PublicKey = TOKEN_PROGRAM_ID,
): TransactionInstruction {
  const amount = BigInt(amountMicro);
  const amountBytes = new Uint8Array(8);
  const dv = new DataView(amountBytes.buffer);
  dv.setBigUint64(0, amount, true);

  const data = new Uint8Array(1 + 8);
  data[0] = 3; // Transfer tag
  data.set(amountBytes, 1);

  return new TransactionInstruction({
    programId: tokenProgram,
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data: Buffer.from(data),
  });
}

// -----------------------------------------------------------------------------
// Instruction builders
// -----------------------------------------------------------------------------

export interface DepositIxAccounts {
  config: PublicKey;
  denomination: PublicKey;
  tree: PublicKey;
  vault: PublicKey;
  depositorAta: PublicKey;
  depositor: PublicKey;
  tokenProgram?: PublicKey;
}

/**
 * Build the on-chain `deposit(denom_id, commitment)` instruction.
 *
 * Wire format (matches lib.rs::deposit):
 *   discriminator (8) || denom_id (1) || commitment (32)
 *
 * Account order must match the `Deposit<'info>` context in lib.rs:
 *   config, denomination, tree, vault, depositor_ata, depositor (signer),
 *   token_program.
 */
export function buildDepositIx(
  denomId: number,
  commitmentBe: Uint8Array,
  accts: DepositIxAccounts,
  programId: PublicKey = QIETR_POOL_PROGRAM_ID,
): TransactionInstruction {
  if (commitmentBe.length !== 32) {
    throw new Error(`commitment must be 32 bytes, got ${commitmentBe.length}`);
  }
  const disc = anchorIxDiscriminator("deposit");
  const data = new Uint8Array(8 + 1 + 32);
  data.set(disc, 0);
  data[8] = denomId & 0xff;
  data.set(commitmentBe, 9);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: accts.config, isSigner: false, isWritable: false },
      { pubkey: accts.denomination, isSigner: false, isWritable: true },
      { pubkey: accts.tree, isSigner: false, isWritable: true },
      { pubkey: accts.vault, isSigner: false, isWritable: true },
      { pubkey: accts.depositorAta, isSigner: false, isWritable: true },
      { pubkey: accts.depositor, isSigner: true, isWritable: true },
      {
        pubkey: accts.tokenProgram ?? TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
    ],
    data: Buffer.from(data),
  });
}

export interface WithdrawIxAccounts {
  config: PublicKey;
  denomination: PublicKey;
  tree: PublicKey;
  vault: PublicKey;
  nullifier: PublicKey;
  recipientAta: PublicKey;
  feePayer: PublicKey;
  /** Optional fee vault ATA for protocol fee distribution. */
  feeVault?: PublicKey;
  tokenProgram?: PublicKey;
  systemProgram?: PublicKey;
}

/**
 * Build the on-chain `withdraw(denom_id, nullifier_hash, proof, public_signals)`
 * instruction.
 *
 * Wire format (matches lib.rs::withdraw):
 *   discriminator (8) || denom_id (1) || nullifier_hash (32)
 *     || proof (256) || public_signals (6 * 32 = 192)
 *
 * Total data: 489 bytes.
 *
 * `proof` is the packed 256-byte form from prover.ts `Groth16Proof.proofBytes`.
 * `publicSignals` is the array of 6 BE32 field elements in
 * [nullifierHash, root, recipient, paymentAmount, changeCommitment, amount].
 */
export function buildWithdrawIx(
  denomId: number,
  nullifierHashBe: Uint8Array,
  proofBytes: Uint8Array,
  publicSignals: Uint8Array[],
  accts: WithdrawIxAccounts,
  programId: PublicKey = QIETR_POOL_PROGRAM_ID,
): TransactionInstruction {
  if (nullifierHashBe.length !== 32) {
    throw new Error(`nullifier hash must be 32 bytes`);
  }
  if (proofBytes.length !== 256) {
    throw new Error(`proof must be 256 bytes, got ${proofBytes.length}`);
  }
  if (publicSignals.length !== 6) {
    throw new Error(`expected 6 public signals, got ${publicSignals.length}`);
  }
  for (const [i, ps] of publicSignals.entries()) {
    if (ps.length !== 32) {
      throw new Error(`public_signals[${i}] must be 32 bytes, got ${ps.length}`);
    }
  }

  const disc = anchorIxDiscriminator("withdraw");
  const data = new Uint8Array(8 + 1 + 32 + 256 + 192);
  let offset = 0;
  data.set(disc, offset);
  offset += 8;
  data[offset] = denomId & 0xff;
  offset += 1;
  data.set(nullifierHashBe, offset);
  offset += 32;
  data.set(proofBytes, offset);
  offset += 256;
  for (const ps of publicSignals) {
    data.set(ps, offset);
    offset += 32;
  }

  const keys: TransactionInstruction["keys"] = [
    { pubkey: accts.config, isSigner: false, isWritable: false },
    { pubkey: accts.denomination, isSigner: false, isWritable: false },
    { pubkey: accts.tree, isSigner: false, isWritable: true },
    { pubkey: accts.vault, isSigner: false, isWritable: true },
    { pubkey: accts.nullifier, isSigner: false, isWritable: true },
    { pubkey: accts.recipientAta, isSigner: false, isWritable: true },
    // Anchor's None sentinel for optional accounts is the program id itself.
    { pubkey: accts.feeVault ?? programId, isSigner: false, isWritable: !!accts.feeVault },
    { pubkey: accts.feePayer, isSigner: true, isWritable: true },
    {
      pubkey: accts.tokenProgram ?? TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: accts.systemProgram ?? SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
  ];

  return new TransactionInstruction({
    programId,
    keys,
    data: Buffer.from(data),
  });
}
