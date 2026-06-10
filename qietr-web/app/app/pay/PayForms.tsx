"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { decryptNote } from "@qietr/sdk";
import { Card } from "../../_components/Card";
import {
  appendActivity,
  loadEncryptedNote,
  saveEncryptedNote,
} from "../../_lib/storage";
import { useQietrSdk, useWalletSigner } from "../../_lib/use-sdk";

type Tab = "direct" | "x402";

type Status =
  | { kind: "idle" }
  | { kind: "unlocking" }
  | { kind: "submitting" }
  | { kind: "success"; signature: string }
  | { kind: "error"; message: string };

export function PayForms() {
  const [tab, setTab] = useState<Tab>("direct");
  return (
    <div>
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: "var(--space-2)",
          borderBottom: "1px solid var(--border-subtle)",
          marginBottom: "var(--space-6)",
        }}
      >
        <TabButton active={tab === "direct"} onClick={() => setTab("direct")} label="Direct payment" />
        <TabButton active={tab === "x402"} onClick={() => setTab("x402")} label="x402 endpoint" />
      </div>
      {tab === "direct" ? <DirectForm /> : <X402Form />}
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        padding: "var(--space-3) var(--space-4)",
        background: "transparent",
        border: "none",
        borderBottom: active ? "2px solid var(--border-strong)" : "2px solid transparent",
        marginBottom: -1,
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        fontFamily: "inherit",
        fontSize: "0.9375rem",
        cursor: "pointer",
        fontWeight: active ? 500 : 400,
      }}
    >
      {label}
    </button>
  );
}

function DirectForm() {
  const sdk = useQietrSdk();
  const { signer, connected } = useWalletSigner();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function unlockAndSetNote(): Promise<boolean> {
    const blob = loadEncryptedNote();
    if (!blob) {
      setStatus({
        kind: "error",
        message: "No encrypted note found. Restore or create one in /app/note first.",
      });
      return false;
    }
    setStatus({ kind: "unlocking" });
    try {
      const note = await decryptNote(blob, passphrase);
      sdk?.setNote(note);
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setStatus({ kind: "error", message });
      return false;
    }
  }

  async function handlePay(): Promise<void> {
    if (!sdk || !signer) {
      setStatus({ kind: "error", message: "Connect a wallet first." });
      return;
    }
    let to: PublicKey;
    try {
      to = new PublicKey(recipient);
    } catch {
      setStatus({ kind: "error", message: "Invalid Solana address." });
      return;
    }
    const amt = Number.parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setStatus({ kind: "error", message: "Enter a positive USDC amount." });
      return;
    }
    if (!(await unlockAndSetNote())) return;

    setStatus({ kind: "submitting" });
    try {
      const result = await sdk.pay({ to, amount: amt, feePayer: signer });
      // Persist the updated note so the next call sees the change commitment.
      const blob = await encryptUpdated(result.updatedNote, passphrase);
      saveEncryptedNote(blob);
      appendActivity({
        type: "payment",
        status: "ok",
        detail: `${amt} USDC to ${recipient.slice(0, 4)}…${recipient.slice(-4)} · ${result.withdrawSignature.slice(0, 8)}…`,
      });
      setStatus({ kind: "success", signature: result.withdrawSignature });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      appendActivity({
        type: "payment",
        status: "error",
        detail: message.slice(0, 120),
      });
      setStatus({ kind: "error", message });
    }
  }

  return (
    <Card>
      <Field label="Recipient (Solana address)">
        <input
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="e.g. 7xKXtg2C..."
          style={inputStyle}
        />
      </Field>
      <Field label="Amount (USDC)">
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.000000"
          style={inputStyle}
        />
      </Field>
      <Field label="Note passphrase">
        <input
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="Used to unlock your saved note for this payment"
          style={inputStyle}
        />
      </Field>
      <p
        style={{
          color: "var(--text-secondary)",
          fontSize: "0.875rem",
          margin: "var(--space-2) 0 var(--space-6)",
        }}
      >
        The note stays encrypted on this device. The passphrase only leaves
        memory long enough to decrypt and re-encrypt the post-payment note.
      </p>
      <PrimaryButton
        label={
          status.kind === "submitting"
            ? "Submitting…"
            : status.kind === "unlocking"
              ? "Unlocking note…"
              : "Send privately"
        }
        disabled={!connected || status.kind === "submitting" || status.kind === "unlocking"}
        onClick={() => void handlePay()}
      />
      <StatusLine status={status} />
    </Card>
  );
}

