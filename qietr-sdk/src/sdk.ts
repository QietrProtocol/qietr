// =============================================================================
// sdk.ts — QietrSDK live entrypoint.
//
// Implements the target shape in docs/02-TRD.md §6 against the hand-rolled
// `program.ts` instruction builders. The IDL-driven path will replace
// `program.ts` once `anchor build` produces an IDL, but the public surface
// here stays stable.
// =============================================================================

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";

import {
  DEFAULT_TIERS,
  USDC_DECIMALS,
  defaultUsdcMint,
  findAssociatedTokenAddress,
  makeConnection,
  pickTier,
  type TierDefinition,
} from "./chain.js";
import { commitmentHash, nullifierHash as poseidonNullifierHash } from "./hash.js";
import { IndexerClient } from "./indexer-client.js";
import { emptyNote, NotImplemented } from "./note.js";
import {
  QIETR_POOL_PROGRAM_ID,
  buildDepositIx,
  buildTransferIx,
  buildWithdrawIx,
  findDenominationPda,
  findMerkleTreePda,
  findNullifierPda,
  findPoolConfigPda,
  findVaultPda,
} from "./program.js";
import { buildWitness, proveGroth16, type MerkleProof } from "./prover.js";
import { pubkeyToField, pubkeyToFieldString } from "./pubkey.js";
import { fieldDecToBE32, randomFieldDec } from "./randomness.js";
import type {
  Commitment,
  DepositArgs,
  DepositGaslessArgs,
  DepositGaslessResult,
  Note,
  PayArgs,
  PaymentResult,
  QietrSDKConfig,
  SignerLike,
} from "./types.js";
import { wrapFetch, type FetchLike } from "./x402.js";
import { getNoteBalance, hasEnoughBalance } from "./helpers.js";
import { InvalidNoteError, RelayerError } from "./errors.js";
import { RelayerClient } from "./relayer-client.js";

const DEFAULT_INDEXER_URL = "https://indexer.qietr.com";

export class QietrSDK {
  readonly config: QietrSDKConfig;
  readonly connection: Connection;
  readonly programId: PublicKey;
  readonly usdcMint: PublicKey;
  readonly tiers: ReadonlyArray<TierDefinition>;
  readonly indexer: IndexerClient;
  readonly proverPath: { wasm: string; zkey: string };

  private note: Note | null = null;
  private lastUpdatedNote: Note | null = null;

  constructor(config: QietrSDKConfig) {
    this.config = config;
    this.connection = makeConnection(config);
    this.programId = config.programId ?? QIETR_POOL_PROGRAM_ID;
    this.usdcMint = config.usdcMint ?? defaultUsdcMint(config.cluster);
    this.tiers = config.tiers
      ? config.tiers.map((t) => ({
          denomId: t.denomId,
          amountMicroUsdc: t.amountMicroUsdc,
        }))
      : DEFAULT_TIERS;

    const indexerBase = config.indexerUrl ?? DEFAULT_INDEXER_URL;
    this.indexer = new IndexerClient(indexerBase);

    // Default circuit artifact locations — overridable per deployment.
    const proverBase = (config.proverPath ?? "https://circuits.qietr.com").replace(
      /\/+$/,
      "",
    );
    this.proverPath = {
      wasm: `${proverBase}/qietr_payment.wasm`,
      zkey: `${proverBase}/qietr_payment_final.zkey`,
    };
  }

  // -------------------------------------------------------------------------
  // Note management.
  // -------------------------------------------------------------------------
  setNote(note: Note): void {
    this.note = note;
  }
  getNote(): Note | null {
    return this.note;
  }
  getUpdatedNote(): Note | null {
    return this.lastUpdatedNote;
  }

  /** Total USDC balance (in micro-USDC) across all commitments in the loaded note. */
  getBalance(): number {
    if (!this.note) return 0;
    return getNoteBalance(this.note);
  }

  /** True if the loaded note can cover `amountMicroUsdc`. */
  hasBalance(amountMicroUsdc: number | bigint): boolean {
    if (!this.note) return false;
    return hasEnoughBalance(this.note, amountMicroUsdc);
  }

