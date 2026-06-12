// =============================================================================
// config.ts — runtime configuration parsed from env vars.
// =============================================================================

import { Keypair, PublicKey } from "@solana/web3.js";

export interface RelayerConfig {
  port: number;
  host: string;
  logLevel: string;
  rpcUrl: string;
  programId: PublicKey;
  feePayer: Keypair;
  /** Optional API key for Bearer auth. If unset, all requests are allowed. */
  apiKey?: string;
  /** ATA where gasless deposit fees are collected. */
  feeAta?: PublicKey;
  /** Fixed fee in micro-USDC charged per gasless deposit. */
  feeAmountMicro: number;
  /** Optional upstream Kora endpoint (if absent, we sign in-process). */
  koraUrl?: string;
  sanctionsSource?: string;
  /** Rate limit (requests per window) by IP. */
  rateIpLimit: number;
  rateIpWindowSeconds: number;
  /** Rate limit by recipient ATA owner. */
  rateRecipientLimit: number;
  rateRecipientWindowSeconds: number;
  /** Tier table the relayer accepts. JSON: `[{denomId:0, amountMicroUsdc:"100000"}, ...]` */
  denomTiers: { denomId: number; amountMicroUsdc: bigint }[];
  /** Fee bps charged per withdraw, surfaced on /quote. */
  feeBps: number;
}

const DEFAULT_TIERS = JSON.stringify([
  { denomId: 0, amountMicroUsdc: "100000" },
  { denomId: 1, amountMicroUsdc: "1000000" },
  { denomId: 2, amountMicroUsdc: "10000000" },
  { denomId: 3, amountMicroUsdc: "100000000" },
]);

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`required env var ${name} not set`);
  return v;
}

function parseFeePayer(): Keypair {
  const raw = required("FEE_PAYER_SECRET_KEY");
  // Accept either a JSON array (anchor format) or a base58 string.
  if (raw.trim().startsWith("[")) {
    const arr = JSON.parse(raw) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(arr));
  }
  const bs58 = require_bs58();
  return Keypair.fromSecretKey(bs58.decode(raw));
}

function require_bs58() {
  // bs58 is shipped with @solana/web3.js's deps; load it lazily so the
  // import error surfaces only when really needed.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("bs58");
}

export function loadConfig(): RelayerConfig {
  const tiersJson = process.env.DENOM_TIERS ?? DEFAULT_TIERS;
  const parsedTiers = JSON.parse(tiersJson) as Array<{
    denomId: number;
    amountMicroUsdc: string;
  }>;
  const cfg: RelayerConfig = {
    port: Number(process.env.PORT ?? 4080),
    host: process.env.HOST ?? "0.0.0.0",
    logLevel: process.env.LOG_LEVEL ?? "info",
    rpcUrl: process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
    programId: new PublicKey(
      process.env.PROGRAM_ID ?? "RrG8g32Kuo2tfbG8swwgYweDRtdKpTjpUxKT4RnEWLb",
    ),
    feePayer: parseFeePayer(),
    feeAmountMicro: Number(process.env.FEE_AMOUNT_MICRO ?? 50000),
    rateIpLimit: Number(process.env.RATE_IP_LIMIT ?? 20),
    rateIpWindowSeconds: Number(process.env.RATE_IP_WINDOW ?? 60),
    rateRecipientLimit: Number(process.env.RATE_RECIPIENT_LIMIT ?? 10),
    rateRecipientWindowSeconds: Number(
      process.env.RATE_RECIPIENT_WINDOW ?? 60,
    ),
    denomTiers: parsedTiers.map((t) => ({
      denomId: t.denomId,
      amountMicroUsdc: BigInt(t.amountMicroUsdc),
    })),
    feeBps: Number(process.env.FEE_BPS ?? 50), // 0.5% default; on-chain config wins
  };
  if (process.env.API_KEY) cfg.apiKey = process.env.API_KEY;
  if (process.env.FEE_ATA) cfg.feeAta = new PublicKey(process.env.FEE_ATA);
  if (process.env.KORA_URL) cfg.koraUrl = process.env.KORA_URL;
  if (process.env.SANCTIONS_LIST) cfg.sanctionsSource = process.env.SANCTIONS_LIST;
  return cfg;
}
