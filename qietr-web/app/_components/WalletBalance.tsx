"use client";

// =============================================================================
// WalletBalance — on-demand + auto wallet balance for the connected wallet.
//
// Shows SOL (for transaction fees) and USDC (the deposit token) so a user can
// see their wallet balance on any app page. Auto-fetches on connect / address
// change, with a manual "Refresh" for re-checks (e.g. after a faucet claim).
// The USDC mint is the exact one the pool accepts, derived from the cluster —
// a zero USDC reading flags a wrong-mint claim early.
//
// Shared across all /app pages. Render it inside a <Card> for consistent chrome.
// =============================================================================

import { useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { USDC_MINT_DEVNET, USDC_MINT_MAINNET, findAssociatedTokenAddress } from "@qietr/sdk";
import { useWalletSigner } from "../_lib/use-sdk";

function usdcMintForCluster() {
  const raw = (process.env.NEXT_PUBLIC_QIETR_CLUSTER ?? "devnet").toLowerCase();
  if (raw === "mainnet" || raw === "mainnet-beta") return USDC_MINT_MAINNET;
  return USDC_MINT_DEVNET;
}

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "loaded"; sol: number; usdc: number }
  | { kind: "error"; message: string };

export function WalletBalance() {
  const { connection } = useConnection();
  const { signer, connected, address } = useWalletSigner();
  const [state, setState] = useState<State>({ kind: "idle" });

  async function refresh(): Promise<void> {
    if (!signer) {
      setState({ kind: "error", message: "Connect a wallet first." });
      return;
    }
    setState({ kind: "loading" });
    try {
      const owner = signer.publicKey;

      // SOL balance (lamports → SOL).
      const lamports = await connection.getBalance(owner);
      const sol = lamports / LAMPORTS_PER_SOL;

      // USDC balance: read the owner's associated token account for the pool's
      // mint. A missing ATA simply means zero USDC has ever arrived.
      const ata = findAssociatedTokenAddress(owner, usdcMintForCluster());
      let usdc = 0;
      try {
        const bal = await connection.getTokenAccountBalance(ata);
        usdc = bal.value.uiAmount ?? 0;
      } catch {
        // ATA not initialized yet → no USDC. Leave usdc at 0.
        usdc = 0;
      }

      setState({ kind: "loaded", sol, usdc });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setState({ kind: "error", message });
    }
  }

  // Auto-fetch the latest balance whenever a wallet connects or the connected
  // address changes, so the user never has to click to see their balance. The
  // manual "Refresh" button stays for on-demand re-checks (e.g. right after
  // claiming from a faucet). Keyed on `address` so it fires once per connected
  // wallet, not on every render.
  useEffect(() => {
    if (!connected || !address) {
      setState({ kind: "idle" });
      return;
    }
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, address]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-4)",
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ fontSize: "1.125rem", margin: 0 }}>Wallet balance</h2>
        <button
          onClick={() => void refresh()}
          disabled={!connected || state.kind === "loading"}
          style={{
            padding: "var(--space-2) var(--space-4)",
            borderRadius: "var(--radius-base)",
            border: "1px solid var(--border-strong)",
            background: "var(--surface-0)",
            color: "var(--text-primary)",
            cursor: connected && state.kind !== "loading" ? "pointer" : "not-allowed",
            fontSize: "0.875rem",
            fontFamily: "inherit",
            opacity: connected ? 1 : 0.5,
          }}
        >
          {state.kind === "loading" ? "Checking…" : state.kind === "loaded" ? "Refresh" : "Check balance"}
        </button>
      </div>

      {!connected ? (
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: "var(--space-3) 0 0" }}>
          Connect a wallet to view its balance.
        </p>
      ) : null}

      {state.kind === "loaded" ? (
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "max-content 1fr",
            gap: "var(--space-2) var(--space-6)",
            margin: "var(--space-4) 0 0",
            fontSize: "0.9375rem",
          }}
        >
          <dt style={{ color: "var(--text-secondary)" }}>USDC</dt>
          <dd style={{ margin: 0, fontWeight: 500 }}>{state.usdc.toLocaleString(undefined, { maximumFractionDigits: 6 })} USDC</dd>
          <dt style={{ color: "var(--text-secondary)" }}>SOL</dt>
          <dd style={{ margin: 0, color: "var(--text-secondary)" }}>{state.sol.toLocaleString(undefined, { maximumFractionDigits: 6 })} SOL</dd>
        </dl>
      ) : null}

      {state.kind === "error" ? (
        <p style={{ color: "var(--danger)", fontSize: "0.875rem", margin: "var(--space-3) 0 0", wordBreak: "break-word" }}>
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
