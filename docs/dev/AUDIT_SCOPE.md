# External Audit — scope document

> Prepared to brief external auditors. Booking the engagement (and budget) is a
> human decision; this document defines what should be in scope and the prior
> context an auditor needs. It complements the internal critic-mode audit in
> `AUDIT-2026-06-13.md` (which an auditor should read first — many findings are
> already fixed; this scope targets independent confirmation + depth).

## System summary

Qietr is a fixed-denomination shielded pool over USDC on Solana that settles
HTTP **x402** micropayments privately. A user deposits a tier amount
(0.1/1/10/100 USDC), then pays a merchant by proving in zero knowledge (Groth16
over BN254) that they own an unspent leaf, revealing only a nullifier and the
recipient. An optional relayer pays the SOL fee (gasless). An indexer (geyser +
API) serves Merkle proofs.

## Two specialist tracks

We recommend a combined engagement:

1. **Anchor / Solana program firm** — `qietr-pool`, `qietr-escrow`, `qietr-msg`.
2. **ZK circuit specialist** — `qietr_payment.circom` soundness + the on-chain
   verifier binding.

## In scope (by component)

### qietr-pool (highest priority)

- Withdraw soundness: nullifier binding, recipient binding (`pubkey_to_field` —
  note the lossy 3-bit mask; 8 pubkeys collide to one field element, mitigated by
  the canonical-ATA check), amount/tier binding, root-window check.
- VK timelock: `withdraw` now enforces `embedded_vk_hash() ==
  config.verifying_key_hash`; confirm the queue/apply timelock can't be bypassed.
- Merkle tree: append correctness, root-history ring (30), zero-hash table.
- Fee math and vault PDA authority; reentrancy/CPI assumptions.
- Account constraints / access control (`has_one = admin`, PDA seeds).

### qietr_payment circuit

- Constraint completeness: is every public signal actually bound (note
  `recipientBound <== recipient * recipient` is a no-op — confirm the public-input
  commitment is what prevents retargeting).
- Range checks on `amount` / `paymentAmount` (64-bit); change computation.
- **Change-note linkability** (`PRIVACY.md`): confirm the documented limitation
  and that nothing worse leaks.
- Poseidon parameter parity across circom / circomlibjs / light-poseidon.

### qietr-circuits trusted setup

- Review the ceremony plan (`CEREMONY.md`) and the VK→Rust conversion for
  byte-layout correctness vs `groth16-solana`.

### qietr-relayer (money path)

- Economic validation: deposit fee destination + minimum, SOL balance floor,
  per-window spend cap, replay guard (TTL dedup). Confirm no drain/grief path.
- Auth (constant-time), bind/proxy posture, sanctions fail-closed.

### qietr-sdk

- Proof/witness construction; note encryption (Argon2id + AES-256-GCM); the x402
  `wrapFetch` spend guard (`maxAmountMicro`, payTo allowlist, asset check) and
  envelope conformance.

### qietr-indexer

- Merkle-proof correctness vs on-chain root; DoS surface; geyser panic-safety;
  leaf-index attribution races on forks.

### qietr-escrow / qietr-msg

- Escrow state machine, dispute/timeout resolution, ATA constraints; message
  size/spam bounds.

## Out of scope

- Marketing site content (`qietr-web`) except where it states security claims.
- Off-chain infra/ops (HSM, deployment), beyond the relayer's hot-key model.
- The `$QIET` token (not minted; constants are placeholders, guarded).

## Known issues already disclosed (don't re-derive — confirm fixes)

- Single-contributor **dev VK** in use on devnet → ceremony required (`CEREMONY.md`).
- **Change-note linkability**; per-tier (not pool-wide) anonymity set (`PRIVACY.md`).
- 3-bit recipient masking collisions (mitigated by canonical-ATA check).
- 30-root window leaks a deposit-time upper bound on sparse tiers.

## Deliverables requested from auditors

- Severity-ranked findings with PoCs where feasible.
- Independent confirmation that the §1–§5 fixes in `AUDIT-2026-06-13.md` are
  complete and correct.
- A go/no-go recommendation for a mainnet launch gated on (a) the ceremony and
  (b) remediation of any High/Critical findings.

## Reference materials for auditors

- `AUDIT-2026-06-13.md` — internal critic-mode audit + fix log.
- `CHANGELOG.md` — what changed in response.
- `PRIVACY.md`, `CEREMONY.md`, `docs/02-TRD.md`, `LOCAL_SETUP.md`.
- Devnet deployment addresses + e2e scripts in the root README and `qietr-pool/scripts`.
