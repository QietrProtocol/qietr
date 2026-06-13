// =============================================================================
// sanctions.ts — recipient ATA-owner blocklist.
//
// Loads a newline-delimited list of base58 pubkeys from a file path or
// HTTP(S) URL. Lines starting with `#` are comments; blank lines are
// skipped. Reload runs hourly by default; callers can also call reload()
// after a known list update.
// =============================================================================

import { readFile } from "node:fs/promises";

export interface SanctionsList {
  isBlocked(ownerPubkeyBase58: string): boolean;
  reload(): Promise<void>;
  /** Number of entries currently in the blocklist. */
  size(): number;
}

const COMMENT_PREFIX = "#";

const SANCTIONS_TIMEOUT_MS = 15_000;

async function loadSource(source: string): Promise<string> {
  if (source.startsWith("http://") || source.startsWith("https://")) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SANCTIONS_TIMEOUT_MS);
    try {
      const res = await fetch(source, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(
          `sanctions list fetch failed: ${res.status} ${res.statusText}`,
        );
      }
      return await res.text();
    } catch (e) {
      if (controller.signal.aborted) {
        throw new Error(
          `sanctions list fetch timed out after ${SANCTIONS_TIMEOUT_MS}ms`,
        );
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
  return readFile(source, "utf-8");
}

function parseList(raw: string): Set<string> {
  const out = new Set<string>();
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith(COMMENT_PREFIX)) continue;
    out.add(t);
  }
  return out;
}

export function createSanctionsList(source: string): SanctionsList {
  let blocked: Set<string> = new Set();

  async function reload(): Promise<void> {
    const raw = await loadSource(source);
    blocked = parseList(raw);
  }

  return {
    isBlocked(ownerPubkeyBase58: string): boolean {
      return blocked.has(ownerPubkeyBase58);
    },
    reload,
    size: (): number => blocked.size,
  };
}

/** Empty list — useful for tests or no-op deployments. */
export function emptySanctionsList(): SanctionsList {
  return {
    isBlocked: () => false,
    reload: async () => undefined,
    size: () => 0,
  };
}
