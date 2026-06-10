import { ActivityList } from "./ActivityList";

export default function ActivityPage() {
  return (
    <main
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "var(--space-12) var(--space-6)",
      }}
    >
      <h1 style={{ fontSize: "1.875rem", marginBottom: "var(--space-2)" }}>Activity</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-8)" }}>
        Local-only event log. Nothing is sent to a server. Cleared with your
        browser data, or with the Clear button below.
      </p>

      <ActivityList />
    </main>
  );
}
