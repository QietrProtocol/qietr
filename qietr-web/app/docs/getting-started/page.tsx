import Link from "next/link";

const sidebarLinkStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  textDecoration: "none",
  fontSize: "0.9375rem",
  display: "block",
  padding: "var(--space-2) 0",
};

const activeSidebarLinkStyle: React.CSSProperties = {
  ...sidebarLinkStyle,
  color: "var(--text-primary)",
  fontWeight: 600,
};

export default function GettingStarted() {
  return (
    <main
      style={{
        maxWidth: 1120,
        margin: "0 auto",
        padding: "var(--space-12) var(--space-6)",
        display: "grid",
        gridTemplateColumns: "220px 1fr",
        gap: "var(--space-12)",
      }}
    >
      {/* Sidebar */}
      <nav style={{ position: "sticky", top: "var(--space-6)", alignSelf: "start" }}>
        <Link href="/docs/" style={{ ...sidebarLinkStyle, fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--space-4)" }}>
          &larr; Docs home
        </Link>
        <p style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: "var(--space-2)" }}>
          Getting started
        </p>
        <Link href="/docs/getting-started/" style={activeSidebarLinkStyle}>What is Qietr?</Link>
        <a href="/docs/getting-started/#how-to-use" style={sidebarLinkStyle}>How to use</a>
        <a href="/docs/getting-started/#use-cases" style={sidebarLinkStyle}>Use cases</a>
      </nav>

      {/* Content */}
      <div>
        <h1 style={{ fontSize: "1.875rem", marginBottom: "var(--space-3)" }}>What is Qietr?</h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-6)" }}>
          Qietr is a zero-knowledge privacy layer for HTTP 402 micropayments on Solana.
        </p>

        <h2 style={{ fontSize: "1.375rem", marginBottom: "var(--space-3)" }}>Understanding x402 and Qietr</h2>

        <h3 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>x402 &mdash; The HTTP 402 Payment Protocol</h3>
        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-4)" }}>
          Developed by Coinbase and Cloudflare, x402 is a standard for web micropayments.
          When an HTTP server responds with <code>402 Payment Required</code>, the client
          pays a specified amount and retries the request with a payment header.
        </p>

        <div
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-base)",
            padding: "var(--space-4) var(--space-6)",
            marginBottom: "var(--space-6)",
          }}
        >
          <p style={{ margin: "0 0 var(--space-2)", fontFamily: "var(--font-mono)", fontSize: "0.875rem" }}>
            <span style={{ color: "var(--text-secondary)" }}>// Standard x402 &mdash; Alice&apos;s wallet &rarr; Bob&apos;s address</span>
          </p>
          <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            {`// Everyone can see Alice paid Bob`}
          </p>
        </div>

        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-4)" }}>
          <strong>Problem:</strong> Every payment is tracked. Merchants can profile
          customers. Competitors can analyze usage. No financial privacy.
        </p>

        <h3 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>Qietr &mdash; Shielded Layer for x402</h3>
        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-4)" }}>
          Qietr adds zero-knowledge privacy to x402 payments. Funds go through a shielded
          pool, breaking the link between depositor and payer.
        </p>

        <div
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-base)",
            padding: "var(--space-4) var(--space-6)",
            marginBottom: "var(--space-6)",
          }}
        >
          <p style={{ margin: "0 0 var(--space-2)", fontFamily: "var(--font-mono)", fontSize: "0.875rem" }}>
            <span style={{ color: "var(--text-secondary)" }}>// Qietr &mdash; Shielded Pool &rarr; Bob&apos;s address</span>
          </p>
          <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            {`// Bob gets paid, can't identify who paid`}
          </p>
        </div>

        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-8)" }}>
          The sender proves eligibility via a ZK proof without revealing which deposit
          is theirs, their wallet address, or their transaction history.
        </p>

        <h2 id="how-to-use" style={{ fontSize: "1.375rem", marginBottom: "var(--space-3)" }}>
          How to use
        </h2>

        <h3 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>What you need</h3>
        <ul style={{ color: "var(--text-secondary)", lineHeight: 1.8, paddingLeft: "var(--space-6)", marginBottom: "var(--space-6)" }}>
          <li>Phantom, Solflare, or any Solana wallet</li>
          <li>USDC on Solana (devnet for testing)</li>
          <li>Small amount of SOL for gas</li>
        </ul>

        <h3 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>Step 1: Connect wallet</h3>
        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-4)" }}>
          Open the <a href="/app/">app</a> and connect your Solana wallet.
        </p>

        <h3 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>Step 2: Deposit</h3>
        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-2)" }}>
          Choose a fixed denomination tier: 0.1, 1, 10, or 100 USDC. Deposit into the
          shielded pool and save your encrypted note.
        </p>
        <div
          style={{
            background: "var(--surface-1)",
            borderLeft: "3px solid var(--warning)",
            borderRadius: "var(--radius-base)",
            padding: "var(--space-3) var(--space-4)",
            marginBottom: "var(--space-4)",
            fontSize: "0.9375rem",
          }}
        >
          <strong>IMPORTANT:</strong> Save your note file. If you lose it,
          your funds are unrecoverable. Never share your note with anyone.
        </div>

        <h3 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>Step 3: Pay</h3>
        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-4)" }}>
          Load your note, enter a recipient address (or x402 endpoint URL), choose
          an amount, and generate a zero-knowledge proof. The recipient receives USDC
          with no link to your deposit.
        </p>

        <h3 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>Deposit vs spending</h3>
        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-8)" }}>
          Deposits are in fixed denominations for better privacy (larger anonymity sets).
          Spending is flexible &mdash; pay any amount up to your balance, make multiple
          payments from one deposit.
        </p>

        <h2 id="use-cases" style={{ fontSize: "1.375rem", marginBottom: "var(--space-3)" }}>
          Use cases
        </h2>

        <div style={{ display: "grid", gap: "var(--space-6)", marginBottom: "var(--space-8)" }}>
          <div>
            <h3 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>AI agent payments</h3>
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>
              Autonomous agents pay for API access, compute, and subscriptions without
              revealing their identity or being tracked by competitors.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>Developer API usage</h3>
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>
              Pay for API calls without usage profiling. Protect business logic
              and prevent competitors from analyzing your usage patterns.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>Content access</h3>
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>
              Pay for articles, datasets, and premium content without user profiling
              or tracking across sites.
            </p>
          </div>
        </div>

        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-4)" }}>
          <a href="https://github.com/QietrProtocol">View on GitHub</a> &middot;{" "}
          <a href="https://x.com/QietrCom">@QietrCom</a>
        </p>
      </div>
    </main>
  );
}
