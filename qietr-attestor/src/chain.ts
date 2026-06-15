export type ChainId = "solana" | "base" | "polygon" | "ethereum";

export const CHAIN_EID_MAP: Record<ChainId, number> = {
  solana: 1,
  base: 2,
  polygon: 3,
  ethereum: 4,
};

export const CHAIN_NAMES: Record<number, ChainId> = {
  1: "solana",
  2: "base",
  3: "polygon",
  4: "ethereum",
};

export function isCrossChain(origin: ChainId, target: ChainId): boolean {
  return origin !== target;
}

export function getChainEid(chain: ChainId): number {
  const eid = CHAIN_EID_MAP[chain];
  if (eid === undefined) throw new Error(`unknown chain: ${chain}`);
  return eid;
}

export function chainFromEid(eid: number): ChainId {
  const chain = CHAIN_NAMES[eid];
  if (!chain) throw new Error(`unknown chain eid: ${eid}`);
  return chain;
}

export function formatChainPair(origin: ChainId, target: ChainId): string {
  return `${origin}→${target}`;
}
