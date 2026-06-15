import Link from "next/link";

const sidebarLinkStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  textDecoration: "none",
  fontSize: "0.9375rem",
  display: "block",
  padding: "var(--space-2) 0",
};

const activeSidebarLinkStyle: React.CSSProperties = {
  ...sidebarLinkStyle,
  color: "var(--text-primary)",
  fontWeight: 600,
};

export default function AppGuidePage() {
  return (
    <main
      style={{
        maxWidth: 1120,
        margin: "0 auto",
        padding: "var(--space-12) var(--space-6)",
        display: "grid",
        gridTemplateColumns: "220px 1fr",
        gap: "var(--space-12)",
      }}
    >
      {/* Sidebar */}
      <nav style={{ position: "sticky", top: "var(--space-6)", alignSelf: "start" }}>
        <Link
          href="/docs/"
          style={{ ...sidebarLinkStyle, fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--space-4)" }}
        >
          &larr; Docs home
        </Link>
        <p style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: "var(--space-2)" }}>
          App guide
        </p>
        <Link href="/docs/app-guide/" style={activeSidebarLinkStyle}>Overview</Link>
        <a href="/docs/app-guide/#deposit" style={sidebarLinkStyle}>Deposit</a>
        <a href="/docs/app-guide/#pay" style={sidebarLinkStyle}>Pay</a>
        <a href="/docs/app-guide/#note" style={sidebarLinkStyle}>Note Manager</a>
        <a href="/docs/app-guide/#messaging" style={sidebarLinkStyle}>Messaging</a>
        <a href="/docs/app-guide/#escrow" style={sidebarLinkStyle}>Escrow</a>
        <a href="/docs/app-guide/#activity" style={sidebarLinkStyle}>Activity</a>
        <a href="/docs/app-guide/#faucet" style={sidebarLinkStyle}>Test funds</a>
      </nav>

      {/* Content */}
      <div>
        <h1 style={{ fontSize: "1.875rem", marginBottom: "var(--space-3)" }}>App guide</h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-8)", maxWidth: "65ch" }}>
          Everything in the Qietr app, what it does, and how to use it.
        </p>

        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-4)" }}>
          The Qietr app runs on Solana devnet. You connect a Phantom or Solflare wallet,
          deposit USDC into a shielded pool, then spend privately using zero-knowledge
          proofs. No account signup, no email, no database. Your state lives in your
          wallet, your browser, and your note file.
        </p>

        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-6)" }}>
          Below is a walkthrough of every screen in <a href="/app/">/app</a>.
        </p>

        <div
          style={{
            background: "var(--surface-1)",
            borderLeft: "3px solid var(--accent)",
            borderRadius: "var(--radius-base)",
            padding: "var(--space-3) var(--space-4)",
            marginBottom: "var(--space-8)",
            fontSize: "0.9375rem",
          }}
        >
          <strong>Heads up:</strong> This is unaudited devnet software with a dev proving
          key. Use throwaway USDC only. Real funds will be lost or compromised.
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* DEPOSIT */}
        {/* ------------------------------------------------------------------ */}
        <h2 id="deposit" style={{ fontSize: "1.375rem", marginBottom: "var(--space-3)" }}>
          Deposit
        </h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-3)" }}>
          This is where you put money into the shielded pool. Pick a fixed tier — 0.1,
          1, 10, or 100 USDC — and your wallet signs an SPL transfer. The pool program
          records a commitment on-chain, and your browser stores the corresponding note
          locally.
        </p>

        <h3 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>What actually happens</h3>
        <ul style={{ color: "var(--text-secondary)", lineHeight: 1.8, paddingLeft: "var(--space-6)", marginBottom: "var(--space-4)" }}>
          <li>A random secret and nullifier are generated in your browser.</li>
          <li>The commitment (hash of secret + nullifier + tier) goes on-chain.</li>
          <li>You encrypt the note with a passphrase and download it as a <code>.qietr.note</code> file.</li>
        </ul>

        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-8)" }}>
          If you lose the note file or forget the passphrase, the money is gone.
          There is no recovery, no reset, no support ticket. The note is the only
          key to your deposit.
        </p>

        {/* ------------------------------------------------------------------ */}
        {/* PAY */}
        {/* ------------------------------------------------------------------ */}
        <h2 id="pay" style={{ fontSize: "1.375rem", marginBottom: "var(--space-3)" }}>
          Pay
        </h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-3)" }}>
          Two ways to spend from your shielded note:
        </p>

        <h3 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>Direct payment</h3>
        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-2)" }}>
          Enter a Solana address, an amount, and your note passphrase. The app
          generates a Groth16 ZK proof in your browser, submits it to the pool
          program, and the recipient gets USDC from the pool. The proof proves you
          own a deposit without revealing which one.
        </p>

        <h3 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>x402 endpoint</h3>
        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-3)" }}>
          Enter a URL that speaks the x402 protocol (HTTP 402 Payment Required).
          The app hits the URL, parses the 402 response, matches a denomination
          from your note, and retries with an <code>X-PAYMENT</code> header. The
          endpoint gets paid without knowing who you are.
        </p>

        <div
          style={{
            background: "var(--surface-1)",
            borderLeft: "3px solid var(--warning)",
            borderRadius: "var(--radius-base)",
            padding: "var(--space-3) var(--space-4)",
            marginBottom: "var(--space-8)",
            fontSize: "0.9375rem",
          }}
        >
          Partial spends create a &ldquo;change&rdquo; commitment on-chain that is
          linked to the spend. If privacy matters, spend whole denominations or
          re-deposit the change.
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* NOTE MANAGER */}
        {/* ------------------------------------------------------------------ */}
        <h2 id="note" style={{ fontSize: "1.375rem", marginBottom: "var(--space-3)" }}>
          Note Manager
        </h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-3)" }}>
          Your encrypted notebook. A note is a JSON blob holding your commitments
          (deposits) and their metadata. It is encrypted with AES-256-GCM using a
          key derived from your passphrase via Argon2id. The encrypted blob sits in
          your browser&apos;s localStorage; the decrypted contents only exist in
          memory while the tab is open.
        </p>

        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-2)" }}>
          From here you can:
        </p>
        <ul style={{ color: "var(--text-secondary)", lineHeight: 1.8, paddingLeft: "var(--space-6)", marginBottom: "var(--space-4)" }}>
          <li><strong>Create</strong> a fresh empty note (pick a strong passphrase).</li>
          <li><strong>Unlock</strong> an existing note from localStorage.</li>
          <li><strong>Back up</strong> — download the encrypted blob as a <code>.qietr.note</code> file.</li>
          <li><strong>Restore</strong> — paste a backup file back in.</li>
          <li><strong>Clear</strong> — delete the encrypted blob from this device.</li>
        </ul>

        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-8)" }}>
          You should back up your note somewhere safe (external drive, password
          manager, wherever) before clearing your browser data. If the localStorage
          blob goes away and you have no backup, the commitments inside it become
          unspendable. The money is still in the pool, but nobody can withdraw it.
        </p>

        {/* ------------------------------------------------------------------ */}
        {/* MESSAGING */}
        {/* ------------------------------------------------------------------ */}
        <h2 id="messaging" style={{ fontSize: "1.375rem", marginBottom: "var(--space-3)" }}>
          Messaging
        </h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-3)" }}>
          On-chain encrypted messaging between wallets. Built on the <code>qietr-msg</code>{/* */}
          program. Messages are encrypted with AES-256-GCM before they leave your
          browser, and the ciphertext lives on Solana. Only the recipient can decrypt
          (with your shared passphrase).
        </p>

        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-2)" }}>
          Two tabs:
        </p>
        <ul style={{ color: "var(--text-secondary)", lineHeight: 1.8, paddingLeft: "var(--space-6)", marginBottom: "var(--space-4)" }}>
          <li><strong>Send message</strong> — enter a recipient address, a passphrase (shared out-of-band), and your message body. The app encrypts it, builds a Solana instruction, and you sign it with your wallet.</li>
          <li><strong>Inbox</strong> — pulls messages sent to your wallet address from the Solana program. Enter the shared passphrase to decrypt each one. You can also delete messages from the chain.</li>
        </ul>

        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-8)" }}>
          The passphrase is never stored. If the other person loses it, the message
          is permanently unreadable. Max body size is 1024 bytes.
        </p>

        {/* ------------------------------------------------------------------ */}
        {/* ESCROW */}
        {/* ------------------------------------------------------------------ */}
        <h2 id="escrow" style={{ fontSize: "1.375rem", marginBottom: "var(--space-3)" }}>
          Escrow
        </h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-3)" }}>
          Trust-minimized escrow for agent commerce. Built on the <code>qietr-escrow</code>{/* */}
          program. The lifecycle goes: Create &rarr; Accept &rarr; Complete &rarr; Release.
          If something goes wrong, the client can dispute, and either party can
          escalate.
        </p>

        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-2)" }}>
          Two tabs:
        </p>
        <ul style={{ color: "var(--text-secondary)", lineHeight: 1.8, paddingLeft: "var(--space-6)", marginBottom: "var(--space-4)" }}>
          <li><strong>Create job</strong> — enter an agent&apos;s address and the USDC amount. USDC is transferred from your wallet into the escrow vault on creation. The agent can then accept the job.</li>
          <li><strong>My jobs</strong> — lists all escrow jobs tied to your wallet. Depending on the state and your role, you can accept, complete, release payment, dispute, cancel, or close a job.</li>
        </ul>

        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-8)" }}>
          States: Created &rarr; Accepted &rarr; Completed &rarr; Released (happy path).
          Or: Created &rarr; Cancel (client backs out), Disputed &rarr; Refund (client
          wins dispute) or Release (agent wins). Once released or refunded, anyone can
          close the job account to reclaim rent.
        </p>

        {/* ------------------------------------------------------------------ */}
        {/* ACTIVITY */}
        {/* ------------------------------------------------------------------ */}
        <h2 id="activity" style={{ fontSize: "1.375rem", marginBottom: "var(--space-3)" }}>
          Activity
        </h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-3)" }}>
          A local event log stored in your browser. Tracks deposits, payments, backups,
          restores, and clears with timestamps and status. Nothing is sent to a server.
          Cleared when you clear browser data, or when you hit the &ldquo;Clear&rdquo;
          button on the activity page.
        </p>

        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-8)" }}>
          Useful for keeping track of what you did during a session without having to
          dig through Solana Explorer links.
        </p>

        {/* ------------------------------------------------------------------ */}
        {/* FAUCET */}
        {/* ------------------------------------------------------------------ */}
        <h2 id="faucet" style={{ fontSize: "1.375rem", marginBottom: "var(--space-3)" }}>
          Devnet test funds
        </h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-3)" }}>
          The app runs on devnet. To use it you need two things:
        </p>
        <ol style={{ color: "var(--text-secondary)", lineHeight: 1.8, paddingLeft: "var(--space-6)", marginBottom: "var(--space-4)" }}>
          <li><strong>USDC-Dev</strong> from Circle&apos;s faucet at{" "}
            <a href="https://faucet.circle.com">faucet.circle.com</a> — choose
            Solana Devnet, paste your wallet address, claim. The pool only accepts
            the Circle devnet mint: <code>4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU</code>.
          </li>
          <li><strong>SOL</strong> from the{" "}
            <a href="https://faucet.solana.com">Solana faucet</a> for transaction fees.
            You only need a little.
          </li>
        </ol>
        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-8)" }}>
          If you claim USDC from a different faucet and the deposit fails, the mint
          doesn&apos;t match. Use Circle&apos;s faucet. You can claim repeatedly.
        </p>

        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-4)", marginTop: "var(--space-12)" }}>
          <a href="https://github.com/QietrProtocol">View on GitHub</a> &middot;{" "}
          <a href="https://x.com/QietrCom">@QietrCom</a>
        </p>
      </div>
    </main>
  );
}
