import { NetworkError } from "./errors.js";

export interface AttestorClientConfig {
  baseUrl: string;
}

export interface NullifierAttestation {
  denomId: number;
  nullifierHash: string;
  originChain: string;
  signature: string;
  attestedAt: string;
}

export class AttestorClient {
  private readonly baseUrl: string;

  constructor(config: AttestorClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
  }

  async health(): Promise<{ ok: boolean }> {
    return this.get("/health");
  }

  async requestNullifierAttestation(
    denomId: number,
    nullifierHash: string,
    originChain: string,
  ): Promise<NullifierAttestation> {
    return this.post("/attest", {
      denom_id: denomId,
      nullifier_hash: nullifierHash,
      origin_chain: originChain,
    });
  }

  private async get<T>(path: string): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`);
    } catch (e) {
      throw new NetworkError(`attestor GET ${path} failed: ${(e as Error).message}`);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new NetworkError(`attestor GET ${path} returned ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (e) {
      throw new NetworkError(`attestor POST ${path} failed: ${(e as Error).message}`);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new NetworkError(`attestor POST ${path} returned ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }
}
