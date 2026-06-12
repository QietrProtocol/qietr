import { sha256 } from "@noble/hashes/sha2";
import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "./program.js";

export const QIETR_ESCROW_PROGRAM_ID = new PublicKey(
  "BqAeDVPRdokf5q5XQmHoanwEYgyNwV9xWjbUMGQJRmJE",
);

// ---------------------------------------------------------------------------
// IDL helpers
// ---------------------------------------------------------------------------

function anchorDiscriminator(name: string): Uint8Array {
  return sha256(new TextEncoder().encode(`global:${name}`)).slice(0, 8);
}

// ---------------------------------------------------------------------------
// Instruction builders
// ---------------------------------------------------------------------------

export function buildCreateJobIx(
  agent: PublicKey,
  nonce: Uint8Array,
  priceMicro: bigint,
  client: PublicKey,
  clientAta: PublicKey,
  mint: PublicKey,
  programId: PublicKey = QIETR_ESCROW_PROGRAM_ID,
): TransactionInstruction {
  if (nonce.length !== 8) {
    throw new Error(`nonce must be 8 bytes, got ${nonce.length}`);
  }

  const disc = anchorDiscriminator("create_job");
  const data = new Uint8Array(8 + 32 + 8 + 8);
  data.set(disc, 0);
  data.set(agent.toBytes(), 8);
  data.set(nonce, 40);
  const dv = new DataView(data.buffer);
  dv.setBigUint64(48, priceMicro, true);

  const [jobPda] = findJobPda(client, nonce, programId);
  const [vaultPda] = findEscrowVaultPda(client, nonce, programId);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: jobPda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: clientAta, isSigner: false, isWritable: true },
      { pubkey: client, isSigner: true, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
}

export function buildAcceptJobIx(
  jobPda: PublicKey,
  agent: PublicKey,
  programId: PublicKey = QIETR_ESCROW_PROGRAM_ID,
): TransactionInstruction {
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: jobPda, isSigner: false, isWritable: true },
      { pubkey: agent, isSigner: true, isWritable: false },
    ],
    data: Buffer.from(anchorDiscriminator("accept_job")),
  });
}

export function buildCompleteJobIx(
  jobPda: PublicKey,
  agent: PublicKey,
  programId: PublicKey = QIETR_ESCROW_PROGRAM_ID,
): TransactionInstruction {
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: jobPda, isSigner: false, isWritable: true },
      { pubkey: agent, isSigner: true, isWritable: false },
    ],
    data: Buffer.from(anchorDiscriminator("complete_job")),
  });
}

export function buildReleasePaymentIx(
  jobPda: PublicKey,
  escrowVault: PublicKey,
  agentAta: PublicKey,
  client: PublicKey,
  programId: PublicKey = QIETR_ESCROW_PROGRAM_ID,
): TransactionInstruction {
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: jobPda, isSigner: false, isWritable: true },
      { pubkey: escrowVault, isSigner: false, isWritable: true },
      { pubkey: agentAta, isSigner: false, isWritable: true },
      { pubkey: client, isSigner: true, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(anchorDiscriminator("release_payment")),
  });
}

export function buildDisputeJobIx(
  jobPda: PublicKey,
  client: PublicKey,
  programId: PublicKey = QIETR_ESCROW_PROGRAM_ID,
): TransactionInstruction {
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: jobPda, isSigner: false, isWritable: true },
      { pubkey: client, isSigner: true, isWritable: false },
    ],
    data: Buffer.from(anchorDiscriminator("dispute_job")),
  });
}

/** @deprecated Use buildCancelJobIx instead. */
export function buildRefundJobIx(
  jobPda: PublicKey,
  escrowVault: PublicKey,
  clientAta: PublicKey,
  client: PublicKey,
  programId: PublicKey = QIETR_ESCROW_PROGRAM_ID,
): TransactionInstruction {
  return buildCancelJobIx(jobPda, escrowVault, clientAta, client, programId);
}

