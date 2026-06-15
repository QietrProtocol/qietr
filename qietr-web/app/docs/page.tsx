import Link from "next/link";
import { Card } from "../_components/Card";

export default function DocsHome() {
  return (
    <main
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "var(--space-12) var(--space-6)",
      }}
    >
      <h1 style={{ fontSize: "1.875rem", marginBottom: "var(--space-3)" }}>
        Documentation
      </h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-8)", maxWidth: "60ch" }}>
        Privacy-first infrastructure for AI agents. Qietr enables shielded USDC
        payments on Solana with native HTTP 402 support.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "var(--space-6)",
        }}
      >
        <Link href="/docs/getting-started/" style={{ textDecoration: "none", color: "inherit" }}>
          <Card>
            <h2 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>Getting started</h2>
            <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.9375rem" }}>
              What is Qietr? How to deposit, pay, and integrate the SDK.
            </p>
          </Card>
        </Link>
        <Link href="/docs/app-guide/" style={{ textDecoration: "none", color: "inherit" }}>
          <Card>
            <h2 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>App guide</h2>
            <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.9375rem" }}>
              Walkthrough of every feature: deposit, pay, note manager, messaging, escrow.
            </p>
          </Card>
        </Link>
        <Link href="/docs/protocol/" style={{ textDecoration: "none", color: "inherit" }}>
          <Card>
            <h2 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>Protocol</h2>
            <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.9375rem" }}>
              Architecture, circuits, smart contracts, and security model.
            </p>
          </Card>
        </Link>
        <Link href="/token/" style={{ textDecoration: "none", color: "inherit" }}>
          <Card>
            <h2 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>$QIET token</h2>
            <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.9375rem" }}>
              Token overview, supply, utility, and governance.
            </p>
          </Card>
        </Link>
        <a href="https://github.com/QietrProtocol" style={{ textDecoration: "none", color: "inherit" }}>
          <Card>
            <h2 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>SDK reference</h2>
            <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.9375rem" }}>
              <code>@qietr/sdk</code> &mdash; TypeScript SDK for Node and browser.
            </p>
          </Card>
        </a>
      </div>

      <h2 style={{ fontSize: "1.375rem", marginTop: "var(--space-12)", marginBottom: "var(--space-4)" }}>
        Quick links
      </h2>
      <div style={{ display: "grid", gap: "var(--space-4)" }}>
        <div>
          <p style={{ margin: "0 0 var(--space-1)" }}>
            <strong>App:</strong>{" "}
            <a href="/app/">/app</a> <span style={{ color: "var(--text-secondary)" }}>(devnet)</span>
          </p>
          <p style={{ margin: "0 0 var(--space-1)" }}>
            <strong>GitHub:</strong>{" "}
            <a href="https://github.com/QietrProtocol">github.com/QietrProtocol</a>
          </p>
          <p style={{ margin: 0 }}>
            <strong>Twitter:</strong>{" "}
            <a href="https://x.com/QietrCom">@QietrCom</a>
          </p>
        </div>
      </div>
    </main>
  );
}
