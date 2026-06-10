# Backend Schema — Qietr

**Version:** 0.1 (spec phase)
**Scope:** On-chain account layouts plus off-chain indexer, relayer, and prover service schemas.

---

## 1. On-chain accounts (Anchor / Borsh layouts)

All `Pubkey` fields are 32 bytes. All `[u8; 32]` field elements are big-endian. All amounts are micro-USDC (`u64`, 6 decimals).

### 1.1 `PoolConfig`

PDA seeds: `["config"]`

```rust
#[account]
pub struct PoolConfig {
    pub version: u8,                  // schema version, starts at 1
    pub admin: Pubkey,                // multisig in production
    pub fee_recipient: Pubkey,        // SPL token account that receives deposit fees
    pub fee_bps: u16,                 // 0..=500 (max 5%)
    pub paused: bool,                 // emergency stop
    pub verifying_key_hash: [u8; 32], // sha256 of canonical VK bytes
    pub denomination_count: u8,
    pub _padding: [u8; 32],           // reserved for upgrades
}
```

Total: ≈ 110 bytes + Anchor discriminator.

### 1.2 `Denomination`

PDA seeds: `["denom", denom_id_u8]`

```rust
#[account]
pub struct Denomination {
    pub denom_id: u8,
    pub amount_micro_usdc: u64,       // tier value, e.g. 10_000_000 for 10 USDC
    pub vault: Pubkey,                // SPL token account PDA holding pooled USDC
    pub merkle_tree: Pubkey,          // MerkleTree PDA
    pub deposit_count: u64,           // running counter for UX/anonymity-set telemetry
    pub spend_count: u64,
    pub active: bool,                 // can be paused individually
    pub _padding: [u8; 32],
}
```

### 1.3 `MerkleTree`

PDA seeds: `["tree", denom_id_u8]`

```rust
#[account]
pub struct MerkleTree {
    pub denom_id: u8,
    pub depth: u8,                    // fixed at 20
    pub next_leaf_index: u64,
    pub current_root: [u8; 32],
    pub root_history: [[u8; 32]; 30], // ring buffer
    pub root_history_head: u8,        // next slot to overwrite
    pub filled_subtrees: [[u8; 32]; 20], // incremental Merkle state
    pub _padding: [u8; 64],
}
```

Total: ≈ 1700 bytes. This account is reallocated once at init; it does not grow.

### 1.4 `NullifierRecord`

PDA seeds: `["nullifier", denom_id_u8, nullifier_hash_bytes]`

```rust
#[account]
pub struct NullifierRecord {
    pub denom_id: u8,
    pub nullifier_hash: [u8; 32],
    pub spent_slot: u64,              // Solana slot at which it was spent
    pub _padding: [u8; 8],
}
```

Existence of the PDA is the spent flag. Created during `withdraw`. Rent-exempt minimum ≈ 0.001 SOL — paid by the withdrawer's relayer.

### 1.5 Events emitted

```rust
#[event] pub struct Deposit {
    pub denom_id: u8,
    pub commitment: [u8; 32],
    pub leaf_index: u64,
    pub new_root: [u8; 32],
    pub slot: u64,
}

#[event] pub struct Withdraw {
    pub denom_id: u8,
    pub nullifier_hash: [u8; 32],
    pub recipient: Pubkey,
    pub payment_amount: u64,
    pub change_commitment: [u8; 32],
    pub new_root: [u8; 32],
    pub slot: u64,
}

#[event] pub struct PoolPaused { pub paused: bool, pub slot: u64 }
```

These events are the indexer's primary input.

## 2. Off-chain indexer (Postgres)

Postgres 15+. All hash/pubkey columns are stored as `bytea` (32 bytes) for compactness and queried via `\x...` literals.

### 2.1 `commitments`

```sql
CREATE TABLE commitments (
    denom_id        SMALLINT      NOT NULL,
    leaf_index      BIGINT        NOT NULL,
    commitment      BYTEA         NOT NULL,
    deposit_slot    BIGINT        NOT NULL,
    deposit_tx_sig  TEXT          NOT NULL,
    inserted_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    PRIMARY KEY (denom_id, leaf_index)
);
CREATE UNIQUE INDEX commitments_denom_value_idx ON commitments (denom_id, commitment);
CREATE INDEX commitments_slot_idx ON commitments (deposit_slot);
```

### 2.2 `roots`

```sql
CREATE TABLE roots (
    denom_id      SMALLINT     NOT NULL,
    root          BYTEA        NOT NULL,
    leaf_count    BIGINT       NOT NULL,
    set_at_slot   BIGINT       NOT NULL,
    PRIMARY KEY (denom_id, root)
);
CREATE INDEX roots_denom_slot_idx ON roots (denom_id, set_at_slot DESC);
```

### 2.3 `nullifiers`

```sql
CREATE TABLE nullifiers (
    denom_id          SMALLINT    NOT NULL,
    nullifier_hash    BYTEA       NOT NULL,
    spent_slot        BIGINT      NOT NULL,
    withdraw_tx_sig   TEXT        NOT NULL,
    payment_amount    BIGINT      NOT NULL,
    PRIMARY KEY (denom_id, nullifier_hash)
);
```

### 2.4 `denomination_stats` (materialized view)

```sql
CREATE MATERIALIZED VIEW denomination_stats AS
SELECT
    d.denom_id,
    d.amount_micro_usdc,
    COUNT(DISTINCT c.leaf_index)                            AS total_deposits,
    COUNT(DISTINCT c.leaf_index) - COALESCE(n.spent_ct, 0)  AS active_anonymity_set,
    MAX(c.deposit_slot)                                     AS last_deposit_slot
FROM denominations d
LEFT JOIN commitments c ON c.denom_id = d.denom_id
LEFT JOIN (
    SELECT denom_id, COUNT(*) AS spent_ct
    FROM nullifiers
    GROUP BY denom_id
) n ON n.denom_id = d.denom_id
GROUP BY d.denom_id, d.amount_micro_usdc, n.spent_ct;
```

