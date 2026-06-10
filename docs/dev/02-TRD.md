# TRD — Qietr

**Version:** 0.2 (spec phase; §4 public-signal amendment)
**Status:** Draft for internal review
**Scope:** Phase 1 single-chain Solana MVP

**Changelog**

- 0.2 (2026-06-08) — `amount` moved from circuit private input to public signal #5; on-chain verifier now asserts it equals `Denomination.amount_micro_usdc`. Closes a tier-binding hole where a depositor could embed a large `amount` in a commitment under a small tier and later withdraw the inflated value. Affected sections: §2 (public-signal order), §4.1, §4.2, §4.3.
- 0.1 — initial draft.

---

## 1. System overview

```
+--------------------+        +-----------------------+        +-----------------------+
|   User / Agent     |        |   Qietr Web / SDK     |        |   Solana Mainnet      |
|                    |        |                       |        |                       |
|  Wallet + Note     |  HTTP  |  - Note manager       |  RPC   |  - Pool program       |
|  storage           +------->+  - ZK prover (WASM)   +------->+  - SPL USDC (mint)    |
|                    |        |  - x402 wrapFetch     |        |  - Memo program       |
+--------------------+        +-----------+-----------+        +-----------+-----------+
                                          |                                |
                                          | submitTx (fee-payer sponsored) |
                                          v                                v
                              +-----------------------+        +-----------------------+
                              |   Relayer / Fee-Payer |        |   Indexer (off-chain) |
                              |   (Kora / custom)     |        |   Postgres + Geyser   |
                              +-----------------------+        +-----------+-----------+
                                                                            |
                                                                            v
                                                                +-----------------------+
                                                                |   Merkle service      |
                                                                |   (proof builder)     |
                                                                +-----------------------+
```

Components, top to bottom:

1. **Pool program (Anchor).** On-chain shielded pool. Holds USDC, validates deposits, accepts ZK-proven withdrawals, tracks the commitment Merkle tree, and maintains a spent-nullifier set.
2. **SDK (TypeScript).** Wallet integration, note storage, witness generation, proof generation, x402 `wrapFetch`, and Solana tx construction.
3. **Relayer / fee-payer.** Sponsors the SOL fee on the withdrawal transaction so the burner pubkey never needs SOL. Kora (open source) is the default; a custom service may follow.
4. **Indexer.** Streams pool program events from a Geyser plugin into Postgres. Serves Merkle proofs to the SDK.
5. **Web app.** Hosted UI at `qietr.com` for deposit / pay / note management.

## 2. Cryptographic primitives

| Primitive | Choice | Rationale |
|-----------|--------|-----------|
| Curve | BN254 (alt-bn128) | Native Solana syscall support; circuits port directly from EVM-style designs. |
| Hash (commitment) | Poseidon-3 over BN254 | Cheap inside the circuit, available as a syscall on Solana. |
| Hash (Merkle) | Poseidon-2 over BN254 | Same reasoning. |
| Proof system | Groth16 | `groth16-solana` provides on-chain verification using `sol_alt_bn128_*`. Trusted setup is per-circuit and a one-time ceremony. |
| Commitment scheme | `commitment = Poseidon3(secret, nullifier, amount)` | Standard UTXO pattern; `(secret, nullifier)` are user-held randomness. |
| Nullifier | `nullifierHash = Poseidon1(nullifier)` | Revealed at spend time, recorded on-chain to prevent double-spend. |

### Field sizes and encoding

- Field elements are 254-bit, encoded on-chain as `[u8; 32]` big-endian.
- Amounts are 64-bit unsigned integers in micro-USDC (6 decimals).
- Public signals are ordered: `[nullifierHash, root, recipient, paymentAmount, changeCommitment, amount]`. Index 5 (`amount`) is asserted on-chain to equal the tier's `amount_micro_usdc` so a proof cannot be reused across denominations.

## 3. On-chain program design

### 3.1 Programs

| Program | Purpose |
|---------|---------|
| `qietr_pool` | Shielded pool: deposit, withdraw, Merkle tree, nullifier set, fee distribution |
| `qietr_verifier` (internal module) | Thin wrapper around `groth16-solana` configured with the deposit/withdraw circuit's verifying key |

### 3.2 Accounts (PDAs)

| Account | Seeds | Purpose |
|---------|-------|---------|
| `PoolConfig` | `["config"]` | Admin, fee bps, paused flag, current verifying key hash |
| `Denomination` | `["denom", denom_id_u8]` | Per-tier state: USDC vault PDA, deposit count, Merkle root |
| `MerkleTree` | `["tree", denom_id_u8]` | Fixed-depth (e.g. 20) Merkle tree root history (last 30 roots) and next leaf index |
| `NullifierRecord` | `["nullifier", denom_id_u8, nullifier_hash]` | Existence-as-storage; created at spend, prevents replay |
| `Vault` (Token PDA) | `["vault", denom_id_u8]` | SPL USDC token account holding pooled funds |

