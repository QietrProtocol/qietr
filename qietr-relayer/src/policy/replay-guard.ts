// =============================================================================
// replay-guard.ts — reject re-submission of a transaction within a TTL window.
//
// The README promised "30s window, same sig rejected" but no such code
// existed; an attacker could replay a previously-submitted tx_base64 to make
// the relayer pay fees for a transaction that fails on-chain (expired
// blockhash or already-spent nullifier) — a griefing drain.
//
// We key on a sha256 of the raw transaction bytes (stable across identical
// submissions) and remember it for `ttlSeconds`. The window is deliberately
// longer than Solana's ~60–90s blockhash validity so a replay can't sneak
// through after expiry.
// =============================================================================

import { createHash } from "node:crypto";

export interface ReplayGuard {
  /**
   * Returns true and records the tx if it has NOT been seen within the window;
   * returns false if it is a replay.
   */
  admit(txBase64: string): boolean;
  size(): number;
}

export function createReplayGuard(ttlSeconds = 120): ReplayGuard {
  const seen = new Map<string, number>(); // hash -> firstSeen (unix ms)
  const ttlMs = ttlSeconds * 1000;

  function sweep(now: number): void {
    for (const [k, ts] of seen) {
      if (ts + ttlMs <= now) seen.delete(k);
    }
  }

  return {
    admit(txBase64: string): boolean {
      const now = Date.now();
      // Amortized cleanup; cheap because the map only holds a TTL window.
      if (seen.size > 0 && seen.size % 64 === 0) sweep(now);

      const hash = createHash("sha256").update(txBase64).digest("hex");
      const prev = seen.get(hash);
      if (prev !== undefined && prev + ttlMs > now) {
        return false; // replay within window
      }
      seen.set(hash, now);
      return true;
    },
    size: () => seen.size,
  };
}
