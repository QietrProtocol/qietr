import { Banner } from "../../_components/Banner";
import { Card } from "../../_components/Card";
import { TierPicker } from "./TierPicker";

export default function DepositPage() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "var(--space-12) var(--space-6)",
      }}
    >
      <h1 style={{ fontSize: "1.875rem", marginBottom: "var(--space-2)" }}>Deposit</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-6)" }}>
        Step 1 of 3 — Choose denomination
      </p>

      <Banner tone="warning">
        The pool program is live on Solana devnet. This hosted UI is a preview
        and needs a configured indexer and prover to submit a real deposit — run
        it locally with those set, or use the SDK directly. Devnet only; not
        audited.
      </Banner>

      <div style={{ height: "var(--space-6)" }} />

      <Card>
        <TierPicker />
      </Card>

      <div style={{ height: "var(--space-6)" }} />

      <Card>
        <h2 style={{ fontSize: "1.125rem", marginBottom: "var(--space-3)" }}>What happens next</h2>
        <ol style={{ margin: 0, paddingLeft: "var(--space-6)", lineHeight: 1.8 }}>
          <li>
            <strong>Step 2.</strong> A fresh secret + nullifier are generated
            in your browser. The commitment is computed locally.
          </li>
          <li>
            <strong>Step 3.</strong> You confirm the encrypted note backup
            (passphrase + downloaded <code>.qietr.note</code>) before the
            on-chain deposit is signed.
          </li>
          <li>
            <strong>Step 4.</strong> Your wallet signs an SPL transfer for
            the tier amount; the on-chain program appends the commitment.
          </li>
        </ol>
      </Card>
    </main>
  );
}
