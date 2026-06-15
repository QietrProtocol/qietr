import { NullifierWatcher, type NullifierEvent, type WatcherConfig } from "./watcher.js";
import { VaaRelayer, type VaaRelayerConfig } from "./relayer.js";
import { type ChainId, isCrossChain, formatChainPair } from "./chain.js";

export interface AttestorConfig {
  originChain: ChainId;
  targetChain: ChainId;
  watcher: WatcherConfig;
  relayer: VaaRelayerConfig;
}

export interface AttestorOptions {
  logger?: (msg: string) => void;
}

export class Attestor {
  private config: AttestorConfig;
  private watcher: NullifierWatcher;
  private relayer: VaaRelayer;
  private relayed = new Set<string>();
  private logger: (msg: string) => void;

  constructor(config: AttestorConfig, opts?: AttestorOptions) {
    this.config = config;
    this.watcher = new NullifierWatcher(config.watcher);
    this.relayer = new VaaRelayer(config.relayer);
    this.logger = opts?.logger ?? (() => {});
  }

  async start(): Promise<void> {
    if (!isCrossChain(this.config.originChain, this.config.targetChain)) {
      throw new Error(
        `origin and target must differ; got ${formatChainPair(this.config.originChain, this.config.targetChain)}`,
      );
    }

    this.logger(
      `attestor starting: ${formatChainPair(this.config.originChain, this.config.targetChain)}`,
    );

    this.watcher.onNullifier((event: NullifierEvent) => {
      this.handleNullifier(event).catch((e) => {
        this.logger(`error handling nullifier: ${(e as Error).message}`);
      });
    });

    await this.watcher.start();
    this.logger("watcher started");
  }

  stop(): void {
    this.watcher.stop();
    this.logger("attestor stopped");
  }

  private async handleNullifier(event: NullifierEvent): Promise<void> {
    if (this.relayed.has(event.signature)) return;
    this.relayed.add(event.signature);

    this.logger(
      `nullifier ${event.nullifierHash.slice(0, 8)}… (denom ${event.denomId}) from ${event.chain} at slot ${event.spentAtSlot}`,
    );

    try {
      const digest = await this.relayer.relayNullifier(
        event.nullifierHash,
        event.denomId,
        event.chain,
      );
      this.logger(`relayed to ${this.config.targetChain}: ${digest.slice(0, 16)}…`);
    } catch (e) {
      this.logger(`relay failed: ${(e as Error).message}`);
    }
  }
}
