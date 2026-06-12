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

export default function ProtocolPage() {
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
          Protocol
        </p>
        <Link href="/docs/protocol/" style={activeSidebarLinkStyle}>Architecture</Link>
        <a href="/docs/protocol/#circuits" style={sidebarLinkStyle}>Circuits</a>
        <a href="/docs/protocol/#contracts" style={sidebarLinkStyle}>Smart contracts</a>
        <a href="/docs/protocol/#sdk" style={sidebarLinkStyle}>SDK</a>
      </nav>

      {/* Content */}
      <div>
        <h1 style={{ fontSize: "1.875rem", marginBottom: "var(--space-3)" }}>Protocol architecture</h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-8)" }}>
          Qietr is built on three open primitives: x402, Groth16 zero-knowledge proofs,
          and Solana as the settlement layer.
        </p>

        <h2 style={{ fontSize: "1.375rem", marginBottom: "var(--space-3)" }}>Core architecture</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "var(--space-4)",
            marginBottom: "var(--space-8)",
          }}
        >
          <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-base)", padding: "var(--space-4)", textAlign: "center" }}>
            <p style={{ fontWeight: 600, marginBottom: "var(--space-1)" }}>Shielded Pool</p>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: 0 }}>
              Anchor program (Rust)
            </p>
          </div>
          <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-base)", padding: "var(--space-4)", textAlign: "center" }}>
            <p style={{ fontWeight: 600, marginBottom: "var(--space-1)" }}>ZK Circuit</p>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: 0 }}>
              Groth16 over BN254
            </p>
          </div>
          <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-base)", padding: "var(--space-4)", textAlign: "center" }}>
            <p style={{ fontWeight: 600, marginBottom: "var(--space-1)" }}>TypeScript SDK</p>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: 0 }}>
              <code>@qietr/sdk</code>
            </p>
          </div>
          <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-base)", padding: "var(--space-4)", textAlign: "center" }}>
            <p style={{ fontWeight: 600, marginBottom: "var(--space-1)" }}>Relayer</p>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: 0 }}>
              Gasless fee sponsorship
            </p>
          </div>
        </div>

        <h2 id="circuits" style={{ fontSize: "1.375rem", marginBottom: "var(--space-3)" }}>
          Zero-knowledge circuits
        </h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-4)" }}>
          Qietr uses a Groth16 proof system over the BN254 curve with Poseidon hashing.
          The circuit proves:
        </p>
        <ul style={{ color: "var(--text-secondary)", lineHeight: 1.8, paddingLeft: "var(--space-6)", marginBottom: "var(--space-4)" }}>
          <li>Commitment inclusion in the Merkle tree (depth 20)</li>
          <li>Nullifier correctness (no double-spends)</li>
          <li>Payment amount does not exceed commitment amount</li>
          <li>Change commitment correctness</li>
        </ul>
        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-8)" }}>
          Public signals: <code>[nullifierHash, root, recipient, paymentAmount, changeCommitment, amount]</code>.
          The <code>amount</code> signal is a Qietr-specific security fix that prevents
          amount inflation attacks by binding the payment to its denomination tier.
        </p>

        <h2 id="contracts" style={{ fontSize: "1.375rem", marginBottom: "var(--space-3)" }}>
          Smart contracts
        </h2>
        <div style={{ overflowX: "auto", marginBottom: "var(--space-8)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9375rem" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border-subtle)", fontWeight: 600 }}>Program</th>
                <th style={{ textAlign: "left", padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border-subtle)", fontWeight: 600 }}>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)", fontSize: "0.875rem" }}>qietr-pool</td>
                <td style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>Shielded pool: deposit, withdraw, denomination management</td>
              </tr>
              <tr>
                <td style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)", fontSize: "0.875rem" }}>qietr-escrow</td>
                <td style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>Trust-minimized agent commerce escrow</td>
              </tr>
              <tr>
                <td style={{ padding: "var(--space-3) var(--space-4)", fontFamily: "var(--font-mono)", fontSize: "0.875rem" }}>qietr-msg</td>
                <td style={{ padding: "var(--space-3) var(--space-4)", color: "var(--text-secondary)" }}>Encrypted on-chain agent messaging</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 id="sdk" style={{ fontSize: "1.375rem", marginBottom: "var(--space-3)" }}>
          TypeScript SDK
        </h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-4)" }}>
          The <code>@qietr/sdk</code> package provides:
        </p>
        <ul style={{ color: "var(--text-secondary)", lineHeight: 1.8, paddingLeft: "var(--space-6)", marginBottom: "var(--space-4)" }}>
          <li><code>QietrSDK</code> &mdash; main client class</li>
          <li><code>wrapFetch</code> &mdash; transparent x402 payment handling</li>
          <li><code>Note</code> &mdash; encrypted note management</li>
          <li><code>MerkleTree</code> &mdash; Merkle proof generation</li>
          <li><code>Prover</code> &mdash; browser-based ZK proof generation</li>
        </ul>
        <div
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-base)",
            padding: "var(--space-4) var(--space-6)",
            marginBottom: "var(--space-8)",
          }}
        >
          <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "0.875rem" }}>
            <span style={{ color: "var(--text-secondary)" }}>$ </span>git clone github.com/QietrProtocol/qietr
          </p>
          <p style={{ margin: "var(--space-2) 0 0", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
            Build from <code>qietr-sdk/</code>. The npm package <code>@qietr/sdk</code> is not published yet.
          </p>
        </div>

        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-4)" }}>
          Full SDK reference: <a href="https://github.com/QietrProtocol/qietr/tree/main/qietr-sdk">github.com/QietrProtocol/qietr</a>
        </p>
      </div>
    </main>
  );
}
