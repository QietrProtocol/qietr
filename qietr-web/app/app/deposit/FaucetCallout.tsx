"use client";

// =============================================================================
// FaucetCallout — self-serve devnet funding for testers.
//
// To deposit, a tester needs two things on Solana devnet:
//   1. a little SOL for transaction fees, and
//   2. USDC-Dev of the EXACT mint the pool accepts (Circle's canonical
//      devnet mint — see USDC_MINT_DEVNET). Any other "test USDC" fails the
//      deposit with AccountNotInitialized on the depositor's token account,
//      because the program derives the ATA for this specific mint.
//
// This card links straight to the two faucets and shows the exact mint with a
// click-to-copy button so testers can verify the token they claim matches.
// Devnet/localnet only — hidden on mainnet, where users bring real USDC.
// =============================================================================

import { useState } from "react";
import { USDC_MINT_DEVNET } from "@qietr/sdk";
import { Card } from "../../_components/Card";

function readCluster(): string {
  return (process.env.NEXT_PUBLIC_QIETR_CLUSTER ?? "devnet").toLowerCase();
}

const linkStyle: React.CSSProperties = {
  color: "var(--accent)",
  textDecoration: "none",
  fontWeight: 500,
};

export function FaucetCallout() {
  // Hooks must run before any early return (rules-of-hooks).
  const [copied, setCopied] = useState(false);

  const cluster = readCluster();
  // Only devnet/localnet testers need faucets; on mainnet users bring real USDC.
  if (cluster === "mainnet" || cluster === "mainnet-beta") return null;

  const mint = USDC_MINT_DEVNET.toBase58();

  async function copyMint(): Promise<void> {
    try {
      await navigator.clipboard.writeText(mint);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  return (
    <Card style={{ background: "var(--surface-2)" }}>
      <h2 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>
        Need devnet test funds?
      </h2>
      <p
        style={{
          color: "var(--text-secondary)",
          fontSize: "0.9375rem",
          marginTop: 0,
          marginBottom: "var(--space-4)",
          lineHeight: 1.6,
        }}
      >
        This is a free devnet test build. Claim throwaway tokens, then come back
        and deposit — no real money involved.
      </p>

      <ol style={{ margin: 0, paddingLeft: "var(--space-6)", lineHeight: 1.9 }}>
        <li>
          <a
            href="https://faucet.circle.com"
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
          >
            Circle USDC faucet ↗
          </a>{" "}
          — choose <strong>Solana Devnet</strong>, paste your wallet, claim
          USDC. (You can claim repeatedly.)
        </li>
        <li>
          <a
            href="https://faucet.solana.com"
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
          >
            Solana SOL faucet ↗
          </a>{" "}
          — a little SOL for transaction fees (only if your wallet is empty).
        </li>
      </ol>

      <div
        style={{
          marginTop: "var(--space-4)",
          paddingTop: "var(--space-4)",
          borderTop: "1px solid var(--border-subtle)",
          fontSize: "0.875rem",
          color: "var(--text-secondary)",
        }}
      >
        <span>The pool accepts only this USDC-Dev mint:</span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            marginTop: "var(--space-2)",
          }}
        >
          <code
            style={{
              wordBreak: "break-all",
              fontSize: "0.8125rem",
              color: "var(--text-primary)",
            }}
          >
            {mint}
          </code>
          <button
            onClick={() => void copyMint()}
            style={{
              flexShrink: 0,
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-base)",
              background: "var(--surface-0)",
              color: "var(--text-primary)",
              fontSize: "0.75rem",
              padding: "var(--space-1) var(--space-2)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <p style={{ margin: "var(--space-2) 0 0" }}>
          If you claimed “USDC” elsewhere and the deposit fails, the mint
          doesn’t match — use Circle’s faucet above.
        </p>
      </div>
    </Card>
  );
}