function X402Form() {
  const sdk = useQietrSdk();
  const { signer, connected } = useWalletSigner();
  const [url, setUrl] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [responseBody, setResponseBody] = useState<string | null>(null);

  async function handleFetch(): Promise<void> {
    if (!sdk || !signer) {
      setStatus({ kind: "error", message: "Connect a wallet first." });
      return;
    }
    const blob = loadEncryptedNote();
    if (!blob) {
      setStatus({
        kind: "error",
        message: "No encrypted note found. Restore or create one in /app/note first.",
      });
      return;
    }
    setStatus({ kind: "unlocking" });
    try {
      const note = await decryptNote(blob, passphrase);
      sdk.setNote(note);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setStatus({ kind: "error", message });
      return;
    }

    setStatus({ kind: "submitting" });
    try {
      const wrapped = sdk.wrapFetch(globalThis.fetch.bind(globalThis), {
        feePayer: signer,
      });
      const res = await wrapped(url);
      const body = await res.text();
      const updated = sdk.getUpdatedNote();
      if (updated) {
        const reBlob = await encryptUpdated(updated, passphrase);
        saveEncryptedNote(reBlob);
      }
      appendActivity({
        type: "payment",
        status: res.ok ? "ok" : "error",
        detail: `x402 ${url.slice(0, 60)} · ${res.status}`,
      });
      setResponseBody(body.slice(0, 2000));
      setStatus({ kind: "success", signature: "" });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      appendActivity({
        type: "payment",
        status: "error",
        detail: `x402 · ${message.slice(0, 100)}`,
      });
      setStatus({ kind: "error", message });
    }
  }

  return (
    <Card>
      <Field label="x402 endpoint URL">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://api.example.com/v1/expensive-endpoint"
          style={inputStyle}
        />
      </Field>
      <Field label="Note passphrase">
        <input
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="Used to unlock your saved note"
          style={inputStyle}
        />
      </Field>
      <p
        style={{
          color: "var(--text-secondary)",
          fontSize: "0.875rem",
          margin: "var(--space-2) 0 var(--space-6)",
        }}
      >
        We call the URL, parse the <code>402 Payment Required</code> response,
        match a denomination from your note, and resubmit with an{" "}
        <code>X-PAYMENT</code> header signed by a one-time burner pubkey.
      </p>
      <PrimaryButton
        label={
          status.kind === "submitting"
            ? "Paying…"
            : status.kind === "unlocking"
              ? "Unlocking note…"
              : "Pay and retry"
        }
        disabled={!connected || status.kind === "submitting" || status.kind === "unlocking"}
        onClick={() => void handleFetch()}
      />
      <StatusLine status={status} />
      {responseBody !== null ? (
        <pre
          style={{
            background: "var(--surface-1)",
            padding: "var(--space-3)",
            borderRadius: "var(--radius-base)",
            marginTop: "var(--space-4)",
            fontSize: "0.8125rem",
            overflow: "auto",
            maxHeight: 240,
          }}
        >
          {responseBody}
        </pre>
      ) : null}
    </Card>
  );
}

async function encryptUpdated(note: unknown, passphrase: string): Promise<string> {
  const { encryptNote } = await import("@qietr/sdk");
  return encryptNote(note as never, passphrase);
}

function StatusLine({ status }: { status: Status }) {
  if (status.kind === "success") {
    return (
      <p
        style={{
          marginTop: "var(--space-4)",
          color: "var(--success)",
          fontSize: "0.875rem",
          wordBreak: "break-all",
        }}
      >
        {status.signature ? (
          <>
            Withdraw signature: <code>{status.signature}</code>
          </>
        ) : (
          "Done."
        )}
      </p>
    );
  }
  if (status.kind === "error") {
    return (
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
    );
  }
  return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: "var(--space-4)" }}>
      <span
        style={{
          display: "block",
          fontSize: "0.875rem",
          color: "var(--text-secondary)",
          marginBottom: "var(--space-1)",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "var(--space-3)",
  borderRadius: "var(--radius-base)",
  border: "1px solid var(--border-subtle)",
  fontFamily: "var(--font-mono)",
  fontSize: "0.9375rem",
  background: "var(--surface-0)",
  color: "var(--text-primary)",
};

function PrimaryButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "var(--space-3) var(--space-6)",
        borderRadius: "var(--radius-base)",
        border: "none",
        background: "var(--accent)",
        color: "var(--text-inverse)",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: "0.9375rem",
        fontWeight: 500,
        opacity: disabled ? 0.5 : 1,
        fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}
