"use client";

// =============================================================================
// WalletAdapterProvider — root context wrapper.
//
// We default to devnet because the pool isn't on mainnet-beta yet. The
// cluster is overridable via `NEXT_PUBLIC_QIETR_CLUSTER` so a developer
// pointing at a local validator just sets `localnet`.
//
// `autoConnect` is false on purpose — the user shouldn't be silently
// connected to a wallet just by visiting qietr.com.
// =============================================================================

import { useMemo, type ReactNode } from "react";
import { clusterApiUrl } from "@solana/web3.js";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";

import "@solana/wallet-adapter-react-ui/styles.css";

type ConfiguredCluster = "mainnet-beta" | "devnet" | "localnet";

function readCluster(): ConfiguredCluster {
  const raw = (process.env.NEXT_PUBLIC_QIETR_CLUSTER ?? "devnet").toLowerCase();
  if (raw === "mainnet" || raw === "mainnet-beta") return "mainnet-beta";
  if (raw === "localnet" || raw === "localhost") return "localnet";
  return "devnet";
}

function endpointFor(cluster: ConfiguredCluster): string {
  const override = process.env.NEXT_PUBLIC_QIETR_RPC_URL;
  if (override) return override;
  switch (cluster) {
    case "mainnet-beta":
      return clusterApiUrl(WalletAdapterNetwork.Mainnet);
    case "devnet":
      return clusterApiUrl(WalletAdapterNetwork.Devnet);
    case "localnet":
      return "http://127.0.0.1:8899";
  }
}

export function WalletAdapterProvider({ children }: { children: ReactNode }) {
  const cluster = readCluster();
  const endpoint = endpointFor(cluster);
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
