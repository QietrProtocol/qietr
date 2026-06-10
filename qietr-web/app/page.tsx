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
          Zero-knowledge privacy layer for HTTP 402 micropayments on Solana.
          Pay any endpoint in USDC without revealing identity. Open source, open standards.
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
          Built on Solana. Open source. Audit before mainnet.
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
          <code style={{ background: "var(--surface-1)", padding: "2px 6px", borderRadius: 4 }}>$ npm install @qietr/sdk</code>
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
              Unlinkable USDC payments for AI agents that keep browsing patterns
              confidential while staying compliant. Our first product.
            </p>
          </Card>
          <Card>
            <h3 style={{ fontSize: "1.125rem", marginBottom: "var(--space-3)" }}>
              Agent Messaging
            </h3>
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>
              Encrypted on-chain messaging for autonomous agents. Coming after
              shielded payments reach mainnet.
            </p>
          </Card>
          <Card>
            <h3 style={{ fontSize: "1.125rem", marginBottom: "var(--space-3)" }}>
              Open Source
            </h3>
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>
              All Qietr protocols are open source. Built by the community,
              for the community. MIT license.
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

      {/* Features grid */}
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Privacy for every agent interaction</h2>
        <p style={sectionSubtitleStyle}>
          Protecting agent privacy across payments, data, and beyond.
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
              Private Payments
            </h3>
            <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.875rem" }}>
              Agents pay for services without revealing browsing patterns or
              creating linkable payment trails.
            </p>
          </Card>
          <Card>
            <h3 style={{ fontSize: "1rem", marginBottom: "var(--space-2)" }}>
              Confidential API Access
            </h3>
            <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.875rem" }}>
              Access sensitive data and APIs while protecting query patterns
              and usage behavior from profiling.
            </p>
          </Card>
          <Card>
            <h3 style={{ fontSize: "1rem", marginBottom: "var(--space-2)" }}>
              Anonymous Compute
            </h3>
            <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.875rem" }}>
              Purchase compute resources without revealing workload types
              or model architectures.
            </p>
          </Card>
          <Card>
            <h3 style={{ fontSize: "1rem", marginBottom: "var(--space-2)" }}>
              Privacy-First Infrastructure
            </h3>
            <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.875rem" }}>
              Building the foundation for agent privacy across every
              interaction type on Solana.
            </p>
          </Card>
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
