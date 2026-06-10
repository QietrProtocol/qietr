// =============================================================================
// types.ts — shared SDK types
//
// Source of truth: docs/02-TRD.md sections 4 (circuit), 5 (payment flow),
// and 6 (SDK shape).
// =============================================================================

import type { PublicKey } from "@solana/web3.js";

export type Cluster = "mainnet-beta" | "devnet" | "localnet";

export interface QietrSDKConfig {
  cluster: Cluster;
  /** Optional override for the relayer / fee-payer endpoint. */
  relayerUrl?: string;
  /** Optional override for the prover WASM + zkey CDN. */
  proverPath?: string;
  /** Optional custom RPC URL. Falls back to the cluster default. */
  rpcUrl?: string;
  /** Optional override for the USDC mint (required on localnet). */
  usdcMint?: PublicKey;
  /** Optional override for the on-chain qietr_pool program id. */
  programId?: PublicKey;
  /** Optional override for the indexer base URL (defaults to ./indexer.qietr.com). */
  indexerUrl?: string;
  /**
   * Optional override for tier definitions. Defaults to the four tiers from
   * docs/02-TRD.md §3.4: 0.1 / 1 / 10 / 100 USDC.
   */
  tiers?: ReadonlyArray<{ denomId: number; amountMicroUsdc: bigint }>;
}

/**
 * A spendable commitment held by the user. Both `secret` and `nullifier` are
 * 32-byte random values, base58-encoded for storage.
 */
export interface Commitment {
  secret: string;
  nullifier: string;
  /** Amount in micro-USDC. */
  amount: number;
  /** Tier index (0..N-1). */
  denomId: number;
}

/**
 * The user-facing wallet of shielded value.
 * Storage format is documented in `note.ts`.
 */
export interface Note {
  version: "qietr.v1";
  commitments: Commitment[];
}

export interface DepositArgs {
  /** Amount in USDC (whole units, e.g. 10 for 10 USDC). */
  amount: number;
  /** Wallet adapter that can sign an SPL transfer. */
  payer: SignerLike;
}

export interface PayArgs {
  to: PublicKey;
  /** Amount in USDC (whole units). */
  amount: number;
  /**
   * Wallet that signs the SOL fee for the withdraw transaction. Until the
   * relayer client lands (task #8) this must be supplied explicitly — the
   * SDK will throw a clear error if missing.
   */
  feePayer?: SignerLike;
}

/**
 * Minimal signer interface. Compatible with `@solana/wallet-adapter-base`
 * `SignerWalletAdapter` and with `Keypair` after light wrapping.
 */
export interface SignerLike {
  publicKey: PublicKey;
  signTransaction<T>(tx: T): Promise<T>;
}

export interface PaymentResult {
  /** Updated note. Call `setNote` on the SDK to persist for the next call. */
  updatedNote: Note;
  /** Solana tx signature of the withdraw transaction. */
  withdrawSignature: string;
  /** Solana tx signature of the burner -> merchant transfer, if observed. */
  transferSignature?: string;
}

// -----------------------------------------------------------------------------
// Gasless deposit types
// -----------------------------------------------------------------------------

export interface RelayerQuote {
  feePayer: string;
  feeAta: string;
  feeAmountMicro: number;
  blockhash: string;
  lastValidBlockHeight: number;
  feeBps: number;
}

export interface DepositGaslessArgs {
  /** Amount in USDC whole units (e.g. 10 for 10 USDC). */
  amount: number;
  /** Wallet adapter / keypair that will sign the deposit. */
  depositor: SignerLike;
  /** Optional override: relayer URL. Falls back to SDK config. */
  relayerUrl?: string;
}

export interface DepositGaslessResult {
  /** Updated note with the new commitment. */
  note: Note;
  /** On-chain signature of the deposit transaction. */
  signature: string;
}