  /** Restore note from an iterable of commitments (e.g. after restore flow). */
  restoreNote(commitments: Array<{ secret: string; nullifier: string; amount: number; denomId: number }>): Note {
    const note: Note = {
      version: this.note?.version ?? "qietr.v1",
      commitments: commitments.map((c) => ({
        secret: c.secret,
        nullifier: c.nullifier,
        amount: c.amount,
        denomId: c.denomId,
      })),
    };
    this.note = note;
    return note;
  }

  // Guard before initiating a pay flow.
  private ensureNote(): void {
    if (!this.note || this.note.commitments.length === 0) {
      throw new InvalidNoteError("no note loaded; call setNote(), deposit(), or restoreNote() first");
    }
  }

  // -------------------------------------------------------------------------
  // Gasless deposit — user signs deposit TX, relayer pays SOL fee.
  // -------------------------------------------------------------------------
  /** Alias for depositGasless — matches legacy method name. */
  async depositFast(args: DepositGaslessArgs): Promise<DepositGaslessResult> {
    return this.depositGasless(args);
  }

  async depositGasless(args: DepositGaslessArgs): Promise<DepositGaslessResult> {
    const relayerUrl = (args.relayerUrl ?? this.config.relayerUrl)?.replace(/\/+$/, "");
    if (!relayerUrl) {
      throw new RelayerError("relayer URL not configured; set relayerUrl in QietrSDKConfig or pass it in depositGasless args");
    }

    const relayer = new RelayerClient({ baseUrl: relayerUrl });

    const tier = pickTier(args.amount, this.tiers);
    const secret = randomFieldDec();
    const nullifier = randomFieldDec();
    const commitmentDec = await commitmentHash(secret, nullifier, tier.amountMicroUsdc);
    const commitmentBe = fieldDecToBE32(commitmentDec);

    const quote = await relayer.quote();
    const feePubkey = new PublicKey(quote.feePayer);
    const feeAta = new PublicKey(quote.feeAta);
    const depositor = args.depositor.publicKey;
    const depositorAta = findAssociatedTokenAddress(depositor, this.usdcMint);

    const [config] = findPoolConfigPda(this.programId);
    const [denomination] = findDenominationPda(tier.denomId, this.programId);
    const [tree] = findMerkleTreePda(tier.denomId, this.programId);
    const [vault] = findVaultPda(tier.denomId, this.programId);

    const depositIx = buildDepositIx(tier.denomId, commitmentBe, {
      config, denomination, tree, vault,
      depositorAta, depositor,
    }, this.programId);

    const feeIx = buildTransferIx(depositorAta, feeAta, depositor, quote.feeAmountMicro);

    const tx = new Transaction();
    tx.add(feeIx, depositIx);
    tx.feePayer = feePubkey;
    tx.recentBlockhash = quote.blockhash;
    tx.lastValidBlockHeight = quote.lastValidBlockHeight;

    const signed = await args.depositor.signTransaction(tx);
    const serialized = Buffer.from(signed.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    })).toString("base64");

    const result = await relayer.submitDeposit(serialized);

    const newCommitment: Commitment = {
      secret: secret.toString(),
      nullifier: nullifier.toString(),
      amount: Number(tier.amountMicroUsdc),
      denomId: tier.denomId,
    };

    const current = this.note ?? emptyNote();
    const next: Note = {
      version: current.version,
      commitments: [...current.commitments, newCommitment],
    };
    this.note = next;
    this.lastUpdatedNote = next;

    return { note: next, signature: result.signature };
  }

  // -------------------------------------------------------------------------
  // Deposit (direct, with depositor paying SOL fee)
  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  async deposit(args: DepositArgs): Promise<Note> {
    const tier = pickTier(args.amount, this.tiers);

    const secret = randomFieldDec();
    const nullifier = randomFieldDec();
    const commitmentDec = await commitmentHash(
      secret,
      nullifier,
      tier.amountMicroUsdc,
    );
    const commitmentBe = fieldDecToBE32(commitmentDec);

    const [config] = findPoolConfigPda(this.programId);
    const [denomination] = findDenominationPda(tier.denomId, this.programId);
    const [tree] = findMerkleTreePda(tier.denomId, this.programId);
    const [vault] = findVaultPda(tier.denomId, this.programId);

    const depositor = args.payer.publicKey;
    const depositorAta = findAssociatedTokenAddress(depositor, this.usdcMint);

    const ix = buildDepositIx(
      tier.denomId,
      commitmentBe,
      {
        config,
        denomination,
        tree,
        vault,
        depositorAta,
        depositor,
      },
      this.programId,
    );

    const sig = await this.sendIxs([ix], args.payer);

    const newCommitment: Commitment = {
      secret,
      nullifier,
      amount: Number(tier.amountMicroUsdc),
      denomId: tier.denomId,
    };

    const current = this.note ?? emptyNote();
    const next: Note = {
      version: current.version,
      commitments: [...current.commitments, newCommitment],
    };
    this.note = next;
    this.lastUpdatedNote = next;

    // Stash the deposit signature on the SDK so callers can surface it
    // even though `deposit` returns the note.
    this.lastDepositSignature = sig;
    return next;
  }

  /** Solana signature of the most recent deposit, if any. */
  lastDepositSignature: string | null = null;

  // -------------------------------------------------------------------------
  // Direct pay — release `amount` of USDC from one note commitment to
  // `to`, return a change commitment in the updated note.
  // -------------------------------------------------------------------------
  async pay(args: PayArgs): Promise<PaymentResult> {
    if (!this.note || this.note.commitments.length === 0) {
      throw new Error("no note loaded; call setNote() or deposit() first");
    }
    const paymentMicro = BigInt(Math.round(args.amount * 10 ** USDC_DECIMALS));
    if (paymentMicro <= 0n) {
      throw new Error("payment amount must be positive");
    }

    // Pick the smallest commitment that still covers the payment.
    const sorted = [...this.note.commitments].sort(
      (a, b) => a.amount - b.amount,
    );
    const commitment = sorted.find((c) => BigInt(c.amount) >= paymentMicro);
    if (!commitment) {
      throw new Error(
        `no single commitment large enough for ${args.amount} USDC payment`,
      );
    }

    // Recompute the commitment leaf for the indexer lookup.
    const leafDec = await commitmentHash(
      commitment.secret,
      commitment.nullifier,
      BigInt(commitment.amount),
    );
    const leafBe = fieldDecToBE32(leafDec);
    const leafHex = "0x" + Buffer.from(leafBe).toString("hex");

    const proofResp = await this.indexer.merkleProof(commitment.denomId, leafHex);

    const merkleProof: MerkleProof = {
      pathElements: proofResp.pathElements.map((h) => BigInt(h).toString()),
      pathIndices: proofResp.pathIndices,
      root: BigInt(proofResp.root).toString(),
    };

    const recipientFieldDec = pubkeyToFieldString(args.to);
    const witness = await buildWitness(
      commitment,
      merkleProof,
      recipientFieldDec,
      paymentMicro,
    );

    // Reject obviously-spent notes before paying for proof generation.
    const nullHashDec = await poseidonNullifierHash(commitment.nullifier);
    const nullHashBe = fieldDecToBE32(nullHashDec);
    try {
      const status = await this.indexer.nullifierStatus(
        commitment.denomId,
        "0x" + Buffer.from(nullHashBe).toString("hex"),
      );
      if (status.spent) {
        throw new Error(
          `commitment already spent (nullifier seen at slot ${status.spentAtSlot})`,
        );
      }
    } catch (e) {
      // Indexer outage is not fatal — on-chain check will catch it.
      if (e instanceof Error && e.message.startsWith("commitment already spent")) {
        throw e;
      }
    }

    const groth = await proveGroth16(
      witness,
      this.proverPath.wasm,
      this.proverPath.zkey,
    );

    // Sanity-check witness ↔ on-chain layout: public_signals[0] must equal
    // our computed nullifier hash, and [2] must equal pubkeyToField(to).
    const ps0 = groth.publicSignals[0];
    const ps2 = groth.publicSignals[2];
    if (!ps0 || !ps2) {
      throw new Error("prover returned malformed public signals");
    }
    if (!bytesEqual(ps0, nullHashBe)) {
      throw new Error("prover nullifier mismatch; check witness construction");
    }
    if (!bytesEqual(ps2, pubkeyToField(args.to))) {
      throw new Error("prover recipient mismatch; check pubkey masking");
    }

    const [config] = findPoolConfigPda(this.programId);
    const [denomination] = findDenominationPda(commitment.denomId, this.programId);
    const [tree] = findMerkleTreePda(commitment.denomId, this.programId);
    const [vault] = findVaultPda(commitment.denomId, this.programId);
    const [nullifierAcct] = findNullifierPda(
      commitment.denomId,
      nullHashBe,
      this.programId,
    );

    const recipientAta = findAssociatedTokenAddress(args.to, this.usdcMint);

    // The fee-payer for the withdraw is the user's connected wallet when no
    // relayer is configured. (Phase A — relayer wiring is task #8.)
    const feePayer = args.feePayer ?? null;
    if (!feePayer) {
      throw new Error(
        "QietrSDK.pay requires `feePayer` until the relayer client is wired (task #8)",
      );
    }

    const ix = buildWithdrawIx(
      commitment.denomId,
      nullHashBe,
      groth.proofBytes,
      groth.publicSignals,
      {
        config,
        denomination,
        tree,
        vault,
        nullifier: nullifierAcct,
        recipientAta,
        feePayer: feePayer.publicKey,
      },
      this.programId,
    );

    const withdrawSignature = await this.sendIxs([ix], feePayer);

    // Build the change commitment so the user can keep spending.
    const changeAmountMicro =
      BigInt(commitment.amount) - paymentMicro;
    const updatedCommitments = this.note.commitments.filter(
      (c) => !(c.secret === commitment.secret && c.nullifier === commitment.nullifier),
    );
    if (changeAmountMicro > 0n) {
      updatedCommitments.push({
        secret: BigInt(witness.newSecret).toString(),
        nullifier: BigInt(witness.newNullifier).toString(),
        amount: Number(changeAmountMicro),
        denomId: commitment.denomId,
      });
    }

    const updatedNote: Note = {
      version: this.note.version,
      commitments: updatedCommitments,
    };
    this.note = updatedNote;
    this.lastUpdatedNote = updatedNote;

    return { updatedNote, withdrawSignature };
  }

  // -------------------------------------------------------------------------
  // x402-wrapped fetch. Returned function transparently pays 402 responses.
  // wrapFetch's per-call retry semantics live in x402.ts.
  // -------------------------------------------------------------------------
  wrapFetch(
    baseFetch: FetchLike = globalThis.fetch,
    opts: { feePayer: SignerLike; networkId?: string; maxRetries?: number },
  ): FetchLike {
    return wrapFetch(baseFetch, {
      getNote: () => this.note,
      setNote: (next) => {
        this.lastUpdatedNote = next;
        this.note = next;
      },
      pay: async ({ to, micro, feePayer }) => {
        return this.payMicro(to, micro, feePayer);
      },
      getFeePayer: () => opts.feePayer,
      networkId: opts.networkId,
      maxRetries: opts.maxRetries,
    });
  }

  /**
   * Lower-level pay path used by wrapFetch. Accepts micro-USDC directly to
   * preserve precision (HTTP 402 quotes are usually in raw smallest units).
   */
  async payMicro(
    to: PublicKey,
    paymentMicro: bigint,
    feePayer: SignerLike,
  ): Promise<PaymentResult> {
    // Reuses the same logic as `pay` but skips float conversion.
    return this.pay({
      to,
      amount: Number(paymentMicro) / 10 ** USDC_DECIMALS,
      feePayer,
    });
  }

  // -------------------------------------------------------------------------
  // Tx submission helper. SignerLike covers both wallet-adapter and Keypair.
  // -------------------------------------------------------------------------
  private async sendIxs(
    ixs: TransactionInstruction[],
    signer: SignerLike,
  ): Promise<string> {
    const tx = new Transaction();
    for (const ix of ixs) tx.add(ix);
    tx.feePayer = signer.publicKey;
    const { blockhash, lastValidBlockHeight } =
      await this.connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;

    const signed = await signer.signTransaction(tx);
    const rawTx = (signed as Transaction).serialize();
    const sig = await this.connection.sendRawTransaction(rawTx, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
    await this.connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      "confirmed",
    );
    return sig;
  }
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Generate a fresh ephemeral keypair for burner-style payments. */
export function generateBurnerWallet(): Keypair {
  return Keypair.generate();
}

// Re-exported helpers so consumers can construct a fresh note without an
// SDK instance (e.g. for restore flows).
export { emptyNote, NotImplemented };
