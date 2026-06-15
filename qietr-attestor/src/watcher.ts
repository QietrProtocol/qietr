import { type ChainId } from "./chain.js";

export interface NullifierEvent {
  chain: ChainId;
  denomId: number;
  nullifierHash: string;
  spentAtSlot: number;
  signature: string;
}

export interface WatcherConfig {
  chain: ChainId;
  poolProgramId: string;
  rpcUrl: string;
  pollIntervalMs: number;
}

export class NullifierWatcher {
  private config: WatcherConfig;
  private lastSlot: number;
  private running = false;
  private listeners: Array<(event: NullifierEvent) => void> = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: WatcherConfig) {
    this.config = config;
    this.lastSlot = 0;
  }

  onNullifier(cb: (event: NullifierEvent) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    await this.poll();
    this.pollTimer = setInterval(() => this.poll(), this.config.pollIntervalMs);
  }

  stop(): void {
    this.running = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  getLastSlot(): number {
    return this.lastSlot;
  }

  private async poll(): Promise<void> {
    try {
      const url = `${this.config.rpcUrl}`;
      const body = {
        jsonrpc: "2.0",
        id: 1,
        method: "getProgramAccounts",
        params: [
          this.config.poolProgramId,
          {
            encoding: "base64",
            filters: [
              { dataSize: 42 },
              { memcmp: { offset: 0, bytes: "2w==" } },
            ],
          },
        ],
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return;

      const json = await res.json() as { result?: Array<{ pubkey: string; account: { data: [string, string]; slot: number } }> };
      if (!json.result) return;

      for (const acct of json.result) {
        const slot = acct.account.slot;
        if (slot <= this.lastSlot) continue;

        const [dataEncoded] = acct.account.data;
        const decoded = Uint8Array.from(atob(dataEncoded), (c) => c.charCodeAt(0));

        const denomId = decoded[8]!;
        const nullifierHashBytes = decoded.slice(9, 41);
        const spentAtSlotBytes = decoded.slice(41, 49);
        const nullifierHash = Buffer.from(nullifierHashBytes).toString("hex");
        const spentAtSlot = Number(new DataView(spentAtSlotBytes.buffer).getBigUint64(0, true));

        const event: NullifierEvent = {
          chain: this.config.chain,
          denomId,
          nullifierHash,
          spentAtSlot,
          signature: acct.pubkey,
        };

        this.lastSlot = slot;
        for (const cb of this.listeners) {
          cb(event);
        }
      }
    } catch {
      // poll silently — next interval retries
    }
  }
}
