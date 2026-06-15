"use client";

import { useState, useEffect } from "react";
import { CopyableCA } from "./CopyableCA";

export function ContractBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(timer);
  }, []);

  if (dismissed || !visible) return null;

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
      <span style={{ color: "var(--text-secondary)" }}>
        $QIET token: <CopyableCA address="MXDRgSQstTKBMunuF2VmcnBejpbidECL5vtCAb6pump" />
      </span>
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
