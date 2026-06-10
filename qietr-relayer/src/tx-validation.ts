// =============================================================================
// tx-validation.ts — validate a relayed `withdraw` transaction.
//
// The relayer only accepts transactions that:
//   1. Contain exactly one instruction.
//   2. Target the configured qietr_pool program id.
//   3. Have the anchor `withdraw` discriminator as the first 8 bytes of ix.data.
//   4. Set fee-payer = relayer's own pubkey.
//
// We additionally extract the recipient ATA account (index 5 in the
// `withdraw` accounts layout) so policy checks can resolve the owner.
//
// Account order must match qietr-sdk/src/program.ts::buildWithdrawIx.
// =============================================================================

import { createHash } from "node:crypto";
import { PublicKey, Transaction } from "@solana/web3.js";

const WITHDRAW_DISC = anchorDisc("withdraw");
const WITHDRAW_RECIPIENT_ATA_INDEX = 5;
const DEPOSIT_DISC = anchorDisc("deposit");
const SPL_TRANSFER_TAG = 3;

/** SPL Token program id (canonical). */
const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);

function anchorDisc(method: string): Buffer {
  const full = createHash("sha256")
    .update(`global:${method}`)
    .digest();
  return full.subarray(0, 8);
}

export interface ValidatedWithdrawTx {
  tx: Transaction;
  recipientAta: PublicKey;
  /** denom_id from the instruction data (offset 8). */
  denomId: number;
}

export function decodeAndValidateWithdraw(
  txBase64: string,
  programId: PublicKey,
  expectedFeePayer: PublicKey,
): ValidatedWithdrawTx {
  let tx: Transaction;
  try {
    tx = Transaction.from(Buffer.from(txBase64, "base64"));
  } catch (e) {
    throw new ValidationError("invalid_tx", (e as Error).message);
  }

  if (!tx.feePayer || !tx.feePayer.equals(expectedFeePayer)) {
    throw new ValidationError(
      "wrong_fee_payer",
      `expected fee-payer ${expectedFeePayer.toBase58()}, got ${
        tx.feePayer?.toBase58() ?? "none"
      }`,
    );
  }

  if (tx.instructions.length !== 1) {
    throw new ValidationError(
      "wrong_ix_count",
      `expected 1 instruction, got ${tx.instructions.length}`,
    );
  }

  const ix = tx.instructions[0]!;
  if (!ix.programId.equals(programId)) {
    throw new ValidationError(
      "wrong_program_id",
      `expected ${programId.toBase58()}, got ${ix.programId.toBase58()}`,
    );
  }

  if (ix.data.length < 9) {
    throw new ValidationError("ix_data_too_short", `got ${ix.data.length} bytes`);
  }
  const disc = ix.data.subarray(0, 8);
  if (!disc.equals(WITHDRAW_DISC)) {
    throw new ValidationError(
      "wrong_discriminator",
      `expected withdraw (${WITHDRAW_DISC.toString("hex")}), got ${disc.toString("hex")}`,
    );
  }

  const denomId = ix.data[8]!;

  const acctMeta = ix.keys[WITHDRAW_RECIPIENT_ATA_INDEX];
  if (!acctMeta) {
    throw new ValidationError(
      "missing_recipient_ata",
      `account index ${WITHDRAW_RECIPIENT_ATA_INDEX} not present`,
    );
  }
  return {
    tx,
    recipientAta: acctMeta.pubkey,
    denomId,
  };
}

/**
 * Decode the owner pubkey from a fetched SPL Token account buffer.
 * SPL Token layout: mint(32) | owner(32) | amount(8) | ...
 */
export function decodeAtaOwner(accountData: Buffer): PublicKey {
  if (accountData.length < 64) {
    throw new ValidationError(
      "ata_data_too_short",
      `expected >=64 bytes, got ${accountData.length}`,
    );
  }
  return new PublicKey(accountData.subarray(32, 64));
}

export interface ValidatedDepositTx {
  tx: Transaction;
  denomId: number;
  /** The depositor (sender of USDC). */
  depositor: PublicKey;
}

/**
 * Decode and validate a gasless deposit transaction.
 *
 * Expected TX structure:
 *   1. SPL Token `Transfer` ix (depositor ATA → relayer fee ATA)
 *   2. `qietr_pool.deposit` ix
 *
 * The TX must have `feePayer` set to the relayer's pubkey, and exactly one
 * signing party (the depositor). The relayer will add its own signature.
 */
export function decodeAndValidateDeposit(
  txBase64: string,
  programId: PublicKey,
  expectedFeePayer: PublicKey,
): ValidatedDepositTx {
  let tx: Transaction;
  try {
    tx = Transaction.from(Buffer.from(txBase64, "base64"));
  } catch (e) {
    throw new ValidationError("invalid_tx", (e as Error).message);
  }

  if (!tx.feePayer || !tx.feePayer.equals(expectedFeePayer)) {
    throw new ValidationError(
      "wrong_fee_payer",
      `expected fee-payer ${expectedFeePayer.toBase58()}, got ${
        tx.feePayer?.toBase58() ?? "none"
      }`,
    );
  }

  if (tx.instructions.length !== 2) {
    throw new ValidationError(
      "wrong_ix_count",
      `expected 2 instructions (transfer + deposit), got ${tx.instructions.length}`,
    );
  }

  // First instruction must be SPL Token Transfer.
  const transferIx = tx.instructions[0]!;
  if (!transferIx.programId.equals(TOKEN_PROGRAM_ID)) {
    throw new ValidationError(
      "ix0_not_transfer",
      `expected SPL Token program, got ${transferIx.programId.toBase58()}`,
    );
  }
  if (transferIx.data.length < 1 || transferIx.data[0] !== SPL_TRANSFER_TAG) {
    throw new ValidationError(
      "ix0_not_transfer",
      `expected Transfer tag (3), got ${transferIx.data[0]}`,
    );
  }

  // Second instruction must be pool deposit.
  const depositIx = tx.instructions[1]!;
  if (!depositIx.programId.equals(programId)) {
    throw new ValidationError(
      "ix1_not_deposit",
      `expected pool program ${programId.toBase58()}, got ${depositIx.programId.toBase58()}`,
    );
  }
  if (depositIx.data.length < 9) {
    throw new ValidationError(
      "deposit_data_too_short",
      `got ${depositIx.data.length} bytes`,
    );
  }
  const disc = depositIx.data.subarray(0, 8);
  if (!disc.equals(DEPOSIT_DISC)) {
    throw new ValidationError(
      "wrong_deposit_discriminator",
      `expected deposit (${DEPOSIT_DISC.toString("hex")}), got ${disc.toString("hex")}`,
    );
  }

  const denomId = depositIx.data[8]!;

  // The depositor is account key #5 in the deposit ix's accounts
  // (matches Deposit context: config(0), denom(1), tree(2), vault(3),
  //  depositorAta(4), depositor(5), tokenProgram(6)).
  const DEPOSITOR_ACCT_INDEX = 5;
  const acctMeta = depositIx.keys[DEPOSITOR_ACCT_INDEX];
  if (!acctMeta) {
    throw new ValidationError(
      "missing_depositor",
      `account index ${DEPOSITOR_ACCT_INDEX} not present`,
    );
  }

  return {
    tx,
    denomId,
    depositor: acctMeta.pubkey,
  };
}

export class ValidationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.code = code;
    this.name = "ValidationError";
  }
}
