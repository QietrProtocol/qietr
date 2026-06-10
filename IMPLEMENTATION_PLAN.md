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

- [!] **I1.** Rotate program keypair, deploy to devnet, initialize tiers, end-to-end deposit + pay.
- [!] **I2.** Host circuit artifacts on Cloudflare R2 (`circuits.qietr.com`).
- [!] **I3.** Deploy `qietr-web` static export to Cloudflare Pages at `qietr.com`.

## Phase J — Mainnet readiness

- [ ] **J1.** Trusted-setup ceremony spec + execution (replace dev pot14 zkey).
- [ ] **J2.** Audit booking: Anchor firm + circuit specialists.

## Phase K — Token launch

- [ ] **K1.** Mint `$QIET` SPL, wire pool fee-share, launch.

## Phase L — Cross-chain

- [ ] **L1.** Wormhole attestor (Sol ↔ EVM nullifier bridge). Spec in `docs/12-cross-chain.md`.

## Phase M — CI/CD

- [ ] **M1.** GitHub Actions: `npm test` + `cargo test` on PR.
- [ ] **M2.** `npm publish` automation for `@qietr/sdk`.

---

## What's still parity gap

- **ERC-4337 / paymaster / bundler.** Solana has fee-payer abstraction via relayer — already covered.

---

## Execution history

1. **Session 1:** Phase A (core SDK + indexer + relayer). **DONE**
2. **User:** Phase B (toolchain upgrade). **DONE**
3. **Session 2:** Phase C + D + E (pool tests, web, Geyser). **DONE**
4. **Session 3:** Phase F + G + H (SDK helpers, gasless deposit, $QIET, qietr-msg, qietr-escrow). **DONE**
5. **Remaining:** I1–I3 (devnet rollout — blocked on you), J1–J2 (mainnet), K1 (token), L1 (cross-chain), M1–M2 (CI/CD).
