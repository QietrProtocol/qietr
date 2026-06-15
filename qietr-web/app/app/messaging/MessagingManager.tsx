"use client";

import { useState, useCallback, useEffect } from "react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import {
  encryptMsgBody,
  decryptMsgBody,
  buildSendMsgIx,
  buildDeleteMsgIx,
  findMsgPda,
  parseMessageAccount,
  QIETR_MSG_PROGRAM_ID,
  type EncryptedMessage,
} from "@qietr/sdk";
import { Card } from "../../_components/Card";
import { explorerTxUrl } from "../../_lib/explorer";
import { appendActivity } from "../../_lib/storage";
import { useWalletSigner } from "../../_lib/use-sdk";
import { sendAndConfirm } from "../../_lib/confirm-tx";

type Tab = "send" | "inbox";

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; signature: string }
  | { kind: "error"; message: string };

export function MessagingManager() {
  const [tab, setTab] = useState<Tab>("send");
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
        <TabBtn active={tab === "send"} onClick={() => setTab("send")} label="Send message" />
        <TabBtn active={tab === "inbox"} onClick={() => setTab("inbox")} label="Inbox" />
      </div>
      {tab === "send" ? <SendForm /> : <InboxView />}
    </div>
  );
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
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

function SendForm() {
  const { connection } = useConnection();
  const { signer, connected, address } = useWalletSigner();
  const [recipient, setRecipient] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleSend(): Promise<void> {
    if (!signer || !connected) {
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
    if (!body.trim()) {
      setStatus({ kind: "error", message: "Message body cannot be empty." });
      return;
    }
    if (new TextEncoder().encode(body).length > 1024) {
      setStatus({ kind: "error", message: "Message body exceeds 1024 bytes." });
      return;
    }
    if (!passphrase) {
      setStatus({ kind: "error", message: "Enter a passphrase for encryption." });
      return;
    }

    setStatus({ kind: "submitting" });
    try {
      const nonce = crypto.getRandomValues(new Uint8Array(8));
      const encrypted = await encryptMsgBody(body, passphrase);
      const encryptedBytes = new TextEncoder().encode(encrypted);

      const ix = buildSendMsgIx(to, nonce, encryptedBytes, {
        sender: signer.publicKey,
      });

      const tx = new Transaction();
      tx.add(ix);
      tx.feePayer = signer.publicKey;

      const bh = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = bh.blockhash;

      const signed = await signer.signTransaction(tx);
      const sig = await sendAndConfirm(connection, signed.serialize(), bh.lastValidBlockHeight);

      appendActivity({
        type: "payment",
        status: "ok",
        detail: `msg to ${recipient.slice(0, 4)}…${recipient.slice(-4)} · ${sig.slice(0, 8)}…`,
      });
      setStatus({ kind: "success", signature: sig });
      setBody("");
      setRecipient("");
      setPassphrase("");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      appendActivity({
        type: "payment",
        status: "error",
        detail: `msg send · ${message.slice(0, 100)}`,
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
      <Field label="Encryption passphrase">
        <input
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="Shared with recipient out-of-band"
          style={inputStyle}
        />
      </Field>
      <Field label="Message body">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type your encrypted message..."
          rows={4}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-body)" }}
        />
      </Field>
      <p style={{ color: "var(--text-secondary)", fontSize: "0.8125rem", marginTop: "-0.5rem", marginBottom: "var(--space-4)" }}>
        Encrypted with Argon2id + AES-256-GCM before sending. Max 1024 bytes.
      </p>
      <PrimaryBtn
        label={status.kind === "submitting" ? "Sending…" : "Send encrypted"}
        disabled={!connected || status.kind === "submitting"}
        onClick={() => void handleSend()}
      />
      <StatusLine status={status} />
    </Card>
  );
}

function InboxView() {
  const { connection } = useConnection();
  const { signer, connected, address } = useWalletSigner();
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [decrypted, setDecrypted] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  interface InboxMessage {
    pda: string;
    from: string;
    timestamp: number;
    bodyBase64: string;
  }

  const fetchInbox = useCallback(async () => {
    if (!address || !connected) return;
    setLoading(true);
    setError(null);
    try {
      const toPubkey = new PublicKey(address);
      const accounts = await connection.getProgramAccounts(QIETR_MSG_PROGRAM_ID, {
        filters: [
          { dataSize: 1115 },
          { memcmp: { offset: 40, bytes: toPubkey.toBase58() } },
        ],
      });

      const parsed: InboxMessage[] = [];
      for (const { account } of accounts) {
        const msg = parseMessageAccount(account.data as Uint8Array);
        if (msg) {
          parsed.push({
            pda: msg.pda,
            from: msg.from,
            timestamp: msg.timestamp,
            bodyBase64: msg.bodyBase64,
          });
        }
      }
      parsed.sort((a, b) => b.timestamp - a.timestamp);
      setMessages(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [connection, address, connected]);

  useEffect(() => {
    if (connected && address) {
      fetchInbox();
    } else {
      setMessages([]);
    }
  }, [connected, address, fetchInbox]);

  async function handleDecrypt(msg: InboxMessage): Promise<void> {
    if (!passphrase) {
      setStatus({ kind: "error", message: "Enter passphrase first." });
      return;
    }
    try {
      const bodyStr = atob(msg.bodyBase64);
      const plaintext = await decryptMsgBody(bodyStr, passphrase);
      setDecrypted((prev) => ({ ...prev, [msg.pda]: plaintext }));
      setStatus({ kind: "idle" });
    } catch (e) {
      setStatus({ kind: "error", message: "Decryption failed. Wrong passphrase?" });
    }
  }

  async function handleDelete(msg: InboxMessage): Promise<void> {
    if (!signer) return;
    setStatus({ kind: "submitting" });
    try {
      const pda = new PublicKey(msg.pda);
      const ix = buildDeleteMsgIx(pda, signer.publicKey);
      const tx = new Transaction();
      tx.add(ix);
      tx.feePayer = signer.publicKey;

      const bh = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = bh.blockhash;

      const signed = await signer.signTransaction(tx);
      const sig = await sendAndConfirm(connection, signed.serialize(), bh.lastValidBlockHeight);

      setMessages((prev) => prev.filter((m) => m.pda !== msg.pda));
      setStatus({ kind: "success", signature: sig });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setStatus({ kind: "error", message });
    }
  }

  if (!connected) {
    return (
      <Card>
        <p style={{ color: "var(--text-secondary)" }}>Connect your wallet to view your inbox.</p>
      </Card>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-end", marginBottom: "var(--space-6)" }}>
        <div style={{ flex: 1 }}>
          <Field label="Decryption passphrase">
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Shared passphrase to decrypt messages"
              style={inputStyle}
            />
          </Field>
        </div>
        <button
          onClick={fetchInbox}
          disabled={loading}
          style={{
            padding: "var(--space-3) var(--space-4)",
            borderRadius: "var(--radius-base)",
            border: "1px solid var(--border-subtle)",
            background: "var(--surface-0)",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: "0.875rem",
            color: "var(--text-primary)",
            marginBottom: "var(--space-4)",
          }}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>Loading inbox…</p>
      ) : error ? (
        <p style={{ color: "var(--danger)", fontSize: "0.875rem" }}>{error}</p>
      ) : messages.length === 0 ? (
        <Card>
          <p style={{ color: "var(--text-secondary)" }}>No messages found for your wallet.</p>
        </Card>
      ) : (
        messages.map((msg) => (
          <Card key={msg.pda} style={{ marginBottom: "var(--space-4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
              <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                From: {msg.from.slice(0, 4)}…{msg.from.slice(-4)}
              </span>
              <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                {new Date(msg.timestamp * 1000).toLocaleString()}
              </span>
            </div>
            {decrypted[msg.pda] ? (
              <div
                style={{
                  background: "var(--surface-2)",
                  padding: "var(--space-3)",
                  borderRadius: "var(--radius-base)",
                  fontSize: "0.9375rem",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  marginBottom: "var(--space-3)",
                }}
              >
                {decrypted[msg.pda]}
              </div>
            ) : (
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", fontStyle: "italic", marginBottom: "var(--space-3)" }}>
                Encrypted — enter passphrase above and click decrypt.
              </p>
            )}
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              {!decrypted[msg.pda] && (
                <SmallBtn label="Decrypt" onClick={() => void handleDecrypt(msg)} />
              )}
              <SmallBtn
                label="Delete"
                onClick={() => void handleDelete(msg)}
                danger
              />
            </div>
          </Card>
        ))
      )}
      <StatusLine status={status} />
    </div>
  );
}

function SmallBtn({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "var(--space-1) var(--space-3)",
        borderRadius: "var(--radius-base)",
        border: `1px solid ${danger ? "var(--danger)" : "var(--border-subtle)"}`,
        background: "transparent",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: "0.8125rem",
        color: danger ? "var(--danger)" : "var(--text-primary)",
      }}
    >
      {label}
    </button>
  );
}

function StatusLine({ status }: { status: Status }) {
  if (status.kind === "success") {
    return (
      <p style={{ marginTop: "var(--space-4)", color: "var(--success)", fontSize: "0.875rem", wordBreak: "break-all" }}>
        {status.signature ? (
          <>
            Tx submitted.{" "}
            <a href={explorerTxUrl(status.signature)} target="_blank" rel="noopener noreferrer"
               style={{ color: "var(--accent)", fontWeight: 500 }}>
              <code>{status.signature.slice(0, 8)}…{status.signature.slice(-8)}</code> ↗
            </a>
          </>
        ) : "Done."}
      </p>
    );
  }
  if (status.kind === "error") {
    return (
      <p style={{ marginTop: "var(--space-4)", color: "var(--danger)", fontSize: "0.875rem", wordBreak: "break-word" }}>
        {status.message}
      </p>
    );
  }
  return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: "var(--space-4)" }}>
      <span style={{ display: "block", fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "var(--space-1)" }}>
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

function PrimaryBtn({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick?: () => void }) {
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