Refreshed every 30 seconds.

### 2.5 `ingestion_cursor`

```sql
CREATE TABLE ingestion_cursor (
    id              INT          PRIMARY KEY DEFAULT 1,
    last_slot       BIGINT       NOT NULL,
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CHECK (id = 1)
);
```

Single-row table tracking how far the Geyser consumer has processed.

## 3. Indexer HTTP API

Base URL: `https://api.qietr.com`

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/denominations` | List of tiers with stats |
| GET | `/v1/merkle-proof?denomId=X&commitment=hex` | Path + indices + recent roots |
| GET | `/v1/nullifier-status?denomId=X&nullifierHash=hex` | Spent / unspent |
| GET | `/v1/roots/recent?denomId=X&limit=30` | Recent root window |
| GET | `/v1/health` | Cursor lag in slots |

### Response shapes

```json
// GET /v1/denominations
{
  "denominations": [
    {
      "denomId": 0,
      "amountMicroUsdc": 100000,
      "totalDeposits": 1247,
      "activeAnonymitySet": 982,
      "lastDepositSlot": 320451123
    }
  ]
}
```

```json
// GET /v1/merkle-proof
{
  "root": "0x...",
  "leafIndex": 8421,
  "pathElements": ["0x...", "..."],
  "pathIndices": [0, 1, 1, 0, "..."],
  "recentRoots": ["0x...", "..."]
}
```

```json
// GET /v1/nullifier-status
{ "spent": false, "spentSlot": null }
```

Errors: standard `4xx`/`5xx` with JSON `{ "error": "code", "message": "..." }`.

## 4. Relayer service

Kora-compatible API. Self-hosted Kora instance plus a thin wrapper for rate limits and abuse mitigation.

### 4.1 `POST /v1/relay/withdraw`

Request:

```json
{
  "transaction": "<base64-encoded versioned tx, fully signed except fee payer>",
  "denomId": 0
}
```

Response:

```json
{ "signature": "<tx signature>", "slot": 320451200 }
```

Errors:

| Code | Reason |
|------|--------|
| `RATE_LIMITED` | Per-IP or per-burner limit hit |
| `INVALID_TX` | Tx does not target the pool program |
| `RECIPIENT_BLOCKED` | Recipient is on the sanctions screening list (relayer-level only; chain pool does not enforce) |
| `INSUFFICIENT_FEE_BUDGET` | Relayer daily SOL budget exhausted |

### 4.2 `POST /v1/relay/deposit`

For `deposit_with_authorization` flows. Same shape as withdraw.

### 4.3 Rate-limiting model

- 5 withdrawals per IP per minute, anonymous.
- 100 withdrawals per IP per day, anonymous.
- Higher tiers gated by free self-serve API key tied to email (no KYC).
- Burner pubkey may appear at most once per 60s across all relayer accounts to deter spam.

## 5. Prover service (optional fallback)

For agents that cannot run Groth16 in-process (low-memory environments).

### 5.1 `POST /v1/prove`

Request:

```json
{
  "denomId": 0,
  "witness": "<base64 hex of circuit private + public inputs>",
  "challenge": "<server-issued nonce>"
}
```

Response: Groth16 proof + public signals.

Privacy caveat: using this service reveals the proof inputs (including secret, nullifier, and recipient) to the operator. This is documented in the SDK and the UI must show a clear warning before fallback.

## 6. Web app backend

Minimal. The hosted UI is a Next.js app deployed as a static export (`output: "export"`) to Cloudflare Pages, with no proprietary backend beyond the indexer and relayer above. No accounts, no analytics that identify users, no server-side note storage. If a server runtime is later needed for a specific feature, that feature is added as a Cloudflare Worker rather than expanding the SPA.

Optional anonymized telemetry:
- Aggregated deposit / withdraw counts per tier (already public on-chain; we mirror to a dashboard).
- Client-side errors POSTed to Sentry with PII scrubbing rules forcing redaction of any field named `secret`, `nullifier`, `privateKey`, `note`, `seed`, `mnemonic`.

## 7. Storage migrations

Schema changes are managed via numbered SQL migration files committed to `services/indexer/migrations/`. Each migration is forward-only. Rollback is "restore from snapshot" — there are no down-migrations, because the indexer is a derived store and can be rebuilt from on-chain data.

## 8. Backup and disaster recovery

- **On-chain state** is the source of truth and is not backed up by us (it lives on Solana).
- **Indexer Postgres**: nightly snapshot retained 30 days. RPO 24 hours, RTO 4 hours.
- **Relayer key**: fee-payer keypair held in a cloud KMS with quorum access; rotated quarterly.
- **Verifying keys**: committed to the public repo and on-chain. Reproducible from the trusted setup transcript.

## 9. Sensitive data inventory

| Data | Location | Sensitivity | Notes |
|------|----------|-------------|-------|
| User secret / nullifier | User device only | Critical | Never transmitted to any Qietr service |
| Note (plaintext) | User device only | Critical | Encrypted at rest in browser via passphrase-derived key |
| Wallet pubkey | Indexer logs (deposit only) | Public on-chain | Not stored beyond what's already on-chain |
| Burner privkey | Held in SDK memory for ~one tx lifetime | Critical | Wiped after spend; never persisted |
| Relayer fee-payer key | KMS | Operational | Quorum access, audit logged |

The protocol's correctness does not depend on Qietr keeping any user data confidential — by design.
