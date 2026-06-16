import Link from "next/link";
import { Card } from "./_components/Card";

const sectionStyle: React.CSSProperties = {
  marginBottom: "var(--space-16)",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "1.875rem",
  marginBottom: "var(--space-3)",
};

const sectionSubtitleStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: "1.125rem",
  margin: "0 0 var(--space-8)",
  maxWidth: "60ch",
};

const codeBlockStyle: React.CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-base)",
  padding: "var(--space-4) var(--space-6)",
  fontFamily: "var(--font-mono)",
  fontSize: "0.875rem",
  lineHeight: 1.7,
  overflowX: "auto",
  whiteSpace: "pre",
  margin: 0,
};

const stepStyle: React.CSSProperties = {
  display: "flex",
  gap: "var(--space-4)",
  alignItems: "flex-start",
};

const stepNumberStyle: React.CSSProperties = {
  background: "var(--accent)",
  color: "var(--text-inverse)",
  width: 28,
  height: 28,
  borderRadius: "var(--radius-pill)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  fontSize: "0.875rem",
  flexShrink: 0,
  marginTop: 2,
};

type RoadmapStatus = "shipped" | "in-progress" | "planned";

interface RoadmapPhase {
  phase: string;
  title: string;
  status: RoadmapStatus;
  items: string[];
}

const ROADMAP: RoadmapPhase[] = [
  {
    phase: "Phase 1",
    title: "Devnet protocol",
    status: "shipped",
    items: [
      "Shielded pool with Groth16 zk-SNARK withdrawals",
      "Deposit, pay, and x402 flows live on Solana devnet",
      "Encrypted notes, agent messaging, and job escrow",
      "Open-source SDK and hosted web app",
    ],
  },
  {
    phase: "Phase 2",
    title: "Hardening",
    status: "in-progress",
    items: [
      "Ongoing bug fixes and protocol stabilization",
      "Expanded documentation and developer guides",
      "Load and stress testing across the payment path",
      "Agent framework compatibility and integrations",
      "Trusted-setup ceremony for a production proving key",
      "Third-party security audit of the on-chain program",
      "Relayer network for gasless, unlinkable withdrawals",
      "Published npm package for the SDK",
    ],
  },
  {
    phase: "Phase 3",
    title: "Mainnet",
    status: "planned",
    items: [
      "Mainnet-beta launch with audited contracts",
      "Real-USDC shielded payments",
      "Cross-chain deposits and settlement",
      "Agent integrations and partner endpoints",
    ],
  },
];

function StatusBadge({ status }: { status: RoadmapStatus }) {
  const config: Record<RoadmapStatus, { label: string; color: string; bg: string }> = {
    shipped: { label: "Shipped", color: "var(--success)", bg: "color-mix(in srgb, var(--success) 14%, transparent)" },
    "in-progress": { label: "In progress", color: "var(--accent)", bg: "color-mix(in srgb, var(--accent) 14%, transparent)" },
    planned: { label: "Planned", color: "var(--text-secondary)", bg: "var(--surface-2)" },
  };
  const c = config[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-1)",
        fontSize: "0.75rem",
        fontWeight: 600,
        color: c.color,
        background: c.bg,
        borderRadius: "var(--radius-pill)",
        padding: "2px 10px",
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "currentColor",
          display: "inline-block",
        }}
      />
      {c.label}
    </span>
  );
}

