# Qietr — Implementation Plan

Goal: ship a full privacy-payment product on **Solana**.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked by user/external action.

---

## Phase A — Core SDK + indexer + relayer (no toolchain dependency)

- [x] **A1.** TRD §4.2: `amount` is public signal #5, not private.
- [x] **A2.** Indexer API: `GET /denominations`, `/merkle-proof`, `/nullifier-status`.
- [x] **A3.** `QietrSDK.deposit` — tier pick, commitment, Poseidon, deposit ix.
- [x] **A4.** `QietrSDK.pay` — Merkle proof, witness, Groth16 prove, withdraw ix.
- [x] **A5.** Relayer `POST /quote` + `POST /submit` + rate-limit + sanctions.
- [x] **A6.** `wrapFetch` x402 retry flow.
- [x] **A7.** SDK tests (mocked Connection, Poseidon + dev VK round-trip).

## Phase B — Toolchain

- [x] **B1.** Agave 4.0.2, anchor-lang 0.31.1, groth16-solana 0.2.0. `anchor build` OK.

## Phase C — Pool hardening + tests

- [x] **C1.** Mocha suite: deposit/withdraw/double-spend/stale-root/etc.
- [x] **C2.** Canonical ATA assertion in `withdraw`.
- [x] **C3.** Zero-hash cache in MerkleTree.
- [x] **C4.** Poseidon byte-parity test (8 golden vectors).

## Phase D — Web wallet

- [x] **D1.** Wallet adapter (Phantom/Solflare), `useQietrSdk`, `/deposit` + `/pay` live.
- [x] **D2.** Activity-list same-tab refresh via CustomEvent.

## Phase E — Indexer ingest

- [x] **E1.** Geyser plugin: decode, writer (crossbeam + r2d2), lib (filter + checkpoint). 6/6 tests.

## Phase F — SDK helpers + gasless deposit + $QIET

- [x] **F1.** SDK helpers: `errors.ts` (9 error classes), `logger.ts` (structured logger), `helpers.ts` (getNoteBalance, hasEnoughBalance, formatUSDC, parseUSDC, getCommitmentCount, getLargestCommitment).
- [x] **F2.** Gasless deposit: `relayer-client.ts` HTTP client, `buildTransferIx`, `depositGasless()`, relayer routes `GET /deposit-quote` + `POST /submit-deposit`, `decodeAndValidateDeposit`.
- [x] **F3.** `$QIET` token: `fee_vault` in `PoolConfig`, `set_fee_vault` admin ix, withdraw deducts `fee_bps`, `QIET_MINT_MAINNET`/`QIET_MINT_DEVNET`/`QIET_DECIMALS` in SDK, `buildWithdrawIx` accepts optional `feeVault`.

## Phase G — Agent messaging (qietr-msg)

- [x] **G1.** `qietr-msg` Anchor program: `send` + `delete` instructions, 1115-byte PDA (8+32+32+8+8+2+1+1024).
- [x] **G2.** SDK `src/msg.ts`: `buildSendMsgIx`, `buildDeleteMsgIx`, `findMsgPda`, `encryptMsgBody`/`decryptMsgBody` (Argon2id + AES-256-GCM), `parseMessageAccount`, `fetchInbox`, `EncryptedMessage`. 9 tests.

## Phase H — Agent commerce escrow (qietr-escrow)

- [x] **H1.** `qietr-escrow` Anchor program: `create_job`, `accept_job`, `complete_job`, `release_payment`, `dispute_job`, `refund_job`. Escrow vault PDA with CPI-signed token transfer.
- [x] **H2.** SDK `src/escrow.ts`: 6 instruction builders, `findJobPda`, `findEscrowVaultPda`, `parseJobAccount`, `JobState` enum. 14 tests.

## Phase I — Devnet rollout

