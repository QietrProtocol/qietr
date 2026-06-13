# Security Policy

> **Qietr is unaudited software running on Solana devnet with a single-contributor
> development verifying key.** Do not use it with funds you cannot afford to lose
> until a multi-party trusted-setup ceremony and an external audit are complete.
> See [`docs/dev/PRIVACY.md`](docs/dev/PRIVACY.md) and
> [`docs/dev/11-trusted-setup.md`](docs/dev/11-trusted-setup.md).

## Supported versions

| Component | Status | Security fixes |
|-----------|--------|----------------|
| `main` (devnet) | Active development | Yes |
| Tagged releases | Pre-1.0, not production | Best-effort |

There is no production deployment yet. All addresses in the README are **devnet**.

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Email **security@qietr.com** with:

- A description of the issue and its impact.
- Steps to reproduce (PoC welcome, especially for the ZK circuit, the pool
  program, or the relayer money path).
- The component and commit hash.

We aim to acknowledge within **72 hours** and to provide a remediation timeline
within **7 days**. We will credit reporters who wish to be named once a fix ships.

### In scope

- `qietr-pool` (Anchor program), `qietr-escrow`, `qietr-msg`.
- `qietr-circuits` (Groth16 circuit soundness, public-signal binding).
- `qietr-sdk` (proof construction, note handling, x402 wrapFetch spend guard).
- `qietr-relayer` (economic validation, replay protection, auth).
- `qietr-indexer` (Merkle-proof correctness, DoS, geyser panics).

### Known limitations (not vulnerabilities — already disclosed)

- **Dev verifying key.** The live verifier is a single-contributor `dev_vk`
  ("Do not deploy"). A trapdoor holder could forge proofs. Tracked for the
  trusted-setup ceremony.
- **Change-note linkability.** Partial-spend change notes are linkable on-chain;
  the anonymity set is per-tier. See `docs/dev/PRIVACY.md`.
- **3-bit recipient masking.** `pubkey_to_field` clears the top 3 bits, so 8
  pubkeys collide to one field element. Mitigated by the canonical-ATA check;
  a full-pubkey hash is planned.

## Disclosure philosophy

We practice coordinated disclosure. We would rather hear about a problem
privately and fix it than have it found in production. Thank you for helping
keep Qietr's users safe.
