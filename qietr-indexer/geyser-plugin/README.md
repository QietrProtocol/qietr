# qietr_indexer_geyser

Geyser plugin loaded by a Solana validator that streams `qietr_pool` account writes and transactions into Postgres, feeding `qietr-indexer/api`.

## Loading into the validator

Build:

```bash
cargo build --release
# Produces target/release/libqietr_indexer_geyser.so on Linux,
#          target/release/qietr_indexer_geyser.dll on Windows,
#          target/release/libqietr_indexer_geyser.dylib on macOS.
```

Run a test validator with the plugin loaded:

```bash
solana-test-validator \
  --geyser-plugin-config geyser-config.json \
  --bpf-program <pool-program-id> ../../qietr-pool/target/deploy/qietr_pool.so
```

`geyser-config.json`:

```json
{
  "libpath": "target/release/libqietr_indexer_geyser.so",
  "pool_program_id": "4XH6f74UFTvqx4j9UarXGrRZRrAwbnNNsRFBTfNqmWib",
  "db_url": "postgres://qietr:qietr@localhost:5432/qietr_indexer",
  "component_name": "geyser-devnet"
}
```

Schema bootstrap (apply once before starting the plugin):

```bash
psql "$DATABASE_URL" -f ../db/schema.sql
```

## What it indexes

| Trigger | Source | Postgres table |
|---|---|---|
| `update_account` on `Denomination` | Anchor discriminator `0xff5ff6...` | `denominations` (upsert) |
| `update_account` on `MerkleTree` | Anchor discriminator `0x623333...` | `roots` (upsert by `leaf_count`) |
| `update_account` on `NullifierRecord` | Anchor discriminator `0x381239...` | `nullifiers` (insert) |
| `notify_transaction` ix matching `global:deposit` | First 8 bytes of ix data | `commitments` (insert) |
| `update_slot_status` = `Rooted` | Geyser callback | `ingest_progress` (upsert) |

`commitments.leaf_index` is derived from a per-denom counter the plugin maintains in memory, seeded from the latest `MerkleTree.next_leaf_index` observed in `update_account`. This is correct for monotonic, finalized ingest. **Fork rollbacks are not handled**; on plugin restart the counter re-seeds from chain state, which is sufficient for our append-only tree. A full re-sync workflow against `getSignaturesForAddress(pool_program_id, before=..)` is a separate workstream.

## Architecture

Geyser callbacks fire on the validator's banking thread. Blocking them on Postgres I/O would risk slot delays, so the plugin uses a non-blocking pattern:

```
validator banking thread
        │
        ▼  (try_send into bounded channel — drops with log on overflow)
   crossbeam-channel
        │
        ▼
   writer worker thread  →  r2d2 sync postgres pool
```

`QUEUE_CAPACITY = 16_384` is sized to absorb a few seconds of busy-time. A full queue logs `write queue full, dropping event` and is the canonical signal that Postgres is the bottleneck.

## Tests

```bash
cargo test --lib    # 6/6 — locks in Anchor discriminator vectors
```

If the pool ever renames `PoolConfig` / `Denomination` / `MerkleTree` / `NullifierRecord`, these tests fail loudly — that's intentional, because a silent rename would skip every account write without erroring.

## Caveats

- **Toolchain pin.** `solana-geyser-plugin-interface = 1.18.26` because Agave 2.x rebrands to `agave-geyser-plugin-interface`. Bump alongside the toolchain upgrade tracked in `../../SESSION_STATE.md`.
- **Postgres TLS.** `NoTls` is fine for in-VPC deployments. For managed Postgres (RDS, Supabase), swap to `postgres-native-tls` and pass a CA bundle via `DB_TLS_CA`.
- **Metrics.** Drop counters and queue depth are only logged today. Wire to Prometheus once we run a stack in front of `qietr-indexer-api`.
