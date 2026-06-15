// =============================================================================
// explorer.ts — build Solana Explorer URLs for the configured cluster.
//
// The cluster is read from the same env key as the SDK/wallet provider
// (NEXT_PUBLIC_QIETR_CLUSTER) so explorer links always point at the chain the
// app is actually transacting on. Mainnet needs no `?cluster=` suffix; devnet
// and localnet do (localnet uses Explorer's custom-RPC mode).
// =============================================================================

function clusterSuffix(): string {
  const raw = (process.env.NEXT_PUBLIC_QIETR_CLUSTER ?? "devnet").toLowerCase();
  if (raw === "mainnet" || raw === "mainnet-beta") return "";
  if (raw === "localnet" || raw === "localhost") {
    return "?cluster=custom&customUrl=" + encodeURIComponent("http://localhost:8899");
  }
  return "?cluster=devnet";
}

/** Explorer URL for a transaction signature. */
export function explorerTxUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}${clusterSuffix()}`;
}

/** Explorer URL for an account / program address. */
export function explorerAddressUrl(address: string): string {
  return `https://explorer.solana.com/address/${address}${clusterSuffix()}`;
}
