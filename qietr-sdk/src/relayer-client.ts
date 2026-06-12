import { RelayerError, NetworkError } from "./errors.js";
import type { RelayerQuote } from "./types.js";

export interface RelayerClientConfig {
  baseUrl: string;
}

export class RelayerClient {
  private readonly baseUrl: string;

  constructor(config: RelayerClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
  }

  async health(): Promise<{ ok: boolean; feePayer: string }> {
    return this.get("/health");
  }

  async quote(): Promise<RelayerQuote> {
    return this.get("/deposit-quote");
  }

  async submitDeposit(txBase64: string): Promise<{ signature: string }> {
    return this.post("/submit-deposit", { tx_base64: txBase64 });
  }

  private async get<T>(path: string): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`);
    } catch (e) {
      throw new NetworkError(`relayer GET ${path} failed: ${(e as Error).message}`);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new NetworkError(`relayer GET ${path} returned ${res.status}: ${body}`);
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
      throw new NetworkError(`relayer POST ${path} failed: ${(e as Error).message}`);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new RelayerError(`relayer POST ${path} returned ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }
}
