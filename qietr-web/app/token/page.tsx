"use client";

import { CopyableCA } from "../_components/CopyableCA";

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
          fontFamily: "var(--font-mono)",
          wordBreak: "break-all",
        }}
      >
        <CopyableCA address="MXDRgSQstTKBMunuF2VmcnBejpbidECL5vtCAb6pump" />
      </div>
      <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-8)" }}>
        Protocol token of the Qietr network. Fee-driven buyback &amp; burn,
        governance, and fee discounts.
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
              <td style={tdStyle}>96.6%</td>
              <td style={tdStyle}>966,000,000</td>
              <td style={tdStyle}>Open to buy. No investor, no insider allocation.</td>
            </tr>
            <tr>
              <td style={{ ...tdStyle, fontWeight: 500 }}>Locked</td>
              <td style={tdStyle}>3.4%</td>
              <td style={tdStyle}>34,000,000</td>
              <td style={tdStyle}>Team allocation, locked.</td>
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
              <td style={{ ...tdStyle, fontWeight: 500 }}>Locked (team)</td>
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
          <h3 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>Buyback &amp; burn</h3>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>
            100% of protocol fees are used to buy back $QIET from the open market
            and burn it, permanently reducing supply. Fees range from 0.10% to
            5.00% (set by governance, 1.00% default). Every fee tightens supply for
            all holders.
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
        <p style={{ margin: 0, fontSize: "0.9375rem", wordBreak: "break-all" }}>
          <strong>Contract address:</strong>{" "}
          <CopyableCA address="MXDRgSQstTKBMunuF2VmcnBejpbidECL5vtCAb6pump" />
        </p>
      </div>

      <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-4)" }}>
        $QIET is not a security or investment contract. Protocol fees buy back
        and burn supply. No price chart. No countdown. No allocation drama.
      </p>
    </main>
  );
}
