"use client";

import { useState } from "react";
import { appendActivity, formatUsdc } from "../../_lib/storage";
import { useQietrSdk, useWalletSigner } from "../../_lib/use-sdk";

interface TierOption {
  label: string;
  amount: number; // USDC whole units; the SDK converts to micro internally
  denomId: number;
}

const TIERS: TierOption[] = [
  { label: "0.1 USDC", amount: 0.1, denomId: 0 },
  { label: "1 USDC", amount: 1, denomId: 1 },
  { label: "10 USDC", amount: 10, denomId: 2 },
  { label: "100 USDC", amount: 100, denomId: 3 },
];

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; signature: string; total: number }
  | { kind: "error"; message: string };

export function TierPicker() {
  const [selected, setSelected] = useState<number>(2);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const sdk = useQietrSdk();
  const { signer, connected, address } = useWalletSigner();

  const tier = TIERS[selected]!;

  async function handleDeposit(): Promise<void> {
    if (!sdk || !signer) {
      setStatus({ kind: "error", message: "Connect a wallet first." });
      return;
    }
    setStatus({ kind: "submitting" });
    try {
      await sdk.deposit({ amount: tier.amount, payer: signer });
      const sig = sdk.lastDepositSignature ?? "unknown";
      appendActivity({
        type: "deposit",
        status: "ok",
        detail: `${tier.label} · ${sig.slice(0, 8)}…`,
      });
      setStatus({ kind: "success", signature: sig, total: tier.amount });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      appendActivity({
        type: "deposit",
        status: "error",
        detail: `${tier.label} · ${message.slice(0, 80)}`,
      });
      setStatus({ kind: "error", message });
    }
  }

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Denomination tier"
        style={{
          display: "flex",
          gap: "var(--space-3)",
          flexWrap: "wrap",
          marginBottom: "var(--space-6)",
        }}
      >
        {TIERS.map((t) => {
          const isOn = t.denomId === selected;
          return (
            <button
              key={t.denomId}
              role="radio"
              aria-checked={isOn}
              onClick={() => setSelected(t.denomId)}
              style={{
                border: `1px solid ${isOn ? "var(--border-strong)" : "var(--border-subtle)"}`,
                borderWidth: isOn ? 2 : 1,
                borderRadius: "var(--radius-pill)",
                padding: `${isOn ? "calc(var(--space-2) - 1px)" : "var(--space-2)"} var(--space-4)`,
                background: "var(--surface-0)",
                fontSize: "0.9375rem",
                cursor: "pointer",
                fontFamily: "inherit",
                color: "var(--text-primary)",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "max-content 1fr",
          gap: "var(--space-2) var(--space-6)",
          margin: 0,
          fontSize: "0.9375rem",
        }}
      >
        <dt style={{ color: "var(--text-secondary)" }}>Selected tier</dt>
        <dd style={{ margin: 0 }}>{tier.label}</dd>
        <dt style={{ color: "var(--text-secondary)" }}>Wallet</dt>
        <dd style={{ margin: 0, color: "var(--text-secondary)" }}>
          {connected ? `${address?.slice(0, 4)}…${address?.slice(-4)}` : "Not connected"}
        </dd>
        <dt style={{ color: "var(--text-secondary)" }}>Protocol fee</dt>
        <dd style={{ margin: 0, color: "var(--text-secondary)" }}>
          Configured on-chain via PoolConfig.fee_bps.
        </dd>
      </dl>

      <div style={{ marginTop: "var(--space-6)" }}>
        <button
          onClick={() => void handleDeposit()}
          disabled={!connected || status.kind === "submitting"}
          style={{
            padding: "var(--space-3) var(--space-6)",
            borderRadius: "var(--radius-base)",
            border: "none",
            background: "var(--accent)",
            color: "var(--text-inverse)",
            cursor: connected ? "pointer" : "not-allowed",
            fontSize: "0.9375rem",
            fontWeight: 500,
            opacity: connected ? 1 : 0.5,
            fontFamily: "inherit",
          }}
        >
          {status.kind === "submitting"
            ? "Submitting…"
            : `Deposit ${formatUsdc(tier.amount * 1_000_000)}`}
        </button>
      </div>

      {status.kind === "success" ? (
        <p
          style={{
            marginTop: "var(--space-4)",
            color: "var(--success)",
            fontSize: "0.875rem",
            wordBreak: "break-all",
          }}
        >
          Deposit submitted. Signature: <code>{status.signature}</code>
        </p>
      ) : null}
      {status.kind === "error" ? (
        <p
          style={{
            marginTop: "var(--space-4)",
            color: "var(--danger)",
            fontSize: "0.875rem",
            wordBreak: "break-word",
          }}
        >
          {status.message}
        </p>
      ) : null}
    </div>
  );
}
