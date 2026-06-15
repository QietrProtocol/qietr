// =============================================================================
// confirm-tx.ts — reliable send + confirm for wallet-signed transactions.
//
// Why this exists: `connection.confirmTransaction({ blockhash, lastValidBlockHeight })`
// confirms via a WebSocket signature subscription. On devnet that produces a
// well-known FALSE NEGATIVE — if the WS notification is missed, or the tx lands
// right at the `lastValidBlockHeight` boundary, web3.js throws
// `TransactionExpiredBlockheightExceededError: block height exceeded` even though
// the transaction actually confirmed on-chain. Users then see "failed", and may
// re-send a tx that already succeeded.
//
// This helper instead:
//   1. broadcasts once, then rebroadcasts every POLL_MS (cheap insurance against
//      a dropped first send on a busy devnet leader),
//   2. polls `getSignatureStatuses` directly (HTTP, no WS dependency),
//   3. on apparent expiry, does ONE final on-chain status check before declaring
//      failure — this is what closes the false-negative race.
//
// Used by the messaging and escrow flows; the deposit/pay paths go through the
// SDK which has its own submission path.
// =============================================================================

import type { Connection } from "@solana/web3.js";

const POLL_MS = 2000;

/** Thrown only when the tx is genuinely not on-chain after the blockhash expires. */
export class TxExpiredError extends Error {
  readonly signature: string;
  constructor(signature: string) {
    super(
      "Transaction expired before it was confirmed (block height exceeded). " +
        "It may still land — check the explorer before re-sending.",
    );
    this.name = "TxExpiredError";
    this.signature = signature;
  }
}

/** Thrown when the tx landed on-chain but the program returned an error. */
export class TxFailedError extends Error {
  readonly signature: string;
  constructor(signature: string, err: unknown) {
    super(`Transaction failed on-chain: ${JSON.stringify(err)}`);
    this.name = "TxFailedError";
    this.signature = signature;
  }
}

async function isOnChain(
  connection: Connection,
  signature: string,
): Promise<"confirmed" | "failed" | "pending"> {
  const { value } = await connection.getSignatureStatuses([signature], {
    searchTransactionHistory: true,
  });
  const status = value[0];
  if (!status) return "pending";
  if (status.err) return "failed";
  if (
    status.confirmationStatus === "confirmed" ||
    status.confirmationStatus === "finalized"
  ) {
    return "confirmed";
  }
  return "pending";
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Broadcast a signed transaction and wait until it confirms or genuinely expires.
 *
 * @param connection           wallet-adapter connection
 * @param rawTx                `signedTx.serialize()`
 * @param lastValidBlockHeight from the same `getLatestBlockhash` used to sign
 * @returns the confirmed signature
 * @throws  {TxFailedError}  the tx landed but the program rejected it
 * @throws  {TxExpiredError} the blockhash expired and the tx is not on-chain
 */
export async function sendAndConfirm(
  connection: Connection,
  rawTx: Uint8Array | Buffer,
  lastValidBlockHeight: number,
): Promise<string> {
  const signature = await connection.sendRawTransaction(rawTx, {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });

  for (;;) {
    const onChain = await isOnChain(connection, signature);
    if (onChain === "confirmed") return signature;
    if (onChain === "failed") {
      const { value } = await connection.getSignatureStatuses([signature]);
      throw new TxFailedError(signature, value[0]?.err);
    }

    const height = await connection.getBlockHeight("confirmed");
    if (height > lastValidBlockHeight) {
      // Blockhash window is gone. One last check closes the WS race: a tx can
      // land in the very block that pushes height past lastValidBlockHeight.
      if ((await isOnChain(connection, signature)) === "confirmed") return signature;
      throw new TxExpiredError(signature);
    }

    // Rebroadcast (idempotent — same signature) in case the first send dropped.
    try {
      await connection.sendRawTransaction(rawTx, { skipPreflight: true });
    } catch {
      // A "already processed" / transient send error here is harmless; the
      // status poll above is the source of truth.
    }
    await sleep(POLL_MS);
  }
}
