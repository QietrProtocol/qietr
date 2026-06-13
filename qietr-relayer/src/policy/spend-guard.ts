// =============================================================================
// spend-guard.ts — protect the relayer's own SOL balance.
//
// The relayer is the fee-payer for every withdraw it forwards, so each
// accepted tx spends its SOL. Without limits a flood of (possibly failing)
// withdraws drains the fee-payer to zero. This guard enforces two things
// before a tx is forwarded:
//
//   1. A hard floor on the relayer's SOL balance (refuse below `minBalanceLamports`).
//   2. A per-window cap on the number of forwarded txs (`maxPerWindow`).
//
// Balance is cached briefly so we don't hit RPC on every request.
// =============================================================================

import type { Connection, PublicKey } from "@solana/web3.js";

export interface SpendGuardConfig {
  feePayer: PublicKey;
  /** Refuse to forward when the fee-payer balance is below this. */
  minBalanceLamports: number;
  /** Max forwarded txs per rolling window. */
  maxPerWindow: number;
  windowSeconds: number;
  /** How long to cache the on-chain balance, ms. */
  balanceCacheMs?: number;
}

export interface SpendDecision {
  allowed: boolean;
  reason?: string;
}

export interface SpendGuard {
  /** Check balance + window cap. Call `commit()` only after a successful send. */
  check(): Promise<SpendDecision>;
  /** Record that a forwarded tx consumed a slot in the window. */
  commit(): void;
}

export function createSpendGuard(
  connection: Connection,
  cfg: SpendGuardConfig,
): SpendGuard {
  const windowMs = cfg.windowSeconds * 1000;
  const cacheMs = cfg.balanceCacheMs ?? 5_000;
  let cachedBalance = 0;
  let cachedAt = 0;
  const hits: number[] = [];

  async function balance(now: number): Promise<number> {
    if (now - cachedAt < cacheMs) return cachedBalance;
    cachedBalance = await connection.getBalance(cfg.feePayer, "confirmed");
    cachedAt = now;
    return cachedBalance;
  }

  return {
    async check(): Promise<SpendDecision> {
      const now = Date.now();
      // Trim the window.
      const cutoff = now - windowMs;
      while (hits.length && hits[0]! <= cutoff) hits.shift();

      if (hits.length >= cfg.maxPerWindow) {
        return { allowed: false, reason: "relayer_spend_cap" };
      }

      let bal: number;
      try {
        bal = await balance(now);
      } catch {
        // Fail closed: if we can't confirm we can afford the fee, don't pay.
        return { allowed: false, reason: "balance_check_failed" };
      }
      if (bal < cfg.minBalanceLamports) {
        return { allowed: false, reason: "relayer_balance_low" };
      }
      return { allowed: true };
    },
    commit(): void {
      hits.push(Date.now());
    },
  };
}
