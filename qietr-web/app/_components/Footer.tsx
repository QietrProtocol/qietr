import Link from "next/link";

const linkStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  textDecoration: "none",
  fontSize: "0.875rem",
};

export function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border-subtle)",
        marginTop: "var(--space-16)",
        padding: "var(--space-8) var(--space-6)",
        maxWidth: 1120,
        margin: "var(--space-16) auto 0",
        display: "flex",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "var(--space-4)",
      }}
    >
      <span style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
        © 2026 Qietr Protocol. Open source under MIT License.
      </span>
      <div style={{ display: "flex", gap: "var(--space-6)" }}>
        <a href="https://github.com/QietrProtocol" style={linkStyle}>GitHub</a>
        <a href="https://x.com/QietrOfficial" style={linkStyle}>X</a>
        <Link href="/docs/" style={linkStyle}>Docs</Link>
        <Link href="/security/" style={linkStyle}>Security</Link>
        <Link href="/brand/" style={linkStyle}>Brand</Link>
      </div>
    </footer>
  );
}
