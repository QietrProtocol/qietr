// =============================================================================
// x402.ts — HTTP 402 wrapping (x402 spec envelope).
//
// On a `402 Payment Required` response, the wrapper:
//   1. Parses the merchant's `accepts` array per the x402 spec.
//   2. Selects a requirement that matches our scheme, network, AND asset.
//   3. Enforces the caller's spend guard (`maxAmountMicro`, optional `payTo`
//      allowlist) BEFORE spending anything.
//   4. Settles on-chain via `pay` (a shielded-pool withdraw to `payTo`).
//   5. Retries the original request with the x402 envelope in `X-PAYMENT`.
//
// ----------------------------------------------------------------------------
// x402 conformance (decision D1 = "commit to real x402"):
//
//   X-PAYMENT header  = base64( JSON{ x402Version, scheme, network, payload } )
//   402 response body = { x402Version, accepts: PaymentRequirements[], error? }
//
// Qietr settles from a shielded pool, so the on-chain withdraw IS the
// settlement (atomic + final) rather than a facilitator `settle` call. The
// `payload` therefore carries a *settlement receipt* the merchant verifies by
// confirming the transaction on-chain. The recipient ATA is credited EXACTLY
// `maxAmountRequired`, so the `exact` scheme is honoured on the wire; the pool
// keeps the change internally. We advertise our own `qietr-private` scheme too
// for merchants that want to dispatch on the privacy property explicitly.
// ----------------------------------------------------------------------------
// =============================================================================

import { PublicKey } from "@solana/web3.js";
import type { Note, PaymentResult, SignerLike } from "./types.js";
import {
  X402AmountExceededError,
  X402AssetMismatchError,
  X402Error,
  X402MalformedRequirementsError,
  X402NoMatchingRequirementError,
  X402PayToNotAllowedError,
  X402PaymentFailedError,
} from "./errors.js";

/** x402 protocol version this SDK speaks. */
export const X402_VERSION = 1;

/** Schemes we can settle. `exact` (recipient credited exactly) + our own. */
export const SUPPORTED_SCHEMES = ["exact", "qietr-private"] as const;

/**
 * A single entry of the merchant's `accepts` array. Field names follow the
 * x402 v1 spec; `amount` is accepted as a legacy/v2 fallback for
 * `maxAmountRequired`.
 */
export interface PaymentRequirement {
  scheme: string;
  network: string;
  /** Token mint (base58). Validated against the SDK's configured USDC mint. */
  asset: string;
  payTo: string;
  /** x402 v1: max smallest-units the merchant will accept. */
  maxAmountRequired?: string;
  /** Legacy/v2 fallback for `maxAmountRequired`. */
  amount?: string;
  /** Resource URL this requirement is scoped to (replay/resource binding). */
  resource?: string;
  /** Merchant-suggested timeout; bounds the retry AbortSignal. */
  maxTimeoutSeconds?: number;
  /** Tier hint provided by the merchant, if any. */
  denomId?: number;
  /** Opaque merchant extras (echoed, not interpreted). */
  extra?: unknown;
}

export interface Accepts402Body {
  x402Version?: number;
  accepts: PaymentRequirement[];
  /** Merchant-supplied invoice id; echoed back in the payload if present. */
  invoiceId?: string;
  error?: string;
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
   * MANDATORY spend ceiling, in micro-USDC. The wrapper refuses to pay any
   * requirement asking for more than this and throws `X402AmountExceededError`.
   * This is the single most important guard for an automated agent — without
   * it, a malicious 402 could drain the loaded note.
   */
  maxAmountMicro: bigint;
  /**
   * Optional allowlist of acceptable `payTo` addresses (base58). When set, a
   * requirement naming any other recipient throws `X402PayToNotAllowedError`.
   */
  payToAllowlist?: ReadonlyArray<string>;
  /**
   * Configured USDC mint (base58). A requirement whose `asset` differs is
   * rejected with `X402AssetMismatchError` — we never pay in some other SPL.
   */
  usdcMint: string;
  /**
   * Pay callback supplied by `QietrSDK.wrapFetch`. Pulled out behind an
   * interface so x402.ts has no @solana/web3.js dependency at runtime.
   */
  pay: (req: {
    to: PublicKey;
    micro: bigint;
    feePayer: SignerLike;
  }) => Promise<PaymentResult>;
  /** Fee-payer supplier (relayer or the user's wallet). */
  getFeePayer: () => SignerLike;
  /**
   * Network identifier the SDK runs on (e.g. "solana" / "solana-devnet").
   * Matched against the requirement's `network` after alias normalization.
   */
  networkId?: string;
  /**
   * Default request timeout in ms when the merchant does not supply
   * `maxTimeoutSeconds`. Applies to both the base and retry fetch. Default 30s.
   */
  defaultTimeoutMs?: number;
  /**
   * Optional observer invoked with every typed error the wrapper raises,
   * before it is thrown. Useful for telemetry; does not change control flow.
   */
  onError?: (err: X402Error) => void;
}

