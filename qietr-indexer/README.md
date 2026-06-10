# qietr-indexer

Off-chain indexer for the [Qietr](../README.md) shielded payments protocol.

**Status:** implemented. API routes query Postgres with real SQL. Geyser plugin compiles to DLL. Requires `DATABASE_URL` to run.

## Components

```
qietr-indexer/
  geyser-plugin/      # Rust .so loaded by the Solana validator
    Cargo.toml
    src/lib.rs        # AccountUpdate + Transaction hooks → Postgres
  api/                # Node/Fastify HTTP server
    package.json
    tsconfig.json
    src/
      index.ts                    # server bootstrap
      db.ts                       # pg pool stub
      routes/
        denominations.ts          # GET /denominations
        merkle-proof.ts           # GET /merkle-proof
        nullifier-status.ts       # GET /nullifier-status
  db/
    schema.sql        # CREATE TABLE statements
  docker-compose.yml  # local Postgres + test validator hints
```

## Data flow

```
+----------------------+        +-----------------+        +------------------+
|  Solana validator    |        |   Geyser        |        |   Postgres       |
|  qietr_pool program  +-------->   plugin .so    +-------->   commitments,   |
|  account writes      |        |  (this crate)   |        |   nullifiers,    |
|  + program logs      |        +-----------------+        |   roots, tiers   |
+----------------------+                                   +--------+---------+
                                                                    |
                                                                    v
                                                         +----------+-----------+
                                                         |   Fastify API        |
                                                         |   /denominations     |
                                                         |   /merkle-proof      |
                                                         |   /nullifier-status  |
                                                         +----------------------+
```

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/denominations` | Current tiers, vault balances, deposit counts. |
| `GET` | `/merkle-proof?denomId=X&commitment=Y` | Path elements + indices for `commitment` against the most recent root in the 30-root window. |
| `GET` | `/nullifier-status?denomId=X&nullifierHash=Y` | `{ spent: bool, slot?: number }`. Used by the SDK for UX warnings before attempting a withdraw. |

All read endpoints sit behind Cloudflare with `stale-while-revalidate`.

## Local dev

```bash
docker compose up -d postgres
psql $DATABASE_URL -f db/schema.sql

# Build the Geyser plugin
cd geyser-plugin && cargo build --release
# → target/release/qietr_indexer_geyser.dll  (Windows)
# → target/release/libqietr_indexer_geyser.so (Linux)

# Run the API
cd ../api && npm install && npm run dev
# → tsc + node — server starts on port 4040
```

## Security posture

- The indexer only sees public on-chain data. Nothing is private here.
- No write endpoints. Everything is `GET`. Mutations happen on-chain via the pool program.
- No PII collected. Request logs strip query strings before persistence; `nullifierHash` lookups are anonymous.
- Rate limits: per-IP at the edge (Cloudflare). Higher per-API-key tier for first-party services (relayer, web app).

## Next pass

1. API integration tests against Postgres in CI.
2. Caching headers on read endpoints; Cloudflare config.
