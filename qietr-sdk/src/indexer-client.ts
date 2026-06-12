// =============================================================================
// indexer-client.ts — typed HTTP client for qietr-indexer.
//
// API shape mirrors qietr-indexer/api/src/routes/*.
// =============================================================================

import { NetworkError } from "./errors.js";

export interface DenominationInfo {
  denomId: number;
  amountMicroUsdc: string;
  depositCount: string;
  vaultAddress: string;
  lastSeenSlot: string;
  currentRoot: string | null;
  leafCount: string;
  updatedAt: string;
}

export interface MerkleProofResponse {
  denomId: number;
  leafIndex: number;
  leafCount: number;
  /** Big-endian 0x-prefixed hex string. */
  root: string;
  /** Big-endian 0x-prefixed hex strings, length 20 (tree depth). */
  pathElements: string[];
  /** 0 (left) or 1 (right), length 20. */
  pathIndices: number[];
}

export interface NullifierStatusResponse {
  spent: boolean;
  spentAtSlot?: string;
  spentAt?: string;
}

export class IndexerError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(`indexer ${status}: ${message}`);
    this.name = "IndexerError";
    this.status = status;
  }
}

export class IndexerClient {
  readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(baseUrl: string, fetchImpl: typeof fetch = globalThis.fetch) {
    // Strip trailing slash to make path joins predictable.
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.fetchImpl = fetchImpl;
  }

  private async getJson<T>(path: string): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        headers: { accept: "application/json" },
      });
    } catch (e) {
      throw new NetworkError(
        `indexer GET ${path} failed: ${(e as Error).message}`,
      );
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new IndexerError(res.status, body || res.statusText);
    }
    return (await res.json()) as T;
  }

  async denominations(): Promise<DenominationInfo[]> {
    const r = await this.getJson<{ denominations: DenominationInfo[] }>(
      "/denominations",
    );
    return r.denominations;
  }

  async merkleProof(
    denomId: number,
    commitmentHex: string,
  ): Promise<MerkleProofResponse> {
    const u = new URLSearchParams({
      denomId: String(denomId),
      commitment: commitmentHex,
    });
    return this.getJson<MerkleProofResponse>(`/merkle-proof?${u.toString()}`);
  }

  async nullifierStatus(
    denomId: number,
    nullifierHashHex: string,
  ): Promise<NullifierStatusResponse> {
    const u = new URLSearchParams({
      denomId: String(denomId),
      nullifierHash: nullifierHashHex,
    });
    return this.getJson<NullifierStatusResponse>(
      `/nullifier-status?${u.toString()}`,
    );
  }
}
