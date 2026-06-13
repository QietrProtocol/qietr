# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims to
follow [Semantic Versioning](https://semver.org/) once it reaches 1.0.

## [Unreleased]

### Security

- **Relayer money path hardened (§3).** Deposit validation now verifies the SPL
  fee transfer actually pays the relayer's fee ATA at or above the configured
  minimum; added a SOL balance floor + per-window spend cap (`spend-guard`) and a
  TTL replay guard (`replay-guard`) so a previously-submitted tx can't be replayed
  to burn fees. Auth now uses `timingSafeEqual`; the server warns loudly when
  bound to a public interface without an API key. Outbound Kora/sanctions fetches
  have timeouts; a configured sanctions list that fails to load is now **fail-closed**.
- **x402 spend guard (§1).** `wrapFetch` now requires a mandatory `maxAmountMicro`
  ceiling and supports an optional `payTo` allowlist; it rejects requirements whose
  `asset` isn't the configured USDC mint. Errors are now typed and thrown rather
  than silently swallowed.
- **VK timelock is now enforced (§2.4).** `withdraw` gates verification on
  `config.verifying_key_hash` matching the embedded VK, so the 48h
  `queue_vk_upgrade`/`apply_vk_upgrade` timelock is real rather than decorative.
- **Escrow `CreateJob` (§5).** `client_ata` now carries `owner == client` and
  `mint` constraints, matching the other instruction contexts.
- **Geyser panic-safety (§4).** `latest_root` is bounds-checked (no validator
  panic on a corrupt `root_cursor`); the writer thread spawn is fallible and
  surfaces a `GeyserPluginError` instead of `.expect()`.

### Added

- Real x402 envelope on the wire: `X-PAYMENT` is now
  `base64({ x402Version, scheme, network, payload })`, parsing `maxAmountRequired`
  (with legacy `amount` fallback) and keeping amounts as `bigint` end-to-end.
- Network-alias normalization (`solana` / `solana-devnet` / `mainnet-beta` / CAIP-2).
- `docs/dev/PRIVACY.md` — honest privacy model, including per-tier anonymity sets
  and partial-spend change-note linkability (decision D2).
- Community-health files: `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
  issue/PR templates, this changelog.
- `docs/getting-started/LOCAL_SETUP.md` — single-source local-stack guide.
- `docs/dev/CEREMONY.md` — trusted-setup ceremony spec and tooling outline.
- `docs/dev/AUDIT_SCOPE.md` — external-audit scope document.
- wrapFetch test suite (`qietr-sdk/test/x402.test.mjs`) and relayer money-path
  tests (`qietr-relayer/test/money-path.test.ts`).
- `engines` field (Node 20+) in all Node packages.

### Fixed

- **Public-signal order reconciled (§2).** The SDK self-check now reads
  nullifierHash at index 2 and recipient at index 3 (authoritative order
  `[amount, root, nullifierHash, recipient, paymentAmount, changeCommitment]`
  from `qietr_payment.sym`). Stale comments in `verifier.rs`, `pubkey.ts`, and
  `qietr-circuits/README.md` corrected to match `lib.rs::withdraw`.
- `payMicro` no longer round-trips micro-USDC through a float.
- `$QIET` mint placeholder constants are guarded against accidental use.

## [0.1.0-devnet] — 2026-06-12

### Added

- Initial devnet deployment of `qietr-pool`, `qietr-escrow`, `qietr-msg`.
- Groth16 payment circuit, SDK, relayer, and indexer (geyser + API).
- End-to-end deposit → pay → withdraw verified on devnet.

[Unreleased]: https://github.com/QietrCom/qietr/compare/v0.1.0-devnet...HEAD
[0.1.0-devnet]: https://github.com/QietrCom/qietr/releases/tag/v0.1.0-devnet
