// =============================================================================
// rate-limit.ts — in-memory sliding-window limiter.
//
// Production-ready for single-instance deployment. For multi-instance
// horizontal scaling, swap the backing Map for a Redis-backed store with
// the same `RateLimiter` interface.
//
// Keys are caller-defined: typically `ip:<addr>` and `ata:<pubkey>`.
// =============================================================================

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds?: number;
  reason?: string;
  /** Tokens remaining in the current window. */
  remaining?: number;
  /** Total window size, for client display. */
  limit?: number;
}

export interface RateLimiter {
  check(
    key: string,
    windowSeconds: number,
    limit: number,
  ): Promise<RateLimitDecision>;
}

interface BucketEntry {
  /** Ring of unix-millis hit timestamps, sorted ascending. */
  hits: number[];
}

/**
 * In-memory sliding-window limiter. Window resolution is millisecond-precise.
 * Memory is O(unique keys × limit) — the hits ring shrinks itself on every
 * call, so dead keys age out naturally.
 */
export function createInMemoryRateLimiter(): RateLimiter {
  const buckets = new Map<string, BucketEntry>();
  return {
    async check(key, windowSeconds, limit): Promise<RateLimitDecision> {
      const now = Date.now();
      const windowMs = windowSeconds * 1000;
      const cutoff = now - windowMs;

      let entry = buckets.get(key);
      if (!entry) {
        entry = { hits: [] };
        buckets.set(key, entry);
      }

      // Drop expired hits.
      while (entry.hits.length && entry.hits[0]! <= cutoff) entry.hits.shift();

      if (entry.hits.length >= limit) {
        const oldest = entry.hits[0]!;
        const retryAfterMs = oldest + windowMs - now;
        return {
          allowed: false,
          retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
          reason: "rate_limited",
          remaining: 0,
          limit,
        };
      }

      entry.hits.push(now);
      return {
        allowed: true,
        remaining: limit - entry.hits.length,
        limit,
      };
    },
  };
}