### 3.3 Instructions

- `initialize_pool(admin, fee_bps)` — one-time.
- `initialize_denomination(denom_id, amount_micro_usdc)` — admin gated.
- `deposit(denom_id, commitment_bytes32)` — transfers USDC from signer to vault, appends commitment, updates Merkle root.
- `deposit_with_authorization(...)` — same as `deposit` but consumes a pre-signed SPL transfer (x402-svm-style) so the user does not submit the tx themselves. Allows gasless deposits when paired with a fee-payer.
- `withdraw(denom_id, proof, public_signals)` — verifies Groth16 proof against the current verifying key, asserts the root is in the recent-roots window, marks the nullifier spent, transfers `paymentAmount` to `recipient`, and appends `changeCommitment` to the tree.
- `set_paused(bool)` — admin only.
- `update_verifying_key(vk_bytes)` — admin gated, time-locked, used only for circuit upgrades.

### 3.4 Merkle tree

- Depth 20 (≈ 1M leaves per denomination, sufficient for years of activity).
- Root history window: 30 most recent roots. Withdraw is valid against any root in the window. This lets a user generate a proof against root `R`, race a few other deposits before broadcasting, and still succeed without regenerating.
- Tree append on deposit is computed off-chain (witnesses included in the deposit ix) and verified on-chain via a simple cumulative hash check, **not** by recomputing all sibling hashes from scratch. This keeps deposit compute units low.

### 3.5 Compute-unit budget

- Withdraw is the expensive path. Target budget:
  - Groth16 verification (one pairing check via `sol_alt_bn128_pairing`): ~200k CU.
  - Poseidon hashing of public inputs to one field element: ~30k CU.
  - Account read/writes and SPL transfer: ~50k CU.
  - Total target: under 400k CU, leaving headroom under the 1.4M ceiling.

## 4. Circuit design (`qietr_payment.circom`)

### 4.1 Private inputs

- `secret`, `nullifier` — user-held randomness for the spent commitment.
- `newSecret`, `newNullifier` — randomness for the change commitment.
- `pathElements[20]`, `pathIndices[20]` — Merkle inclusion witness for the spent commitment.

### 4.2 Public inputs

Ordered to match the on-chain `public_signals` layout (`[u8; 32]` big-endian field elements):

| Index | Name | Description |
|-------|------|-------------|
| 0 | `nullifierHash` | `Poseidon1(nullifier)`. |
| 1 | `root` | Merkle root the witness was built against. |
| 2 | `recipient` | Burner pubkey hash — address USDC is sent to. SDK and on-chain helper both mask the top 3 bits to keep the value under the BN254 scalar modulus. |
| 3 | `paymentAmount` | Micro-USDC released to `recipient` this spend. |
| 4 | `changeCommitment` | `Poseidon3(newSecret, newNullifier, amount - paymentAmount)`. |
| 5 | `amount` | Denomination value (micro-USDC). On-chain verifier asserts this equals `Denomination.amount_micro_usdc`, binding the proof to the tier. |

### 4.3 Constraints

1. `commitment = Poseidon3(secret, nullifier, amount)` matches the leaf at `pathIndices` under `pathElements` with computed root equal to `root`.
2. `nullifierHash = Poseidon1(nullifier)`.
3. `paymentAmount > 0`.
4. `paymentAmount <= amount`.
5. `changeCommitment = Poseidon3(newSecret, newNullifier, amount - paymentAmount)`.
6. `amount` is exposed as public signal #5. The circuit itself does not bind `amount` to any tier — on-chain `withdraw` asserts `public_signals[5] == Denomination.amount_micro_usdc`. This lets one ceremony cover every tier while keeping cross-tier proofs unforgeable.

### 4.4 Trusted setup

- One Powers-of-Tau MPC ceremony per tier (or shared across tiers if the circuit parameterizes amount). Contributors enumerated on launch.
- Verifying key per tier committed in `Denomination`.

## 5. Payment flow (x402-svm)

### 5.1 Standard x402 SVM (for reference)

The Coinbase-hosted x402 facilitator on Solana accepts pre-signed SPL transfer transactions. The server returns `402 Payment Required` with `accepts: [...]`. The client signs an SPL transfer message; the facilitator (or a relayer) submits it with a fee-payer.

### 5.2 Qietr payment flow

