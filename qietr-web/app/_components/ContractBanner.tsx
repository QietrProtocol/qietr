"use client";

import { useState, useEffect } from "react";

const CA = "MXDRgSQstTKBMunuF2VmcnBejpbidECL5vtCAb6pump";

export function ContractBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(timer);
  }, []);

  if (dismissed || !visible) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(CA);
    } catch {
      const el = document.createElement("textarea");
      el.value = CA;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div
      style={{
        background: "var(--surface-1)",
        borderBottom: "1px solid var(--border-subtle)",
        padding: "var(--space-2) var(--space-6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-3)",
        fontSize: "0.8125rem",
        flexWrap: "wrap",
        position: "relative",
        animation: "slideDown 0.3s ease",
      }}
    >
      <span style={{ color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
        $QIET contract:
      </span>
      <code
        role="button"
        tabIndex={0}
        onClick={copy}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            copy();
          }
        }}
        title="Click to copy"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.75rem",
          cursor: "pointer",
          color: "var(--accent)",
          position: "relative",
          userSelect: "all",
        }}
      >
        {CA.slice(0, 8)}...{CA.slice(-8)}
        <span
          aria-live="polite"
          style={{
            position: "absolute",
            left: "50%",
            bottom: "calc(100% + 4px)",
            transform: "translateX(-50%)",
            background: "var(--text-primary)",
            color: "var(--surface-1)",
            fontSize: "0.6875rem",
            fontWeight: 600,
            padding: "2px 6px",
            borderRadius: "var(--radius-base)",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            opacity: copied ? 1 : 0,
            transition: "opacity 0.15s ease",
          }}
        >
          Copied!
        </span>
      </code>
      <span style={{ color: "var(--border-strong)" }}>|</span>
      <a
        href={`https://solscan.io/token/${CA}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: "var(--text-secondary)",
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
      >
        Solscan ↗
      </a>
      <a
        href={`https://dexscreener.com/solana/${CA}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: "var(--text-secondary)",
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
      >
        DexScreener ↗
      </a>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        style={{
          background: "none",
          border: "none",
          color: "var(--text-secondary)",
          cursor: "pointer",
          fontSize: "1.125rem",
          lineHeight: 1,
          padding: "0",
          position: "absolute",
          right: "var(--space-4)",
          top: "50%",
          transform: "translateY(-50%)",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
      >
        ✕
      </button>
    </div>
  );
}
