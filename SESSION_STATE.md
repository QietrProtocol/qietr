# Session State — handoff notes

**Last updated:** 2026-06-09 (Session 3: SDK helpers, gasless deposit, $QIET, qietr-msg, qietr-escrow, CI/CD)

---

## What's built

### Core shielded payments (Phases A–E)
- `qietr-circuits/` — Groth16 circuit (5789 constraints), dev pot14 setup, 6/6 tests
- `qietr-pool/` — Anchor program (pool, denominations, deposit, withdraw with Groth16 verify + VK time-lock + nullifier PDA), mocha suite written
- `qietr-sdk/` — `QietrSDK.deposit`/`.pay`/`.wrapFetch`, Poseidon merkle tree, note encryption (Argon2id + AES-256-GCM), prover, indexer client, relayer client
- `qietr-web/` — Next.js static export, wallet adapter (Phantom/Solflare), /deposit, /pay (+ x402 tab), /note, /activity
- `qietr-indexer/` — Fastify API (denominations, merkle-proof, nullifier-status) + Geyser plugin (decoder + writer + lib)
- `qietr-relayer/` — Fastify fee-payer service with rate-limit, sanctions, Kora backend

### SDK helpers (Phase F)
- `qietr-sdk/src/errors.ts` — 9 error classes extending `QietrSDKError`
- `qietr-sdk/src/logger.ts` — structured logger (debug/info/warn/error)
- `qietr-sdk/src/helpers.ts` — `getNoteBalance`, `hasEnoughBalance`, `getCommitmentCount`, `getLargestCommitment`, `formatUSDC`, `parseUSDC`
- `qietr-sdk/src/relayer-client.ts` — HTTP client for relayer quote + submit
- `qietr-sdk/src/program.ts` — `buildTransferIx`, `buildWithdrawIx` (with `feeVault` param)
- `qietr-sdk/src/sdk.ts` — `depositGasless()` method
- `qietr-relayer/src/routes/deposit-quote.ts` — `GET /deposit-quote`
- `qietr-relayer/src/routes/submit-deposit.ts` — `POST /submit-deposit`
- `qietr-relayer/src/tx-validation.ts` — `decodeAndValidateDeposit()`

### $QIET token (Phase F)
- `qietr-pool/programs/qietr_pool/src/lib.rs` — `fee_vault` in `PoolConfig`, `set_fee_vault` admin instruction, withdraw deducts `fee_bps` when `fee_vault` is set
- `qietr-sdk/src/chain.ts` — `QIET_MINT_MAINNET`, `QIET_MINT_DEVNET`, `QIET_DECIMALS`

### Agent messaging (Phase G — qietr-msg)
- `qietr-msg/` — Anchor program with `send` + `delete` instructions, 1115-byte PDA
- `qietr-sdk/src/msg.ts` — `buildSendMsgIx`, `buildDeleteMsgIx`, `findMsgPda`, `encryptMsgBody`/`decryptMsgBody` (Argon2id + AES-256-GCM), `parseMessageAccount`, `fetchInbox`
- 9 SDK tests

### Agent commerce escrow (Phase H — qietr-escrow)
- `qietr-escrow/` — Anchor program: `create_job`, `accept_job`, `complete_job`, `release_payment`, `dispute_job`, `refund_job`. CPI-signed token transfers from escrow vault PDA
- `qietr-sdk/src/escrow.ts` — 6 instruction builders, PDA finders, `parseJobAccount`, `JobState` enum
- 14 SDK tests

### Documentation
- `qietr-msg/README.md`
- `qietr-escrow/README.md`
- `docs/13-agent-ecosystem.md` — msg + escrow integration docs
- `IMPLEMENTATION_PLAN.md` — fully updated (13 phases A–M)
- `README.md` files across all packages already updated in previous sessions

### CI/CD
- `.github/workflows/ci.yml` — 9 jobs: SDK test, web build, circuits test, relayer build, indexer-api build, pool cargo check, escrow cargo check, msg cargo check, geyser cargo check
- `.github/workflows/publish-sdk.yml` — publish @qietr/sdk to npm on `sdk-v*` tag

### Web frontend additions
- `/app/messaging/` — encrypted messaging info page
- `/app/escrow/` — escrow job lifecycle info page
- Links added to `/app/` home
- 14 static pages total (was 12)

### SDK tests
- 95 tests total (was ~66), all passing
- New: 15 edge-case tests (JobState enum, parse edge cases, error classes, empty messages, helpers edge cases)

---

## What's NOT built (requires user action)

| Task | Why blocked |
|------|------------|
| **Devnet deploy** (F1–F3 in plan) | Needs Solana CLI + Cloudflare R2 + Pages |
| **`$QIET` mint** | Needs SPL token creation + SDK constant update |
| **Trusted-setup ceremony** (J1) | Needs contributor coordination |
| **Audit** (J2) | User decision + budget |
| **Cross-chain attestor** (L1) | Deferred, spec exists |
| **Push to GitHub** | No remotes configured |

---

## How to resume

In a fresh session at this directory:

> Read `SESSION_STATE.md` and `IMPLEMENTATION_PLAN.md`. All code is built and typechecks. 95 SDK tests pass. CI/CD workflows are ready. What remains is devnet deploy (needs Solana CLI + Cloudflare), token mint, trusted-setup, audit, cross-chain. Pick a blocked task or start the devnet rollout.

---

## Key file locations

| File | Purpose |
|------|---------|
| `qietr-sdk/src/errors.ts` | 9 error classes |
| `qietr-sdk/src/logger.ts` | Structured logger |
| `qietr-sdk/src/helpers.ts` | Balance/format utilities |
| `qietr-sdk/src/relayer-client.ts` | Gasless deposit client |
| `qietr-sdk/src/msg.ts` | Messaging SDK module |
| `qietr-sdk/src/escrow.ts` | Escrow SDK module |
| `qietr-msg/programs/qietr_msg/src/lib.rs` | Messaging program |
| `qietr-escrow/programs/qietr_escrow/src/lib.rs` | Escrow program |
| `.github/workflows/ci.yml` | CI workflow |
| `.github/workflows/publish-sdk.yml` | npm publish workflow |
| `docs/13-agent-ecosystem.md` | Agent messaging + escrow docs |
| `IMPLEMENTATION_PLAN.md` | Full phased plan |

## Test counts

| Suite | Count |
|-------|-------|
| SDK tests | 95 pass (0 fail) |
| Circuits tests | 6 pass |
| Pool Rust tests | 5 pass (2 poseidon parity + 3 unit) |
| Geyser plugin tests | 6 pass |
| Pool anchor mocha | 10 tests (written, need `anchor build` to run) |
| **Total** | **~122** |
