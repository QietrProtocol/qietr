export default function SecurityPage() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "var(--space-12) var(--space-6)",
      }}
    >
      <h1 style={{ fontSize: "1.875rem", marginBottom: "var(--space-3)" }}>Security</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-8)" }}>
        Qietr ships under audit. No mainnet deploy without a clean review.
      </p>

      <h2 style={{ fontSize: "1.375rem", marginBottom: "var(--space-4)" }}>Audit status</h2>
      <div
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-base)",
          padding: "var(--space-4) var(--space-6)",
          marginBottom: "var(--space-8)",
        }}
      >
        <p style={{ margin: 0 }}>
          <span style={{ color: "var(--warning)", fontWeight: 600 }}>In progress.</span>{" "}
          At least one Anchor firm and one circuit specialist review before mainnet.
          Reports published here when complete.
        </p>
      </div>

      <h2 style={{ fontSize: "1.375rem", marginBottom: "var(--space-4)" }}>Trusted setup</h2>
      <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-4)" }}>
        Multi-party ceremony with published contributions. Single-party setup
        acceptable only on devnet and local development.
      </p>
      <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-8)" }}>
        The verifying key upgrade path includes a 48-hour time-lock, providing
        protection against admin compromise.
      </p>

      <h2 style={{ fontSize: "1.375rem", marginBottom: "var(--space-4)" }}>Bug bounty</h2>
      <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-8)" }}>
        Terms publish after audits land. Disclosure:{" "}
        <a href="mailto:security@qietr.com">security@qietr.com</a>.
      </p>

      <h2 style={{ fontSize: "1.375rem", marginBottom: "var(--space-4)" }}>Sanctions screening</h2>
      <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-8)" }}>
        The relayer includes OFAC sanctions screening at the transaction relay
        layer. The shielded pool itself is permissionless and non-custodial.
      </p>

      <h2 style={{ fontSize: "1.375rem", marginBottom: "var(--space-4)" }}>User responsibilities</h2>
      <ul style={{ color: "var(--text-secondary)", lineHeight: 1.8, paddingLeft: "var(--space-6)" }}>
        <li>Secure your note file. If lost, funds are unrecoverable.</li>
        <li>Never share your note with anyone.</li>
        <li>Use a dedicated deposit wallet for privacy best practices.</li>
      </ul>
    </main>
  );
}
