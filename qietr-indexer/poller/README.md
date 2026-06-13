# qietr-indexer poller

A **geyser-free** ingester for the Qietr pool. It reads `qietr_pool` state over
a standard Solana RPC endpoint and writes the same Postgres rows the geyser
plugin produces — so the existing [indexer API](../api) serves merkle proofs
unchanged, with no validator or `.so` to run.

Use this when you can't (or don't want to) run a validator with the geyser
plugin loaded — e.g. a hosted devnet deployment against Helius RPC.

## What it does each tick

| Source (RPC) | Decoded as | Postgres |
|---|---|---|
| `getProgramAccounts` → `Denomination` | `decode.ts` borsh | `denominations` (upsert) |
| `getProgramAccounts` → `MerkleTree` | `decode.ts` borsh | `roots` (upsert by `leaf_count`) |
| `getProgramAccounts` → `NullifierRecord` | `decode.ts` borsh | `nullifiers` (insert) |
| `getSignaturesForAddress` + `getParsedTransaction` → `deposit` ix | `parseDepositIx` | `commitments` (insert, ordered `leaf_index`) |

Progress is checkpointed in `ingest_progress` (`component = poller-devnet` by
default) after every signature, so a restart resumes from the last processed
transaction and re-seeds the per-denom `leaf_index` counter from Postgres.

> **Correctness note.** `leaf_index` must match the on-chain append order.
> The poller replays deposit signatures **oldest-first** and assigns indices
> monotonically per denom. The API's `/merkle-proof` route asserts the stored
> leaves are gap-free and cross-checks the computed root against the on-chain
> root, so any ordering bug fails loud instead of producing bad proofs.

## Decode parity

`src/decode.ts` is a 1:1 port of `qietr-indexer/geyser-plugin/src/decode.rs`.
`test/decode.test.mjs` asserts the TS decoders against the **same** discriminator
and borsh byte-vectors the Rust crate's tests lock in. Run both if you touch
either side.

## Run

```bash
npm install
cp .env.example .env        # set SOLANA_RPC_URL + DATABASE_URL
psql "$DATABASE_URL" -f ../db/schema.sql   # once, if not already applied
npm run build && npm start
```

Tests:

```bash
npm test
```

## Config

See `.env.example`. Key vars: `SOLANA_RPC_URL` (Helius devnet), `DATABASE_URL`
(Neon — TLS auto-enabled on `sslmode=require`), `PROGRAM_ID` (defaults to the
deployed devnet pool), `POLL_INTERVAL_MS` (default 8000).