export default function HomePage() {
  return (
    <main
      style={{
        maxWidth: 1120,
        margin: "0 auto",
        padding: "var(--space-16) var(--space-6)",
      }}
    >
      {/* Hero */}
      <section style={{ ...sectionStyle, maxWidth: 800 }}>
        <h1 style={{ fontSize: "2.5rem", lineHeight: 1.1, marginBottom: "var(--space-4)" }}>
          Private payments for the agent economy.
        </h1>
        <p
          style={{
            fontSize: "1.125rem",
            color: "var(--text-secondary)",
            maxWidth: "60ch",
            margin: "0 0 var(--space-6)",
          }}
        >
          A zero-knowledge privacy layer for HTTP 402 (x402) micropayments on
          Solana. AI agents pay any endpoint in USDC by proving they own a
          deposit &mdash; without revealing identity, history, or balance.
          Open source, open standards.
        </p>
        <div style={{ display: "flex", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
          <Link
            href="/app/"
            style={{
              background: "var(--accent)",
              color: "var(--text-inverse)",
              padding: "var(--space-3) var(--space-6)",
              borderRadius: "var(--radius-base)",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Open app
          </Link>
          <Link
            href="/docs/"
            style={{
              border: "1px solid var(--border-strong)",
              color: "var(--text-primary)",
              padding: "var(--space-3) var(--space-6)",
              borderRadius: "var(--radius-base)",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Read docs
          </Link>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: 0 }}>
          Live on Solana devnet &middot; not yet audited &middot; not on mainnet.
        </p>
      </section>

      {/* Privacy in one line — code comparison */}
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Privacy in one line</h2>
        <p style={sectionSubtitleStyle}>
          Same API. Same simplicity. Complete privacy.
        </p>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "var(--space-6)",
        }}>
          <div>
            <p style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "var(--space-2)" }}>
              Standard &mdash; x402 &mdash; Exposed
            </p>
            <div style={codeBlockStyle}>
{`const payment = await x402.pay({
  amount: 100,
  recipient: merchant,
  // Payment history linkable
  // Browsing patterns exposed
})`}
            </div>
          </div>
          <div>
            <p style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "var(--space-2)" }}>
              Private &mdash; Qietr &mdash; Shielded
            </p>
            <div style={codeBlockStyle}>
{`import { QietrSDK } from '@qietr/sdk'

const payment = await sdk.pay({
  to: merchant,
  amount: 100,
  // Unlinkable credentials
  // Zero-knowledge proofs
})`}
            </div>
          </div>
        </div>
        <p style={{ marginTop: "var(--space-4)", fontSize: "0.9375rem" }}>
          <code style={{ background: "var(--surface-1)", padding: "2px 6px", borderRadius: 4 }}>$ git clone github.com/QietrProtocol/qietr &amp;&amp; cd qietr-sdk</code>
          <span style={{ marginLeft: "var(--space-2)", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>npm package coming soon</span>
        </p>
      </section>

      {/* Our Products */}
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Our Products</h2>
        <p style={sectionSubtitleStyle}>
          Privacy-preserving infrastructure for the agent economy.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "var(--space-6)",
          }}
        >
          <Card>
            <h3 style={{ fontSize: "1.125rem", marginBottom: "var(--space-3)" }}>
              Shielded Payments
            </h3>
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>
              Unlinkable USDC payments for AI agents over the x402 rail. A
              Groth16 zk-SNARK proves a deposit is yours without revealing
              which one. The core protocol.
            </p>
          </Card>
          <Card>
            <h3 style={{ fontSize: "1.125rem", marginBottom: "var(--space-3)" }}>
              Agent Messaging
            </h3>
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>
              Encrypted on-chain messaging for autonomous agents, built on the
              same primitives. Live on devnet alongside the pool.
            </p>
          </Card>
          <Card>
            <h3 style={{ fontSize: "1.125rem", marginBottom: "var(--space-3)" }}>
              Job Escrow
            </h3>
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>
              Trust-minimized escrow for agent commerce, with an on-chain
              dispute and refund lifecycle. Live on devnet.
            </p>
          </Card>
        </div>
      </section>

      {/* How it works */}
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>How Shielded Payments Work</h2>
        <p style={sectionSubtitleStyle}>
          Three steps to private payments on Solana.
        </p>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "var(--space-8)",
        }}>
          <div style={stepStyle}>
            <div style={stepNumberStyle}>1</div>
            <div>
              <h3 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>
                Deposit fixed amounts
              </h3>
              <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.9375rem" }}>
                Choose a denomination tier (0.1, 1, 10, 100 USDC) and deposit into the
                shielded pool. Receive an encrypted note as your proof of deposit.
              </p>
            </div>
          </div>
          <div style={stepStyle}>
            <div style={stepNumberStyle}>2</div>
            <div>
              <h3 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>
                Spend any amount, any time
              </h3>
              <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.9375rem" }}>
                One note can pay many endpoints. Generate a zero-knowledge proof to
                spend without revealing which deposit is yours. Change stays shielded.
              </p>
            </div>
          </div>
          <div style={stepStyle}>
            <div style={stepNumberStyle}>3</div>
            <div>
              <h3 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>
                Recipients see only USDC
              </h3>
              <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.9375rem" }}>
                A fresh burner wallet settles every payment. The merchant gets paid
                in USDC with no link to your deposit address or identity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Use cases grid */}
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>What private payments unlock</h2>
        <p style={sectionSubtitleStyle}>
          One shielded pool, many use cases. Every payment below settles in
          USDC with no link back to the payer.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "var(--space-6)",
          }}
        >
          <Card>
            <h3 style={{ fontSize: "1rem", marginBottom: "var(--space-2)" }}>
              Paid APIs &amp; tools
            </h3>
            <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.875rem" }}>
              Agents pay per-call for APIs and tools without creating a
              linkable trail of which endpoints they use.
            </p>
          </Card>
          <Card>
            <h3 style={{ fontSize: "1rem", marginBottom: "var(--space-2)" }}>
              Metered data &amp; content
            </h3>
            <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.875rem" }}>
              Pay-per-request access to data feeds and content behind an x402
              paywall, without exposing query patterns.
            </p>
          </Card>
          <Card>
            <h3 style={{ fontSize: "1rem", marginBottom: "var(--space-2)" }}>
              Compute &amp; inference
            </h3>
            <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.875rem" }}>
              Buy compute and model inference by the unit, unlinked from the
              wallet funding the workload.
            </p>
          </Card>
          <Card>
            <h3 style={{ fontSize: "1rem", marginBottom: "var(--space-2)" }}>
              Agent-to-agent commerce
            </h3>
            <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.875rem" }}>
              Settle jobs between agents through escrow, with encrypted
              messaging on the same primitives.
            </p>
          </Card>
        </div>
      </section>

      {/* Roadmap */}
      <section id="roadmap" style={{ ...sectionStyle, scrollMarginTop: "var(--space-8)" }}>
        <h2 style={sectionTitleStyle}>Roadmap</h2>
        <p style={sectionSubtitleStyle}>
          Where Qietr is today, and the path to a production-ready private
          payment rail.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "var(--space-6)",
          }}
        >
          {ROADMAP.map((phase) => (
            <Card key={phase.title}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--space-3)",
                  marginBottom: "var(--space-4)",
                }}
              >
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "var(--text-secondary)",
                  }}
                >
                  {phase.phase}
                </span>
                <StatusBadge status={phase.status} />
              </div>
              <h3 style={{ fontSize: "1.125rem", marginBottom: "var(--space-3)" }}>
                {phase.title}
              </h3>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "var(--space-5)",
                  color: "var(--text-secondary)",
                  fontSize: "0.875rem",
                  lineHeight: 1.7,
                }}
              >
                {phase.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-base)",
          padding: "var(--space-12) var(--space-8)",
          textAlign: "center",
        }}
      >
        <h2 style={{ fontSize: "1.5rem", marginBottom: "var(--space-4)" }}>
          Join the privacy revolution
        </h2>
        <p
          style={{
            color: "var(--text-secondary)",
            marginBottom: "var(--space-6)",
            maxWidth: "50ch",
            margin: "0 auto var(--space-6)",
          }}
        >
          Open protocols, open source. Build privacy-first AI agents with Qietr infrastructure.
        </p>
        <div style={{ display: "flex", gap: "var(--space-4)", justifyContent: "center" }}>
          <Link
            href="/app/"
            style={{
              background: "var(--accent)",
              color: "var(--text-inverse)",
              padding: "var(--space-3) var(--space-6)",
              borderRadius: "var(--radius-base)",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Open app
          </Link>
          <a
            href="https://github.com/QietrProtocol"
            style={{
              border: "1px solid var(--border-strong)",
              color: "var(--text-primary)",
              padding: "var(--space-3) var(--space-6)",
              borderRadius: "var(--radius-base)",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            View on GitHub
          </a>
        </div>
      </section>
    </main>
  );
}
