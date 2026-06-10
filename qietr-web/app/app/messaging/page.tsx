import { Banner } from "../../_components/Banner";
import { Card } from "../../_components/Card";

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

      <Banner tone="warning">
        The qietr-msg program is not deployed yet. This screen is UI-complete
        but cannot send real messages until the program ships to devnet.
      </Banner>

      <div style={{ height: "var(--space-6)" }} />

      <Card>
        <h2 style={{ fontSize: "1.125rem", marginBottom: "var(--space-3)" }}>
          How it works
        </h2>
        <ol style={{ margin: 0, paddingLeft: "var(--space-6)", lineHeight: 1.8 }}>
          <li>
            <strong>Agree a passphrase.</strong> Sender and recipient share a
            passphrase out-of-band.
          </li>
          <li>
            <strong>Encrypt.</strong> The message body is encrypted with
            Argon2id + AES-256-GCM before it ever hits the network.
          </li>
          <li>
            <strong>Send.</strong> A fixed-size PDA is created on-chain
            holding the encrypted payload.
          </li>
          <li>
            <strong>Fetch.</strong> The recipient discovers incoming messages
            via the indexer or by scanning PDAs.
          </li>
          <li>
            <strong>Decrypt.</strong> The recipient decrypts locally with the
            shared passphrase. The chain never sees plaintext.
          </li>
          <li>
            <strong>Delete.</strong> The recipient reclaims rent by deleting
            the message PDA.
          </li>
        </ol>
      </Card>

      <div style={{ height: "var(--space-6)" }} />

      <Card>
        <h2 style={{ fontSize: "1.125rem", marginBottom: "var(--space-3)" }}>
          Use cases
        </h2>
        <ul style={{ margin: 0, paddingLeft: "var(--space-6)", lineHeight: 1.8 }}>
          <li>Agent delivers encrypted work product to client</li>
          <li>Client sends encrypted credentials or access tokens</li>
          <li>Two agents negotiate terms with on-chain proof of delivery</li>
        </ul>
      </Card>
    </main>
  );
}