1. SDK calls the endpoint. Server returns `402` with payment requirements.
2. SDK selects the smallest matching denomination tier from the loaded note.
3. SDK generates a fresh burner keypair (no SOL, no history).
4. SDK builds the witness for one commitment in the note, then runs Groth16 prover (WASM in browser, native in Node).
5. SDK submits `withdraw` tx with `recipient = burner.pubkey` and `paymentAmount = price`. Fee-payer signs the SOL fee. USDC lands in burner's associated token account.
6. SDK constructs a pre-signed SPL transfer from burner → merchant for exactly `price`. The fee-payer for *that* transfer can be either the merchant's facilitator or our relayer.
7. SDK encodes the x402 `X-PAYMENT` header (base64 JSON of the signed transfer) and retries the original HTTP request.
8. Merchant's facilitator submits the burner-signed transfer. Merchant receives USDC. Burner is discarded.
9. SDK stores the new note (the change commitment is now spendable; the old commitment's nullifier is consumed).

The merchant sees: a one-time burner pubkey transferring exactly the requested amount. No link to the depositor.

## 6. SDK API (target shape)

```ts
import { QietrSDK } from "@qietr/sdk";

const sdk = new QietrSDK({
  cluster: "mainnet-beta",
  relayerUrl: "https://relay.qietr.com",     // optional, defaults to a hosted relayer
  proverPath: "https://prover.qietr.com",    // wasm + zkey CDN
});

// Deposit
const note = await sdk.deposit({
  amount: 10,                                 // USDC
  payer: walletAdapter,                       // signs the SPL transfer
});

// x402-wrapped fetch
sdk.setNote(note);
const f = sdk.wrapFetch(fetch);
const res = await f("https://api.example.com/v1/expensive-endpoint", {
  method: "POST",
  body: JSON.stringify({ q: "..." }),
});
const updatedNote = sdk.getUpdatedNote();

// Direct payment
const result = await sdk.pay({
  to: merchantPubkey,
  amount: 0.25,
});
```

### Note format

```ts
interface Note {
  version: "qietr.v1";
  commitments: Array<{
    secret: string;         // base58 of 32 bytes
    nullifier: string;      // base58 of 32 bytes
    amount: number;         // micro-USDC
    denomId: number;        // tier index
  }>;
}
```

Notes are AES-256-GCM encrypted with a user-supplied passphrase for storage. Encrypted form is a single base64 blob prefixed with the protocol magic `qietr.enc.v1:`.

## 7. Relayer / fee-payer

- **Default:** [Kora](https://github.com/solana-foundation/kora) instance run by the Qietr team.
- **Auth:** anonymous, rate-limited by IP and by burner pubkey. Higher limits require an API key (free, sign-up self-serve).
- **Abuse mitigation:** reject withdrawals targeting recipients on a public blocklist (sanctions screening list at the relayer level only). The pool program itself remains unfiltered.

## 8. Indexer

- **Source:** Geyser plugin streaming `qietr_pool` account writes and program logs.
- **Storage:** Postgres.
- **Endpoints:**
  - `GET /denominations` — current tiers, vault balances, deposit counts.
  - `GET /merkle-proof?denomId=X&commitment=Y` — path + indices + recent roots.
  - `GET /nullifier-status?denomId=X&nullifierHash=Y` — whether the nullifier is spent (used for UX warnings).
- **Caching:** Cloudflare with stale-while-revalidate for read endpoints.

## 9. Failure modes

| Failure | Detection | Mitigation |
|---------|-----------|------------|
| Witness built against stale root | On-chain: root not in window. Withdraw reverts. | SDK retries with fresh proof against current root. |
| Nullifier already spent (replay or double-spend attempt) | Withdraw reverts with `NullifierSpent`. | SDK surfaces unrecoverable error; note is permanently used. |
| Proof generation fails in browser | WASM exception | Fall back to remote prover service (opt-in; reveals payment metadata to operator). |
| Relayer down | Tx submission error | SDK retries via user wallet (user pays SOL), or queues for next attempt. |
| Merchant's x402 facilitator rejects burner transfer | HTTP error from facilitator | SDK refunds remaining note value via a self-withdrawal back to a new commitment. |

## 10. Phase 2 — cross-chain (deferred)

For reference only; not in MVP scope.

- An attestor service signs `(denomId, nullifierHash, originChain)` claims after observing on-chain non-spend on origin.
- A bridge program on the destination chain (Base or others) accepts the attestor signature, releases USDC there, and writes the nullifier as spent on origin via a delayed message.
- Wormhole or LayerZero as transport; attestor as the privacy layer.
- This adds significant trust assumptions (attestor liveness, signature quorum, replay protection across chains). Out of MVP scope on purpose.

## 11. Open technical questions

- Single circuit parameterized by `denomId`, or one circuit per tier? Per-tier is simpler but requires N trusted-setup ceremonies. Parameterized is one ceremony but slightly larger proofs.
- Should we expose a "wait for finality" option in the SDK, or always require user to wait for confirmed status before spending? Affects UX latency budget.
- Note format versioning strategy. We need clean migration semantics from day one even though only `v1` exists.

## 12. Dependencies

- `anchor-lang` ≥ 0.30
- `groth16-solana`
- `light-poseidon` (or vendor the implementation)
- `@solana/web3.js` v2 client style
- `snarkjs` + `circomlibjs` for proof generation
- `@x402/svm` for client-side x402 facilitator interactions
