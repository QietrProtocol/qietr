# Security and Risk — Qietr

**Version:** 0.1 (spec phase)
**Status:** Working threat model. Updated as the design evolves.

This document is required reading for anyone contributing to Qietr.

---

## 1. Trust model in one paragraph

Qietr is non-custodial. The protocol's correctness does not depend on Qietr the team being honest, online, or solvent. The protocol's *privacy* depends on (a) the soundness of Groth16 over BN254 and the Poseidon hash, (b) the anonymity-set size at the moment of withdrawal, (c) the user keeping their note secret, and (d) the relayer not correlating burners with depositors out of band. We trust (a) by relying on widely deployed primitives. We trust (b) by publishing the size and warning users when it is too small. We trust (c) by giving users the tools to manage notes safely. We trust (d) only as far as the relayer can be substituted by any third party (the protocol does not require ours).

---

## 2. Assets

| Asset | Where it lives | Loss impact |
|-------|----------------|-------------|
| Pooled USDC | `Vault` SPL token PDAs | Total user loss for all depositors of an affected tier |
| User note (secret + nullifier) | User device | Total loss of that depositor's funds |
| Verifying key | On-chain `PoolConfig` | A malicious VK swap would allow forged withdrawals; protected by time-lock + governance |
| Relayer fee-payer SOL balance | KMS-held keypair | Operational loss; fee sponsorship pauses until refunded |
| Trusted-setup transcript | Public repo + IPFS | Loss of reproducibility but no immediate risk |
| Indexer database | Postgres | Recoverable from on-chain state; downtime impact only |

---

## 3. Threat model

### 3.1 In-scope adversaries

1. **External attacker.** Anonymous network attacker, no special access.
2. **Malicious depositor.** Attempts to double-spend, forge proofs, or replay nullifiers.
3. **Malicious relayer.** A relayer operator that wants to deanonymize users by correlating burners.
4. **Compromised admin key.** The multisig is taken over and tries to push a malicious upgrade.
5. **Front-running searcher.** Observes the mempool and attempts to extract value from withdrawals.
6. **Chain-analysis vendor.** Observes all on-chain history, correlates timing and amounts.

### 3.2 Explicitly out of scope

- Adversaries with control over the user's device (game over by definition).
- Adversaries with quantum capability against BN254 (not a near-term concern; we will document a migration path when one is needed).
- Coercion / rubber-hose attacks against users.

---

## 4. Threats and mitigations

### T1 — Double-spend

**Attack:** Attacker submits two withdraw transactions for the same nullifier.

**Mitigation:** Nullifier is recorded on-chain as the existence of a PDA derived from `nullifier_hash`. The second withdrawal hits an account-already-exists error and reverts. There is no in-memory cache; the on-chain state is the source of truth.

### T2 — Forged proof

**Attack:** Attacker generates a Groth16 proof that verifies but does not correspond to a real commitment.

**Mitigation:**
- Groth16 is sound under the discrete-log and BDH assumptions on BN254.
- The verifying key is committed to `PoolConfig` and cannot be changed without a governance vote and a time-lock.
- VK swap is logged on-chain and watched by an external monitor.

### T3 — Stale-root spend

**Attack:** Attacker tries to withdraw against a root from the deep past, hoping the verifier is too lenient.

**Mitigation:** Withdraw checks that the public-input `root` is in the recent-roots ring buffer (30 entries). Older roots are rejected.

### T4 — Verifying-key swap by malicious admin

**Attack:** Compromised admin pushes a VK that accepts forged proofs and steals the pool.

**Mitigation:**
- Multisig admin (M-of-N, N ≥ 5).
- Time-lock of 14 days on `update_verifying_key`.
- Public alert system that watches for `update_verifying_key` proposals and pages the team and the community.

### T5 — Relayer-side correlation

**Attack:** A relayer logs the depositor's IP and pubkey when they fetch their first note, then logs the burner's IP at withdrawal, correlating the two.

