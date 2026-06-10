import { NoteManager } from "./NoteManager";

export default function NotePage() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "var(--space-12) var(--space-6)",
      }}
    >
      <h1 style={{ fontSize: "1.875rem", marginBottom: "var(--space-2)" }}>Note manager</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-8)" }}>
        Notes are AES-256-GCM encrypted with an Argon2id-derived key. The
        encrypted blob lives in this browser's local storage; the decrypted
        form lives only in memory while you have it unlocked.
      </p>

      <p style={{
        color: "var(--text-secondary)",
        fontSize: "0.875rem",
        marginBottom: "var(--space-8)",
        background: "var(--surface-2)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-base)",
        padding: "var(--space-3) var(--space-4)",
      }}>
        The on-chain pool is not deployed yet. You can create, back up, and
        restore notes today — the format is forward-compatible — but the
        commitments inside any note created right now are not spendable.
      </p>

      <NoteManager />
    </main>
  );
}
