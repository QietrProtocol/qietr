// =============================================================================
// x402.ts — HTTP 402 wrapping.
//
// On a `402 Payment Required` response from an x402-svm endpoint, the
// wrapper picks one of the merchant's accepted requirements that uses our
// configured USDC + Solana network, pays it via `pay`, and retries the
// original request with `X-PAYMENT` set to a base64-encoded receipt.
//
// MVP receipt shape: { network, payer, payee, amount, signature } JSON.
// The standardized Coinbase x402-svm header is a moving target; the SDK
// stays compatible by always echoing the original `accepts` entry's scheme
// alongside the on-chain proof, so the facilitator can verify it.
// =============================================================================

import { PublicKey } from "@solana/web3.js";
import type { Note, PaymentResult, SignerLike } from "./types.js";

export interface PaymentRequirement {
  scheme: string;
  network: string;
  asset: string;
  payTo: string;
  /** Decimal-string of smallest units (micro-USDC). */
  amount: string;
  /** Tier hint provided by the merchant, if any. */
  denomId?: number;
}

export interface Accepts402Body {
  accepts: PaymentRequirement[];
  /** Merchant-supplied invoice id; echoed back in headers if present. */
  invoiceId?: string;
}

export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface WrapFetchOptions {
  getNote: () => Note | null;
  setNote: (note: Note) => void;
  /** Maximum number of payment retries per request. Default 1. */
  maxRetries?: number;
  /**
   * Pay callback supplied by `QietrSDK.wrapFetch`. Pulled out behind an
   * interface so x402.ts has no @solana/web3.js dependency at runtime.
   */
  pay: (req: {
    to: PublicKey;
    micro: bigint;
    feePayer: SignerLike;
  }) => Promise<PaymentResult>;
  /**
   * Fee-payer supplier. Pulled out so the consumer can plug in a relayer
   * once task #8 lands, or fall back to the user's wallet.
   */
  getFeePayer: () => SignerLike;
  /**
   * Network identifier the SDK runs on (e.g. "solana-mainnet"). The wrapper
   * only attempts payments whose `network` field matches this string.
   */
  networkId?: string;
}

const DEFAULT_NETWORK_ID = "solana-mainnet";

export function wrapFetch(
  baseFetch: FetchLike,
  opts: WrapFetchOptions,
): FetchLike {
  const maxRetries = opts.maxRetries ?? 1;
  const networkId = opts.networkId ?? DEFAULT_NETWORK_ID;

  return async (input, init) => {
    let attempts = 0;
    let lastRes: Response;
    try {
      lastRes = await baseFetch(input, init);
    } catch (e) {
      throw new Error(`x402 fetch failed: ${(e as Error).message}`);
    }
    while (lastRes.status === 402 && attempts < maxRetries) {
      attempts += 1;

      const body = (await lastRes.clone().json().catch(() => null)) as
        | Accepts402Body
        | null;
      if (!body || !Array.isArray(body.accepts) || body.accepts.length === 0) {
        return lastRes;
      }

      const requirement = body.accepts.find(
        (r) => r.network === networkId && r.scheme === "exact",
      );
      if (!requirement) {
        return lastRes;
      }

      const note = opts.getNote();
      if (!note || note.commitments.length === 0) {
        return lastRes;
      }

      const to = new PublicKey(requirement.payTo);
      const micro = BigInt(requirement.amount);

      let result;
      try {
        result = await opts.pay({
          to,
          micro,
          feePayer: opts.getFeePayer(),
        });
      } catch (e) {
        // Payment failed — don't retry, return original 402.
        return lastRes;
      }
      opts.setNote(result.updatedNote);

      const payerPubkey = typeof opts.getFeePayer === "function"
        ? opts.getFeePayer().publicKey.toBase58()
        : "unknown";

      const receipt = {
        scheme: requirement.scheme,
        network: requirement.network,
        asset: requirement.asset,
        payer: payerPubkey,
        payee: requirement.payTo,
        amount: requirement.amount,
        signature: result.withdrawSignature,
        invoiceId: body.invoiceId,
      };
      const header = base64Encode(JSON.stringify(receipt));

      const retryInit: RequestInit = {
        ...(init ?? {}),
        headers: {
          ...(init?.headers ?? {}),
          "X-PAYMENT": header,
        },
      };
      try {
        lastRes = await baseFetch(input, retryInit);
      } catch (e) {
        // Payment succeeded but retry fetch failed — merchant may still
        // receive the payment. Return the original 402.
        return lastRes;
      }
    }

    return lastRes;
  };
}

function base64Encode(s: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(s, "utf-8").toString("base64");
  }
  return btoa(unescape(encodeURIComponent(s)));
}
