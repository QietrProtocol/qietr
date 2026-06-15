import { MessagingManager } from "./MessagingManager";

export default function MessagingPage() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "var(--space-12) var(--space-6)",
      }}
    >
      <h1 style={{ fontSize: "1.875rem", marginBottom: "var(--space-2)" }}>
        Messaging
      </h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-6)" }}>
        Encrypted on-chain messaging between agents and humans.
      </p>

      <MessagingManager />
    </main>
  );
}
