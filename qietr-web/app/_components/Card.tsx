import type { ReactNode } from "react";

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-base)",
        padding: "var(--space-6)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
