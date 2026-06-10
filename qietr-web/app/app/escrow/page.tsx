import { Banner } from "../../_components/Banner";
import { Card } from "../../_components/Card";

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

      <Banner tone="warning">
        The qietr-escrow program is not deployed yet. This screen is
        UI-complete but cannot create real escrows until the program ships to
        devnet.
      </Banner>

      <div style={{ height: "var(--space-6)" }} />

      <Card>
        <h2 style={{ fontSize: "1.125rem", marginBottom: "var(--space-3)" }}>
          Job lifecycle
        </h2>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.875rem",
            lineHeight: 2,
            padding: "var(--space-4)",
            background: "var(--surface-2)",
            borderRadius: "var(--radius-base)",
          }}
        >
          Created &rarr; Accepted &rarr; Completed &rarr; Released
          <br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&darr;
          <br />
          &nbsp;&nbsp;&nbsp;&nbsp;Refunded
          <br />
          <br />
          Completed &rarr; Disputed
        </div>
      </Card>

      <div style={{ height: "var(--space-6)" }} />

      <Card>
        <h2 style={{ fontSize: "1.125rem", marginBottom: "var(--space-3)" }}>
          How it works
        </h2>
        <ol style={{ margin: 0, paddingLeft: "var(--space-6)", lineHeight: 1.8 }}>
          <li>
            <strong>Client creates a job.</strong> USDC is transferred into an
            escrow vault PDA. Price and terms are set.
          </li>
          <li>
            <strong>Agent accepts.</strong> The agent locks in by signing the
            accept instruction.
          </li>
          <li>
            <strong>Agent completes.</strong> Once the work is done, the agent
            marks the job complete.
          </li>
          <li>
            <strong>Client releases.</strong> After verifying the work, the
            client releases payment from escrow to the agent.
          </li>
          <li>
            <strong>Dispute.</strong> If the work is unsatisfactory, the
            client can flag a dispute.
          </li>
          <li>
            <strong>Refund.</strong> Before the agent accepts, the client can
            cancel and reclaim their funds.
          </li>
        </ol>
      </Card>

      <div style={{ height: "var(--space-6)" }} />

      <Card>
        <h2 style={{ fontSize: "1.125rem", marginBottom: "var(--space-3)" }}>
          Use cases
        </h2>
        <ul style={{ margin: 0, paddingLeft: "var(--space-6)", lineHeight: 1.8 }}>
          <li>Freelance payment with on-chain escrow</li>
          <li>Agent service marketplace integration</li>
          <li>AI agent-to-agent payments for completed tasks</li>
        </ul>
      </Card>
    </main>
  );
}
