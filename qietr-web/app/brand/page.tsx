export default function BrandPage() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "var(--space-12) var(--space-6)",
      }}
    >
      <h1 style={{ fontSize: "1.875rem", marginBottom: "var(--space-6)" }}>Brand</h1>
      <p>
        Name: <strong>Qietr</strong> (pronounced "kwite-er").
        <br />
        Token ticker: <code>$QIET</code>.
        <br />
        Wordmark: Inter Tight 600, black on white.
      </p>
      <p style={{ marginTop: "var(--space-6)" }}>
        Press inquiries: <a href="mailto:press@qietr.com">press@qietr.com</a>.
      </p>
    </main>
  );
}
