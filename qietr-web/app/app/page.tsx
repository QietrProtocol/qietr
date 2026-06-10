import Link from "next/link";
import { Card } from "../_components/Card";

export default function AppHome() {
  return (
    <main
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "var(--space-12) var(--space-6)",
      }}
    >
      <h1 style={{ fontSize: "1.875rem", marginBottom: "var(--space-4)" }}>
        App
      </h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-12)" }}>
        No accounts. State lives in your wallet, this browser, and your note file.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "var(--space-6)",
        }}
      >
        <AppLink href="/app/deposit/" title="Deposit" body="Add USDC to a shielded tier." />
        <AppLink href="/app/pay/" title="Pay" body="Direct payment or x402 endpoint." />
        <AppLink href="/app/messaging/" title="Messaging" body="Encrypted on-chain agent messaging." />
        <AppLink href="/app/escrow/" title="Escrow" body="Trust-minimized agent commerce escrow." />
        <AppLink href="/app/note/" title="Note manager" body="Load, back up, restore." />
        <AppLink href="/app/activity/" title="Activity" body="Local history. Cleared with browser data." />
      </div>
    </main>
  );
}

function AppLink({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      <Card>
        <h2 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>{title}</h2>
        <p style={{ color: "var(--text-secondary)", margin: 0 }}>{body}</p>
      </Card>
    </Link>
  );
}
