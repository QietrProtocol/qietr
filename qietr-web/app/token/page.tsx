const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "0.9375rem",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "var(--space-3) var(--space-4)",
  borderBottom: "1px solid var(--border-subtle)",
  fontWeight: 600,
  fontFamily: "var(--font-display)",
};

const tdStyle: React.CSSProperties = {
  padding: "var(--space-3) var(--space-4)",
  borderBottom: "1px solid var(--border-subtle)",
  color: "var(--text-secondary)",
};

export default function TokenPage() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "var(--space-12) var(--space-6)",
      }}
    >
      <h1 style={{ fontSize: "1.875rem", marginBottom: "var(--space-3)" }}>
        $QIET Token
      </h1>
      <div
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-base)",
          padding: "var(--space-3) var(--space-4)",
          marginBottom: "var(--space-6)",
          fontSize: "0.9375rem",
        }}
      >
        <strong>Not minted yet.</strong>{" "}
        <span style={{ color: "var(--text-secondary)" }}>
          $QIET does not exist on any chain today. The design below is the
          published plan &mdash; all numbers are provisional until the token
          generation event. Beware of impostor tokens.
        </span>
      </div>
      <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-8)" }}>
        Planned protocol token of the Qietr network. Revenue share, governance,
        and fee discounts. Final numbers decided before token generation event.
      </p>

      {/* Supply */}
      <h2 style={{ fontSize: "1.375rem", marginBottom: "var(--space-4)" }}>Supply</h2>
      <div style={{ display: "grid", gap: "var(--space-3)", marginBottom: "var(--space-8)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "var(--space-3) 0", borderBottom: "1px solid var(--border-subtle)" }}>
          <span style={{ color: "var(--text-secondary)" }}>Total supply</span>
          <span style={{ fontWeight: 600 }}>1,000,000,000 $QIET</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "var(--space-3) 0", borderBottom: "1px solid var(--border-subtle)" }}>
          <span style={{ color: "var(--text-secondary)" }}>Decimals</span>
          <span>9 (SPL standard)</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "var(--space-3) 0", borderBottom: "1px solid var(--border-subtle)" }}>
          <span style={{ color: "var(--text-secondary)" }}>Mint authority</span>
          <span><code>null</code> (fixed supply)</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "var(--space-3) 0", borderBottom: "1px solid var(--border-subtle)" }}>
          <span style={{ color: "var(--text-secondary)" }}>Freeze authority</span>
          <span><code>null</code></span>
        </div>
      </div>

      {/* Allocation */}
      <h2 style={{ fontSize: "1.375rem", marginBottom: "var(--space-4)" }}>Allocation</h2>
      <div style={{ overflowX: "auto", marginBottom: "var(--space-8)" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Bucket</th>
              <th style={thStyle}>Percent</th>
              <th style={thStyle}>Tokens</th>
              <th style={thStyle}>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...tdStyle, fontWeight: 500 }}>Public</td>
              <td style={tdStyle}>90%</td>
              <td style={tdStyle}>900,000,000</td>
              <td style={tdStyle}>Open to buy. No investor, no insider allocation.</td>
            </tr>
            <tr>
              <td style={{ ...tdStyle, fontWeight: 500 }}>Team</td>
              <td style={tdStyle}>10%</td>
              <td style={tdStyle}>100,000,000</td>
              <td style={tdStyle}>Vested</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Vesting */}
      <h2 style={{ fontSize: "1.375rem", marginBottom: "var(--space-4)" }}>Vesting schedule</h2>
      <div style={{ overflowX: "auto", marginBottom: "var(--space-8)" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Bucket</th>
              <th style={thStyle}>Cliff</th>
              <th style={thStyle}>Linear vest</th>
              <th style={thStyle}>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...tdStyle, fontWeight: 500 }}>Team</td>
              <td style={tdStyle}>12 months</td>
              <td style={tdStyle}>24 months</td>
              <td style={tdStyle}>36 months</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Utility */}
      <h2 style={{ fontSize: "1.375rem", marginBottom: "var(--space-4)" }}>Utility</h2>
      <div style={{ display: "grid", gap: "var(--space-6)", marginBottom: "var(--space-8)" }}>
        <div>
          <h3 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>Revenue share</h3>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>
            100% of deposit fees flow to $QIET holders. Fees range from 0.10% to
            5.00% (set by governance, 1.00% default). Claim per epoch via the
            RevenueDistributor program. Unclaimed share rolls forward.
          </p>
        </div>
        <div>
          <h3 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>Governance</h3>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>
            Vote on fee rates, denomination additions, circuit upgrades (time-locked),
            treasury disbursements, and emission mechanics. Governance via SPL
            Governance (Realms) at launch.
          </p>
        </div>
        <div>
          <h3 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>Fee discounts</h3>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>
            Stake $QIET for tiered deposit fee discounts: Tier 1 (25%), Tier 2 (50%),
            Tier 3 (75%). Discount applies only to the staker&rsquo;s own deposits.
          </p>
        </div>
      </div>

      {/* Contract */}
      <div
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-base)",
          padding: "var(--space-4) var(--space-6)",
          marginBottom: "var(--space-8)",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.9375rem" }}>
          <strong>Contract address:</strong>{" "}
          <span style={{ color: "var(--text-secondary)" }}>
            TBD before token generation event.
          </span>
        </p>
      </div>

      <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-4)" }}>
        $QIET is not a security or investment contract. Holders earn protocol
        fees by holding. No price chart. No countdown. No allocation drama.
      </p>
    </main>
  );
}
