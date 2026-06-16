import { ConfiguredBanner } from "../../_components/ConfiguredBanner";
import { Card } from "../../_components/Card";
import { WalletBalance } from "../../_components/WalletBalance";
import { FaucetCallout } from "../deposit/FaucetCallout";
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
        encrypted blob lives in this browser&apos;s local storage; the decrypted
        form lives only in memory while you have it unlocked.
      </p>

      <ConfiguredBanner
        configured={
          <>
            The pool program is live on Solana <strong>devnet</strong> with a
            configured indexer and prover, so you can create, back up, restore,
            and <strong>spend</strong> the commitments inside your notes from this
            build. Devnet only; not audited.
          </>
        }
        unconfigured={
          <>
            The pool program is live on Solana devnet. You can create, back up,
            and restore notes here; spending the commitments inside them requires
            a configured indexer and prover (SDK or local build). Devnet only.
          </>
        }
      />

      <div style={{ height: "var(--space-6)" }} />

      <Card>
        <WalletBalance />
      </Card>

      <div style={{ height: "var(--space-6)" }} />

      <FaucetCallout />

      <div style={{ height: "var(--space-8)" }} />

      <NoteManager />
    </main>
  );
}
