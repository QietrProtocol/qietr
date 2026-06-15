import { type ChainId, getChainEid } from "./chain.js";

export interface VaaPayload {
  version: number;
  timestamp: number;
  originChain: ChainId;
  emitterAddress: string;
  sequence: number;
  payload: Uint8Array;
}

export interface VaaRelayerConfig {
  wormholeRpcUrl: string;
  emitterAddress: string;
  targetChain: ChainId;
  maxBatchSize: number;
}

export class VaaRelayer {
  private config: VaaRelayerConfig;
  private sequence = 0;

  constructor(config: VaaRelayerConfig) {
    this.config = config;
  }

  async relayNullifier(
    nullifierHash: string,
    denomId: number,
    originChain: ChainId,
  ): Promise<string> {
    const payloadBytes = new Uint8Array(1 + 32);
    payloadBytes[0] = denomId;
    const hashBytes = hexToBytes(nullifierHash);
    payloadBytes.set(hashBytes.slice(0, 32), 1);

    const vaa: VaaPayload = {
      version: 1,
      timestamp: Math.floor(Date.now() / 1000),
      originChain,
      emitterAddress: this.config.emitterAddress,
      sequence: this.sequence++,
      payload: payloadBytes,
    };

    const vaaBytes = this.serializeVaa(vaa);
    const vaaBase64 = Buffer.from(vaaBytes).toString("base64");

    const res = await fetch(`${this.config.wormholeRpcUrl}/v1/vaa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vaa: vaaBase64, targetChain: getChainEid(this.config.targetChain) }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`VAA relay failed (${res.status}): ${text}`);
    }

    const json = await res.json() as { digest?: string };
    return json.digest ?? vaaBase64;
  }

  async relayBatch(
    nullifiers: Array<{ hash: string; denomId: number }>,
    originChain: ChainId,
  ): Promise<string[]> {
    const digests: string[] = [];
    for (let i = 0; i < nullifiers.length; i += this.config.maxBatchSize) {
      const batch = nullifiers.slice(i, i + this.config.maxBatchSize);
      for (const n of batch) {
        const d = await this.relayNullifier(n.hash, n.denomId, originChain);
        digests.push(d);
      }
    }
    return digests;
  }

  private serializeVaa(payload: VaaPayload): Uint8Array {
    const header = new Uint8Array(1 + 4 + 4 + 32 + 8);
    header[0] = payload.version;
    new DataView(header.buffer).setUint32(1, payload.timestamp, false);
    const originEid = getChainEid(payload.originChain);
    new DataView(header.buffer).setUint32(5, originEid, false);
    const emitterBytes = hexToBytes(payload.emitterAddress);
    header.set(emitterBytes.slice(0, 32), 9);
    new DataView(header.buffer).setBigUint64(41, BigInt(payload.sequence), false);

    const combined = new Uint8Array(header.length + payload.payload.length);
    combined.set(header);
    combined.set(payload.payload, header.length);
    return combined;
  }
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(clean[i * 2]! + clean[i * 2 + 1]!, 16);
  }
  return bytes;
}
