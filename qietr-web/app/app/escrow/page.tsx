import { FaucetCallout } from "../deposit/FaucetCallout";
import { EscrowManager } from "./EscrowManager";

export default function EscrowPage() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "var(--space-12) var(--space-6)",
      }}
    >
      <h1 style={{ fontSize: "1.875rem", marginBottom: "var(--space-2)" }}>
        Escrow
      </h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-6)" }}>
        Trust-minimized payments between clients and agents.
      </p>

      <FaucetCallout />

      <div style={{ height: "var(--space-6)" }} />

      <EscrowManager />
    </main>
  );
}