export function buildCancelJobIx(
  jobPda: PublicKey,
  escrowVault: PublicKey,
  clientAta: PublicKey,
  client: PublicKey,
  programId: PublicKey = QIETR_ESCROW_PROGRAM_ID,
): TransactionInstruction {
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: jobPda, isSigner: false, isWritable: true },
      { pubkey: escrowVault, isSigner: false, isWritable: true },
      { pubkey: clientAta, isSigner: false, isWritable: true },
      { pubkey: client, isSigner: true, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(anchorDiscriminator("cancel_job")),
  });
}

export function buildResolveDisputeIx(
  jobPda: PublicKey,
  escrowVault: PublicKey,
  clientAta: PublicKey,
  programId: PublicKey = QIETR_ESCROW_PROGRAM_ID,
): TransactionInstruction {
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: jobPda, isSigner: false, isWritable: true },
      { pubkey: escrowVault, isSigner: false, isWritable: true },
      { pubkey: clientAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(anchorDiscriminator("resolve_dispute")),
  });
}

export function buildCloseJobIx(
  jobPda: PublicKey,
  claimant: PublicKey,
  programId: PublicKey = QIETR_ESCROW_PROGRAM_ID,
): TransactionInstruction {
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: jobPda, isSigner: false, isWritable: true },
      { pubkey: claimant, isSigner: true, isWritable: true },
    ],
    data: Buffer.from(anchorDiscriminator("close_job")),
  });
}

// ---------------------------------------------------------------------------
// PDA derivation
// ---------------------------------------------------------------------------

export function findJobPda(
  client: PublicKey,
  nonce: Uint8Array,
  programId: PublicKey = QIETR_ESCROW_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("job"), client.toBytes(), nonce],
    programId,
  );
}

export function findEscrowVaultPda(
  client: PublicKey,
  nonce: Uint8Array,
  programId: PublicKey = QIETR_ESCROW_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), client.toBytes(), nonce],
    programId,
  );
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const JOB_ACCOUNT_SIZE = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 1;

export enum JobState {
  Created = 0,
  Accepted = 1,
  Completed = 2,
  Released = 3,
  Disputed = 4,
  Refunded = 5,
}

export interface ParsedJob {
  client: string;
  agent: string;
  nonce: string;
  priceMicro: bigint;
  createdAt: number;
  acceptedAt: number;
  completedAt: number;
  resolvedAt: number;
  state: JobState;
  bump: number;
  escrowBump: number;
}

export function parseJobAccount(data: Uint8Array): ParsedJob | null {
  const MIN_SIZE = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 1;
  if (data.length < MIN_SIZE) return null;

  const expectedDisc = sha256(new TextEncoder().encode("account:Job")).slice(0, 8);
  for (let i = 0; i < 8; i++) {
    if (data[i] !== expectedDisc[i]) return null;
  }

  const pubkeyFromSlice = (off: number): string =>
    new PublicKey(data.slice(off, off + 32)).toBase58();

  const buf = Buffer.from(data);
  let off = 8;

  const client = pubkeyFromSlice(off); off += 32;
  const agent = pubkeyFromSlice(off); off += 32;
  const nonce = buf.subarray(off, off + 8).toString("hex"); off += 8;
  const priceMicro = buf.readBigUInt64LE(off); off += 8;
  const createdAt = Number(buf.readBigInt64LE(off)); off += 8;
  const acceptedAt = Number(buf.readBigInt64LE(off)); off += 8;
  const completedAt = Number(buf.readBigInt64LE(off)); off += 8;
  const resolvedAt = Number(buf.readBigInt64LE(off)); off += 8;
  const state = data[off]! as JobState; off += 1;
  const bump = data[off]!; off += 1;
  const escrowBump = data[off]!;

  return {
    client, agent, nonce, priceMicro,
    createdAt, acceptedAt, completedAt, resolvedAt,
    state, bump, escrowBump,
  };
}