const DEFAULT_NETWORK_ID = "solana";
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Normalize the many Solana network labels in the wild to a canonical token so
 * "solana-mainnet", "mainnet-beta", "solana:mainnet" and "solana" all match.
 */
export function normalizeNetwork(label: string): string {
  const l = label.trim().toLowerCase();
  if (
    l === "solana" ||
    l === "solana-mainnet" ||
    l === "mainnet-beta" ||
    l === "solana:mainnet" ||
    l === "solana-mainnet-beta"
  ) {
    return "solana";
  }
  if (l === "solana-devnet" || l === "devnet" || l === "solana:devnet") {
    return "solana-devnet";
  }
  if (l === "solana-testnet" || l === "testnet" || l === "solana:testnet") {
    return "solana-testnet";
  }
  if (l === "localnet" || l === "solana-localnet") return "solana-localnet";
  // CAIP-2 with a genesis hash or anything else: return as-is, lowercased.
  return l;
}

export function wrapFetch(
  baseFetch: FetchLike,
  opts: WrapFetchOptions,
): FetchLike {
  const maxRetries = opts.maxRetries ?? 1;
  const networkId = normalizeNetwork(opts.networkId ?? DEFAULT_NETWORK_ID);
  const defaultTimeoutMs = opts.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const allowlist = opts.payToAllowlist
    ? new Set(opts.payToAllowlist)
    : null;

  if (typeof opts.maxAmountMicro !== "bigint" || opts.maxAmountMicro <= 0n) {
    throw new X402Error(
      "wrapFetch requires a positive `maxAmountMicro` spend ceiling (bigint)",
    );
  }

  const raise = (err: X402Error): never => {
    opts.onError?.(err);
    throw err;
  };

  return async (input, init) => {
    let attempts = 0;
    // Track requirements we've already settled this call so a misbehaving
    // merchant that keeps returning 402 can't trigger repeated withdraws.
    const settled = new Set<string>();

    let lastRes = await timedFetch(baseFetch, input, init, defaultTimeoutMs);

    while (lastRes.status === 402 && attempts < maxRetries) {
      attempts += 1;

      const body = (await lastRes.clone().json().catch(() => null)) as
        | Accepts402Body
        | null;
      if (!body || !Array.isArray(body.accepts) || body.accepts.length === 0) {
        return raise(
          new X402MalformedRequirementsError("missing or empty `accepts`"),
        );
      }

      // Select the first requirement matching scheme + network + asset.
      const requirement = body.accepts.find(
        (r) =>
          SUPPORTED_SCHEMES.includes(r.scheme as (typeof SUPPORTED_SCHEMES)[number]) &&
          normalizeNetwork(r.network) === networkId,
      );
      if (!requirement) {
        return raise(
          new X402NoMatchingRequirementError(
            `none of ${body.accepts.length} requirement(s) matched scheme∈{${SUPPORTED_SCHEMES.join(",")}} network=${networkId}`,
          ),
        );
      }

      // Asset must be our configured USDC mint — never pay in another SPL.
      if (requirement.asset && requirement.asset !== opts.usdcMint) {
        return raise(
          new X402AssetMismatchError(requirement.asset, opts.usdcMint),
        );
      }

      // Parse amount as bigint end-to-end. x402 v1 = maxAmountRequired.
      const amountStr = requirement.maxAmountRequired ?? requirement.amount;
      if (amountStr === undefined) {
        return raise(
          new X402MalformedRequirementsError(
            "requirement has neither `maxAmountRequired` nor `amount`",
          ),
        );
      }
      let micro: bigint;
      try {
        micro = BigInt(amountStr);
      } catch {
        return raise(
          new X402MalformedRequirementsError(
            `amount "${amountStr}" is not an integer string`,
          ),
        );
      }
      if (micro <= 0n) {
        return raise(
          new X402MalformedRequirementsError(`amount must be positive, got ${micro}`),
        );
      }

      // --- Spend guard (the critical agent foot-gun protections) ----------
      if (micro > opts.maxAmountMicro) {
        return raise(new X402AmountExceededError(micro, opts.maxAmountMicro));
      }
      if (allowlist && !allowlist.has(requirement.payTo)) {
        return raise(new X402PayToNotAllowedError(requirement.payTo));
      }

      // Don't double-settle the same (payTo, amount, resource) within one call.
      const dedupeKey = `${requirement.payTo}:${micro}:${requirement.resource ?? ""}`;
      if (settled.has(dedupeKey)) {
        return raise(
          new X402PaymentFailedError(
            "merchant re-requested payment for an already-settled requirement",
          ),
        );
      }

      const note = opts.getNote();
      if (!note || note.commitments.length === 0) {
        return raise(
          new X402PaymentFailedError("no shielded note loaded to pay from"),
        );
      }

      const to = new PublicKey(requirement.payTo);

      let result: PaymentResult;
      try {
        result = await opts.pay({ to, micro, feePayer: opts.getFeePayer() });
      } catch (e) {
        return raise(new X402PaymentFailedError((e as Error).message));
      }
      settled.add(dedupeKey);
      opts.setNote(result.updatedNote);

      // Build the x402 settlement payload. `validBefore` + `nonce` bind the
      // receipt against replay; `resource` binds it to this URL.
      const resource =
        requirement.resource ?? canonicalResource(input);
      const timeoutMs = requirement.maxTimeoutSeconds
        ? requirement.maxTimeoutSeconds * 1000
        : defaultTimeoutMs;

      const payload = {
        scheme: requirement.scheme,
        network: requirement.network,
        asset: requirement.asset,
        payTo: requirement.payTo,
        amount: micro.toString(),
        resource,
        // Settlement proof: the on-chain withdraw signature. The merchant
        // verifies by confirming this transaction credited `payTo`.
        signature: result.withdrawSignature,
        nonce: result.withdrawSignature,
        invoiceId: body.invoiceId,
      };

      const envelope = {
        x402Version: X402_VERSION,
        scheme: requirement.scheme,
        network: requirement.network,
        payload,
      };
      const header = base64Encode(JSON.stringify(envelope));

      const retryInit: RequestInit = {
        ...(init ?? {}),
        headers: {
          ...(init?.headers ?? {}),
          "X-PAYMENT": header,
        },
      };
      try {
        lastRes = await timedFetch(baseFetch, input, retryInit, timeoutMs);
      } catch (e) {
        // Payment settled on-chain but the retry fetch failed. Surface this
        // explicitly — the agent has paid and must reconcile out-of-band.
        return raise(
          new X402PaymentFailedError(
            `settled (sig ${result.withdrawSignature}) but retry fetch failed: ${(e as Error).message}`,
          ),
        );
      }
    }

    return lastRes;
  };
}

/** Run a fetch with an AbortSignal timeout. Rejects on timeout. */
async function timedFetch(
  baseFetch: FetchLike,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response> {
  // Respect a caller-provided signal by not clobbering it when present.
  if (init?.signal) {
    try {
      return await baseFetch(input, init);
    } catch (e) {
      throw new Error(`x402 fetch failed: ${(e as Error).message}`);
    }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await baseFetch(input, { ...(init ?? {}), signal: controller.signal });
  } catch (e) {
    if (controller.signal.aborted) {
      throw new Error(`x402 fetch timed out after ${timeoutMs}ms`);
    }
    throw new Error(`x402 fetch failed: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Best-effort canonical URL string for resource binding. */
function canonicalResource(input: RequestInfo | URL): string {
  try {
    if (typeof input === "string") return input;
    if (input instanceof URL) return input.toString();
    // Request-like object.
    const url = (input as { url?: string }).url;
    return url ?? String(input);
  } catch {
    return "";
  }
}

function base64Encode(s: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(s, "utf-8").toString("base64");
  }
  return btoa(unescape(encodeURIComponent(s)));
}