- [x] **I1.** Deployed to devnet (2026-06-12, Anchor 0.31.1): pool `4XH6f74UFTvqx4j9UarXGrRZRrAwbnNNsRFBTfNqmWib`, escrow `DBLjgT9mCjTF3q7zqDCnUrMtHEnBarNwqmk7XojB4FNz`, msg `6ZAeJCLRrNyMCLYgH5uUdRNbA5usAun94vPtaTM5Xdez`. Pool ID rotated (old config PDA had pre-`fee_vault` 116-byte layout). E2E deposit + Groth16 withdraw passed (`qietr-pool/scripts/devnet-e2e.mts`).
- [!] **I2.** Host circuit artifacts on Cloudflare R2 (`circuits.qietr.com`).
- [!] **I3.** Deploy `qietr-web` static export to Cloudflare Pages at `qietr.com`.

## Phase J — Mainnet readiness

- [ ] **J1.** Trusted-setup ceremony spec + execution (replace dev pot14 zkey).
- [ ] **J2.** Audit booking: Anchor firm + circuit specialists.

## Phase K — Token launch

- [x] **K1.** `$QIET` minted via pump.fun at `MXDRgSQstTKBMunuF2VmcnBejpbidECL5vtCAb6pump`. SDK `QIET_MINT_MAINNET` updated. `set_fee_vault` call still pending (needs pool admin to invoke).

## Phase L — Cross-chain

- [ ] **L1.** Wormhole attestor (Sol ↔ EVM nullifier bridge). Spec in `docs/12-cross-chain.md`.

## Phase M — CI/CD

- [x] **M1.** GitHub Actions: `npm test` + `cargo test` on PR. (`.github/workflows/ci.yml`, 9 jobs.)
- [ ] **M2.** `npm publish` automation for `@qietr/sdk`. (Workflow `publish-sdk.yml` exists; needs npm token secret.)

## Phase N — Hardening pass (production-readiness)

- [x] **N1.** Escrow lifecycle: `cancel_job` (client refund pre-accept or after accept-timeout), `resolve_dispute` (permissionless timeout resolution), `close_job` (rent reclaim). `create_job` now pins `agent` up front and requires `price_micro > 0`. `release_payment` asserts `agent_ata.owner == job.agent`.
- [x] **N2.** Msg `close` instruction (recipient reclaims rent). Both `close_job` and msg `close` use idiomatic Anchor `close =` (no manual lamports drain).
- [x] **N3.** Pool: `fee_bps <= 10000` guard, distinct `FeeVaultMismatch` error, `Box`-ed accounts in `Deposit`/`Withdraw` to cut stack usage.
- [x] **N4.** SDK: removed placeholder default URLs (`indexerUrl` + `proverPath` now required), wrapped all `fetch`/RPC calls in typed errors, real payer pubkey in x402 receipts. New builders: `buildCancelJobIx`, `buildResolveDisputeIx`, `buildCloseJobIx`, `buildCloseMsgIx` (+ `buildRefundJobIx` kept as deprecated alias).
- [x] **N5.** Relayer: Bearer-token auth (`src/policy/auth.ts`, `API_KEY` env) on all routes except `/health`; rate-limit decisions now return 429.
- [x] **N6.** Tests: SDK 100/100 (5 new builder tests + stale tests fixed for new signatures); relayer auth suite 6/6 (new `node --test` + tsx runner).

---

## What's still parity gap

- **ERC-4337 / paymaster / bundler.** Solana has fee-payer abstraction via relayer — already covered.

---

## Execution history

1. **Session 1:** Phase A (core SDK + indexer + relayer). **DONE**
2. **User:** Phase B (toolchain upgrade). **DONE**
3. **Session 2:** Phase C + D + E (pool tests, web, Geyser). **DONE**
4. **Session 3:** Phase F + G + H (SDK helpers, gasless deposit, $QIET, qietr-msg, qietr-escrow). **DONE**
5. **Session 4:** Phase N (hardening pass — escrow lifecycle, msg/job close, pool guards, SDK error handling + required config URLs, relayer auth). **DONE**
6. **Remaining:** I1–I3 (devnet rollout — blocked on you), J1–J2 (mainnet), K1 (token), L1 (cross-chain), M2 (npm publish token).

> **Gotcha:** `qietr-sdk` tests run against compiled `dist/`, not `src/`. Always `npm run build` before `npm test` or you will test stale code. The relayer tests run against `src/` via tsx, so no build step is needed there.