**Mitigation:**
- The default relayer does not require depositor identification at the relay endpoint. Deposits are typically submitted by the user's own wallet, not via the relayer.
- The withdraw relayer logs hashed IPs only, with 7-day retention.
- The protocol does not require *our* relayer. Anyone can run a Kora instance. The SDK accepts a relayer URL.
- The web app exposes the relayer URL in settings so privacy-conscious users can use their own or a third party's.

### T6 — Timing correlation

**Attack:** Chain analysis correlates deposit and withdrawal in a short window of time.

**Mitigation:**
- Documented best practice: wait at least 24 hours between deposit and spend.
- The UI shows the current anonymity-set size for the tier and warns when it is below 50.
- For the small anonymity set case, the UI recommends switching denomination tier.

### T7 — Amount correlation

**Attack:** Adversary correlates rare amounts (e.g. a 100 USDC deposit and an exactly-100-USDC payment within minutes).

**Mitigation:** Fixed denominations + flexible spending. A 100 USDC tier note can be spent in any combination of payments; the change commitment carries forward. Documented as the user-facing best practice.

### T8 — Front-running the withdraw

**Attack:** Searcher observes a withdrawal in the mempool, copies the proof, replaces the recipient with their own address.

**Mitigation:** The `recipient` is bound inside the Groth16 proof as a public input. Changing it invalidates the proof. The withdraw instruction asserts the proof's `recipient` public-input matches the on-chain transfer destination.

### T9 — Burner key leakage

**Attack:** SDK accidentally persists a burner keypair to disk; another process reads it.

**Mitigation:**
- Burner keys are kept in process memory and zeroed after the SPL transfer.
- The SDK never logs burner pubkey or privkey.
- Browser builds use `crypto.subtle` randomness; Node builds use `crypto.randomBytes`.

### T10 — Note theft via misconfigured backup

**Attack:** User pastes an unencrypted note into a public channel.

**Mitigation:**
- Default backup is the encrypted blob format. The "Show raw note" button requires explicit confirmation.
- The backup modal displays the warning: "Anyone with this text can spend your funds."

### T11 — Indexer compromise

**Attack:** Attacker takes over the indexer and serves false Merkle proofs that point to non-existent commitments.

**Mitigation:**
- Withdraw is verified by the on-chain program, not by the indexer. A false proof simply fails verification on-chain.
- The SDK can verify the root returned by the indexer matches the on-chain `MerkleTree` account.
- Reproducibility: anyone can run their own indexer from a Geyser stream.

### T12 — Compute exhaustion / griefing

**Attack:** Attacker spams cheap deposits to bloat the Merkle tree until withdraw proofs become expensive to generate.

**Mitigation:**
- Tree depth is fixed at 20 (≈ 1M leaves). Proof time grows logarithmically, not linearly, so spam impact is bounded.
- Deposit fee includes a minimum floor that makes spam costly.
- Per-tier deposit rate-limit at the indexer for telemetry; not enforced on-chain.

### T13 — Sanctions and regulatory action

**Attack:** Regulatory authority designates the protocol or addresses interacting with it.

**Mitigation:**
- This is a real risk and we acknowledge it explicitly. Past privacy protocols on EVM have been sanctioned by OFAC.
- Mitigations are partial, not complete:
  - The pool program is immutable post-launch except via time-locked governance.
  - The team does not custody or filter user funds at the protocol level.
  - Relayers operated by Qietr screen recipients against the public sanctions list. The protocol itself does not.
  - The protocol is open source; alternative deployments, frontends, and relayers can exist.
- We do not market Qietr in jurisdictions where its use is illegal. The web app includes a geographic notice and, where appropriate, blocks access.

### T14 — Supply-chain attack on dependencies

**Attack:** A compromised NPM package or Rust crate ships malicious code that exfiltrates secrets.

