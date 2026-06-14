"use client";

// =============================================================================
// CopyableCA — click-to-copy contract address with a transient "Copied!" popup.
//
// Renders the address as inline <code>. Clicking copies it to the clipboard and
// shows a small floating confirmation above the address for ~1.5s.
// =============================================================================

import { useState } from "react";

export function CopyableCA({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      // Fallback for non-secure contexts / older browsers.
      const el = document.createElement("textarea");
      el.value = address;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
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
          wordBreak: "break-all",
          cursor: "pointer",
          userSelect: "all",
        }}
      >
        {address}
      </code>
      <span
        aria-live="polite"
        style={{
          position: "absolute",
          left: "50%",
          bottom: "calc(100% + 6px)",
          transform: "translateX(-50%)",
          background: "var(--text-primary)",
          color: "var(--surface-1)",
          fontSize: "0.75rem",
          fontWeight: 600,
          padding: "2px 8px",
          borderRadius: "var(--radius-base)",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          opacity: copied ? 1 : 0,
          transition: "opacity 0.15s ease",
        }}
      >
        Copied!
      </span>
    </span>
  );
}
