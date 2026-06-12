// =============================================================================
// use-sdk.ts — SDK instance hook bound to the wallet-adapter connection.
//
// `useQietrSdk()` returns a memoized `QietrSDK` (or null if the wallet is
// not connected). The cluster + RPC are read from the same env keys as
// WalletAdapterProvider so the chain settings stay in lockstep.
//
// `walletAdapterToSigner` adapts the wallet-adapter `useWallet` shape into
// the SDK's `SignerLike` interface, which only needs `publicKey` and
// `signTransaction`.
// =============================================================================

"use client";

import { useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import type { Transaction, VersionedTransaction } from "@solana/web3.js";
import { QietrSDK } from "@qietr/sdk";
import type { Cluster, SignerLike } from "@qietr/sdk/types";

function readCluster(): Cluster {
  const raw = (process.env.NEXT_PUBLIC_QIETR_CLUSTER ?? "devnet").toLowerCase();
  if (raw === "mainnet" || raw === "mainnet-beta") return "mainnet-beta";
  if (raw === "localnet" || raw === "localhost") return "localnet";
  return "devnet";
}

export function useQietrSdk(): QietrSDK | null {
  const { connection } = useConnection();
  return useMemo(() => {
    const indexerUrl = process.env.NEXT_PUBLIC_QIETR_INDEXER_URL;
    const proverPath = process.env.NEXT_PUBLIC_QIETR_PROVER_PATH;
    // The SDK now requires both an indexer base URL and a circuit-artifact
    // (prover) base URL and throws if either is missing. Without them the app
    // cannot deposit or pay, so return null and let callers show a
    // not-configured state instead of crashing the render.
    if (!indexerUrl || !proverPath) return null;
    try {
      return new QietrSDK({
        cluster: readCluster(),
        rpcUrl: connection.rpcEndpoint,
        indexerUrl,
        proverPath,
      });
    } catch {
      return null;
    }
  }, [connection.rpcEndpoint]);
}

export interface WalletSnapshot {
  signer: SignerLike | null;
  connected: boolean;
  address: string | null;
}

/**
 * Convert the wallet-adapter `useWallet()` shape into a `SignerLike`.
 *
 * The adapter's `signTransaction` is generic over `Transaction | VersionedTransaction`;
 * we widen it to `<T>(tx: T) => Promise<T>` so it satisfies SignerLike.
 */
export function useWalletSigner(): WalletSnapshot {
  const wallet = useWallet();
  return useMemo<WalletSnapshot>(() => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      return { signer: null, connected: false, address: null };
    }
    const publicKey = wallet.publicKey;
    const sign = wallet.signTransaction;
    const signer: SignerLike = {
      publicKey,
      async signTransaction<T>(tx: T): Promise<T> {
        return (await sign(
          tx as unknown as Transaction | VersionedTransaction,
        )) as unknown as T;
      },
    };
    return {
      signer,
      connected: true,
      address: publicKey.toBase58(),
    };
  }, [wallet.publicKey, wallet.signTransaction]);
}
