// =============================================================================
// chain.ts — Solana cluster, mint, and ATA helpers.
//
// Keeps @solana/spl-token out of the dependency graph: we derive the
// associated token address by hand using the ATA program id and seed
// recipe documented at
// https://docs.solana.com/integrations/spl-token#associated-token-accounts.
// =============================================================================

import {
  Connection,
  PublicKey,
  type Cluster as Web3Cluster,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "./program.js";
import type { Cluster, QietrSDKConfig } from "./types.js";

export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

/** Circle USDC mint on mainnet-beta. */
export const USDC_MINT_MAINNET = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);
/** Circle USDC-Dev mint on devnet. */
export const USDC_MINT_DEVNET = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);

// -----------------------------------------------------------------------------
// $QIET token mint — LIVE.
//
// $QIET was created via pump.fun on mainnet. Devnet has no $QIET mint; any
// code path targeting devnet must handle the placeholder gracefully (use
// `isQietMintDeployed()` to check before transferring or quoting).
// -----------------------------------------------------------------------------
const QIET_MINT_PLACEHOLDER = "11111111111111111111111111111111";

/** $QIET token mint on mainnet — live at pump.fun CA. */
export const QIET_MINT_MAINNET = new PublicKey(
  "MXDRgSQstTKBMunuF2VmcnBejpbidECL5vtCAb6pump",
);
/** $QIET token mint on devnet (PLACEHOLDER — not minted on devnet). */
export const QIET_MINT_DEVNET = new PublicKey(QIET_MINT_PLACEHOLDER);

/** True once a real $QIET mint replaces the placeholder for `cluster`. */
export function isQietMintDeployed(cluster: Cluster): boolean {
  const mint = cluster === "mainnet-beta" ? QIET_MINT_MAINNET : QIET_MINT_DEVNET;
  return mint.toBase58() !== QIET_MINT_PLACEHOLDER;
}

/** Return the $QIET mint, or throw if it's still the placeholder. */
export function requireQietMint(cluster: Cluster): PublicKey {
  if (!isQietMintDeployed(cluster)) {
    throw new Error(
      "$QIET is not deployed on this cluster — the mint constant is a System Program placeholder. " +
        "Mainnet only at this time.",
    );
  }
  return cluster === "mainnet-beta" ? QIET_MINT_MAINNET : QIET_MINT_DEVNET;
}

/** USDC has 6 decimals. */
export const USDC_DECIMALS = 6;
/** $QIET has 9 decimals. */
export const QIET_DECIMALS = 9;

/** MVP tier definitions — must match values written via initialize_denomination. */
export interface TierDefinition {
  denomId: number;
  amountMicroUsdc: bigint;
}

/**
 * Default tier layout from `docs/02-TRD.md` §3.4. Tiers can be overridden via
 * `QietrSDKConfig.tiers` once a non-default deployment is in use.
 */
export const DEFAULT_TIERS: readonly TierDefinition[] = Object.freeze([
  { denomId: 0, amountMicroUsdc: 100_000n },          // 0.1 USDC
  { denomId: 1, amountMicroUsdc: 1_000_000n },        // 1 USDC
  { denomId: 2, amountMicroUsdc: 10_000_000n },       // 10 USDC
  { denomId: 3, amountMicroUsdc: 100_000_000n },      // 100 USDC
]);

export function clusterEndpoint(cluster: Cluster): string {
  switch (cluster) {
    case "mainnet-beta":
      return "https://api.mainnet-beta.solana.com";
    case "devnet":
      return "https://api.devnet.solana.com";
    case "localnet":
      return "http://127.0.0.1:8899";
  }
}

export function clusterToWeb3(cluster: Cluster): Web3Cluster | null {
  switch (cluster) {
    case "mainnet-beta":
      return "mainnet-beta";
    case "devnet":
      return "devnet";
    case "localnet":
      return null;
  }
}

export function defaultUsdcMint(cluster: Cluster): PublicKey {
  switch (cluster) {
    case "mainnet-beta":
      return USDC_MINT_MAINNET;
    case "devnet":
      return USDC_MINT_DEVNET;
    case "localnet":
      // Localnet has no canonical mint — caller must override via config.
      throw new Error(
        "localnet has no default USDC mint; pass `usdcMint` in QietrSDKConfig",
      );
  }
}

/** Derive the canonical associated token account for (owner, mint). */
export function findAssociatedTokenAddress(
  owner: PublicKey,
  mint: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBytes(), TOKEN_PROGRAM_ID.toBytes(), mint.toBytes()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

export function makeConnection(config: QietrSDKConfig): Connection {
  const endpoint = config.rpcUrl ?? clusterEndpoint(config.cluster);
  return new Connection(endpoint, "confirmed");
}

// ---------------------------------------------------------------------------
// Cross-chain helpers (Phase L spec)
// ---------------------------------------------------------------------------

export type ChainId = "solana" | "base" | "polygon" | "ethereum";

const CHAIN_EID_MAP: Record<ChainId, number> = {
  solana: 1,
  base: 2,
  polygon: 3,
  ethereum: 4,
};

export function isCrossChain(origin: ChainId, target: ChainId): boolean {
  return origin !== target;
}

export function getChainEid(chain: ChainId): number {
  const eid = CHAIN_EID_MAP[chain];
  if (eid === undefined) throw new Error(`unknown chain: ${chain}`);
  return eid;
}

export function pickTier(
  amountUsdc: number,
  tiers: readonly TierDefinition[] = DEFAULT_TIERS,
): TierDefinition {
  const micro = BigInt(Math.round(amountUsdc * 10 ** USDC_DECIMALS));
  const match = tiers.find((t) => t.amountMicroUsdc === micro);
  if (!match) {
    const valid = tiers
      .map((t) => Number(t.amountMicroUsdc) / 10 ** USDC_DECIMALS)
      .join(", ");
    throw new Error(
      `unsupported deposit amount ${amountUsdc} USDC; valid tiers: [${valid}]`,
    );
  }
  return match;
}
