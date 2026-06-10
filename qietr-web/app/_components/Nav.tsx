import Link from "next/link";
import { ConnectButton } from "./ConnectButton";

const linkStyle: React.CSSProperties = {
  color: "var(--text-primary)",
  textDecoration: "none",
  fontSize: "0.9375rem",
};

export function Nav() {
  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "var(--space-4) var(--space-6)",
        borderBottom: "1px solid var(--border-subtle)",
        maxWidth: 1120,
        margin: "0 auto",
        gap: "var(--space-4)",
      }}
    >
      <Link
        href="/"
        style={{
          ...linkStyle,
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: "1.125rem",
        }}
      >
        Qietr
      </Link>
      <div style={{ display: "flex", gap: "var(--space-6)", alignItems: "center" }}>
        <Link href="/app/" style={linkStyle}>App</Link>
        <Link href="/docs/" style={linkStyle}>Docs</Link>
        <Link href="/token/" style={linkStyle}>Token</Link>
        <Link href="/security/" style={linkStyle}>Security</Link>
        <Link href="/brand/" style={linkStyle}>Brand</Link>
        <ConnectButton />
      </div>
    </nav>
  );
}
