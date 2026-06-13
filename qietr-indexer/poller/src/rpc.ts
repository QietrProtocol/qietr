// =============================================================================
// rpc.ts — thin wrapper over @solana/web3.js for the reads the poller needs.
//
// Replaces the geyser plugin's validator callbacks with plain RPC:
//   - getProgramAccounts  → all Denomination / MerkleTree / NullifierRecord
//   - getSignaturesForAddress + getParsedTransaction → deposit history
//
// Works against any standard Solana RPC (Helius devnet here). No validator,
// no geyser .so, no special node required.
// =============================================================================

import {
  Connection,
  PublicKey,
  type ConfirmedSignatureInfo,
  type PartiallyDecodedInstruction,
  type ParsedInstruction,
} from "@solana/web3.js";
import bs58 from "bs58";

export interface ProgramAccount {
  pubkey: PublicKey;
  data: Buffer;
  slot: number;
}

export interface PoolIxRecord {
  signature: string;
  slot: number;
  /** raw instruction data for a top-level pool-program instruction */
  ixData: Buffer;
}

export class Rpc {
  readonly connection: Connection;
  readonly programId: PublicKey;

  constructor(rpcUrl: string, programId: string) {
    // 'confirmed' is enough for an append-only tree on devnet; the geyser
    // plugin checkpoints on 'Rooted' (finalized), but for a read API a one-
    // slot reorg risk on devnet is acceptable and we re-derive on each loop.
    this.connection = new Connection(rpcUrl, "confirmed");
    this.programId = new PublicKey(programId);
  }

  /** Current confirmed slot — used to stamp account upserts. */
  async getSlot(): Promise<number> {
    return this.connection.getSlot("confirmed");
  }

  /** All accounts owned by the pool program, with their raw data. */
  async getAllProgramAccounts(): Promise<ProgramAccount[]> {
    const slot = await this.getSlot();
    const accounts = await this.connection.getProgramAccounts(this.programId, {
      commitment: "confirmed",
    });
    return accounts.map((a) => ({
      pubkey: a.pubkey,
      data: a.account.data as Buffer,
      slot,
    }));
  }

  /**
   * Fetch every signature for the program newer than `untilSignature`
   * (exclusive), returned OLDEST-FIRST. Paginates backwards in pages of 1000
   * using `before`, then reverses — so the caller can replay deposits in the
   * order the chain appended their leaves.
   */
  async getNewSignatures(
    untilSignature: string | null,
  ): Promise<ConfirmedSignatureInfo[]> {
    const collected: ConfirmedSignatureInfo[] = [];
    let before: string | undefined = undefined;

    for (;;) {
      // Build options conditionally — exactOptionalPropertyTypes forbids
      // passing an explicit `undefined` for `before`/`until`.
      const opts: { limit: number; before?: string; until?: string } = {
        limit: 1000,
      };
      if (before) opts.before = before;
      if (untilSignature) opts.until = untilSignature;
      const page: ConfirmedSignatureInfo[] =
        await this.connection.getSignaturesForAddress(this.programId, opts);
      if (page.length === 0) break;
      collected.push(...page);
      if (page.length < 1000) break;
      before = page[page.length - 1]!.signature;
    }

    // getSignaturesForAddress is newest-first; deposits must be replayed
    // oldest-first so leaf_index increments match the on-chain tree.
    collected.reverse();
    return collected;
  }

  /**
   * Fetch a transaction and extract all top-level pool-program instructions
   * (raw data). Mirrors the geyser plugin, which only inspects top-level
   * instructions (not inner/CPI). The caller classifies deposit vs withdraw.
   */
  async getPoolIxs(
    sig: ConfirmedSignatureInfo,
  ): Promise<PoolIxRecord[]> {
    const tx = await this.connection.getParsedTransaction(sig.signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (!tx || tx.meta?.err) return []; // skip failed txs — no leaf appended

    const slot = tx.slot;
    const out: PoolIxRecord[] = [];
    const ixs = tx.transaction.message.instructions as Array<
      ParsedInstruction | PartiallyDecodedInstruction
    >;

    for (const ix of ixs) {
      if (!ix.programId.equals(this.programId)) continue;
      // Pool ixs have no RPC parser (no IDL registered), so they arrive as
      // PartiallyDecodedInstruction with bs58-encoded `data`.
      const data = (ix as PartiallyDecodedInstruction).data;
      if (typeof data !== "string") continue;
      let raw: Buffer;
      try {
        raw = Buffer.from(bs58.decode(data));
      } catch {
        continue;
      }
      out.push({ signature: sig.signature, slot, ixData: raw });
    }
    return out;
  }
}