**Mitigation:**
- Pin all dependency versions with lockfiles.
- `cargo-vet` for Rust dependencies, `socket.dev` and `npm audit` in CI for JavaScript.
- Subresource Integrity for any browser-loaded scripts (Poseidon WASM, snarkjs).
- Reproducible builds for the verifier program and the WASM prover.

### T15 — UI substitution

**Attack:** A phishing site at `qietr-app.com` mimics the real one and steals notes.

**Mitigation:**
- Strict DNS hygiene; canonical domain `qietr.com` published in all official channels.
- Open-source web app so anyone can self-host with verified source.
- The SDK and web app sign deposit / withdraw transactions exclusively against the on-chain pool program ID, which is published in docs and constant.

---

## 5. Audit plan

### Pre-mainnet

- **Anchor program audit.** One reputable firm (e.g. OtterSec, Neodyme, Asymmetric Research). Scope: pool, vault math, nullifier handling, root window, admin path, integration with `groth16-solana`.
- **Circuit audit.** A specialist circuit auditor (e.g. zksecurity.xyz, Veridise). Scope: constraints, soundness, completeness, trusted-setup ceremony participation.
- **Cryptography review.** Independent reviewer for the choice of Poseidon parameters, BN254 usage, and any custom primitives.

### Continuous

- **Bug bounty.** Live program at TGE, hosted on Immunefi or a self-hosted page. Top severity bounty proportional to TVL, with explicit scope and rules of engagement.
- **Quarterly review.** Internal review of recent changes against the threat model. Findings published.
- **Annual external review.** Recurring audit of the live system, not just new code.

---

## 6. Operational security

### Keys

- Pool admin: 5-of-7 multisig. Hardware-key holders distributed across team and trusted advisors.
- Relayer fee-payer: cloud KMS with 2-of-3 quorum for rotation, single-signer for fee-payer use within strict daily SOL budget.
- VK update: time-locked governance, never single-key.

### Incident response

- Public incident response policy: when an issue is suspected, the team pauses (if necessary), notifies users within 4 hours, and publishes a status page update every 12 hours until resolved.
- Post-mortems are published for all incidents within 14 days.

### Monitoring

- On-chain monitor watches:
  - `update_verifying_key` proposals.
  - `set_paused` events.
  - Anomalous deposit / withdraw ratios (e.g. spikes that suggest abuse or attack).
  - Vault balance vs Merkle leaf count consistency.
- Off-chain monitor for indexer lag, relayer SOL balance, web app availability.

---

## 7. User-facing security guidance

Surfaced in the docs and reinforced in the UI:

1. Save your note immediately after deposit. Test the restore flow before relying on it.
2. Encrypt your note with a strong passphrase before storing it anywhere.
3. Wait at least 24 hours between deposit and spend for stronger privacy.
4. Check the anonymity-set indicator before spending. If it is below 50, wait longer or use a different tier.
5. Use a fresh recipient address for each payment when possible.
6. Verify the web app URL is exactly `qietr.com` before connecting your wallet.
7. Treat the note like cash. Anyone who has it can spend it.

---

## 8. Disclosure

- **Security contact:** `security@qietr.com`.
- **PGP key:** published at `qietr.com/.well-known/security.txt`.
- **Coordinated disclosure:** we ask for a 90-day window for high-severity bugs. We commit to acknowledging reports within 48 hours and publishing fixes promptly.
- **Public credit:** with the reporter's permission, every fixed bug is credited in release notes.

---

## 9. Known limitations

We document limitations clearly so users can make informed decisions.

- **No anonymous deposit at MVP.** The user's wallet pubkey is visible at deposit time. Privacy is gained only at withdraw. Cross-chain or relayed deposits would help but are out of scope for MVP.
- **Browser proof generation is slow.** Around 12 seconds on a modern laptop, longer elsewhere. Some users will choose to use the remote prover, which trades privacy at the prover service for speed.
- **No support for sanctioned-asset analysis.** Qietr does not provide tooling to merchants for "is this depositor likely sanctioned" — the protocol is not designed to make that distinction.
