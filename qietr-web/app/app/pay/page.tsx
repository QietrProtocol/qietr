import { ConfiguredBanner } from "../../_components/ConfiguredBanner";
import { Card } from "../../_components/Card";
import { WalletBalance } from "../../_components/WalletBalance";
import { FaucetCallout } from "../deposit/FaucetCallout";
import { PayForms } from "./PayForms";

export default function PayPage() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "var(--space-12) var(--space-6)",
      }}
    >
      <h1 style={{ fontSize: "1.875rem", marginBottom: "var(--space-2)" }}>Pay</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-6)" }}>
        Direct payment to a Solana address, or any x402 endpoint.
      </p>

      <ConfiguredBanner
        configured={
          <>
            Connected to Solana <strong>devnet</strong> with a configured indexer
            and prover — payments submit for real and the zero-knowledge proof is
            generated in your browser. <strong>Not audited; uses a dev proving
            key.</strong> Use throwaway devnet USDC only — never real funds.
          </>
        }
        unconfigured={
          <>
            The pool program is live on Solana devnet. Both forms validate input
            and walk the UX; submitting a real payment needs a configured indexer
            and prover (run locally or use the SDK). Devnet only; not audited.
          </>
        }
      />

      <div style={{ height: "var(--space-6)" }} />

      <Card>
        <WalletBalance />
      </Card>

      <div style={{ height: "var(--space-6)" }} />

      <FaucetCallout />

      <div style={{ height: "var(--space-6)" }} />

      <PayForms />
    </main>
  );
}
