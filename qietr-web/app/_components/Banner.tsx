import type { ReactNode } from "react";

export function Banner({
  tone = "info",
  children,
}: {
  tone?: "info" | "warning";
  children: ReactNode;
}) {
  const isWarn = tone === "warning";
  return (
    <div
      style={{
        background: isWarn ? "var(--surface-2)" : "var(--surface-1)",
        border: `1px solid ${isWarn ? "var(--warning)" : "var(--border-subtle)"}`,
        borderLeftWidth: 3,
        borderLeftColor: isWarn ? "var(--warning)" : "var(--border-strong)",
        borderRadius: "var(--radius-base)",
        padding: "var(--space-3) var(--space-4)",
        color: "var(--text-primary)",
        fontSize: "0.9375rem",
      }}
    >
      {children}
    </div>
  );
}
