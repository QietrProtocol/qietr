# Local Setup — running the full Qietr stack

This is the single source for standing up Qietr locally. It covers prerequisites,
build order, ports, `.env` templates, and one end-to-end command. If you only want
to use the SDK against the **devnet** deployment, you can skip the program/indexer
sections and point the SDK at the public devnet addresses in the root README.

## 1. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | **20+** | All TS packages declare `engines.node >= 20`. |
| Rust | stable (1.96+) | For the Anchor programs and the geyser plugin. |
| Agave (Solana) | **4.0.2** | The pinned toolchain; other versions break `anchor build`. |
| Anchor | CLI 0.30.1 ok; `anchor-lang`/`anchor-spl` **0.31.1** in `Cargo.toml` | See `qietr-pool/README.md`. |
| circom | 2.1+ | Only needed to rebuild circuits; `.wasm`/`.zkey` are committed. |
| PostgreSQL | 14+ | For the indexer API. |

> `groth16-solana` must be **0.2.0**. These pins are load-bearing — see the
> toolchain notes in `qietr-pool/README.md`.

## 2. What talks to what

```
 deposit/pay (SDK)
        │
        ▼
  qietr-pool  ──(account + tx updates)──►  geyser-plugin ──► Postgres ──► indexer API
   (program)                                                                  │
        ▲                                                                     │ merkle-proof
        │  gasless fee-payer                                                  ▼
   qietr-relayer  ◄──────────────────────────────────────────────────────  SDK builds proof
```

Default ports:

| Service | Port |
|---------|------|
| Indexer API | `4040` |
| Relayer | `4080` |
| Web | `3000` |

## 3. Build order

Dependencies flow bottom-up; build in this order:

```bash
# 1. Circuits (artifacts are committed; only rebuild if you change the circuit)
cd qietr-circuits && npm ci && npm test

# 2. Programs
cd ../qietr-pool   && anchor build
cd ../qietr-escrow && anchor build

# 3. SDK (depends on committed prover .wasm/.zkey)
cd ../qietr-sdk && npm ci && npm run build && npm test

# 4. Relayer
cd ../qietr-relayer && npm ci && npm run build

# 5. Indexer — geyser plugin + API
cd ../qietr-indexer/geyser-plugin && cargo build --release
cd ../api && npm ci && npm run build
```

The prover `qietr_payment.wasm` and `qietr_payment_final.zkey` **are committed**;
you do not need to run a trusted setup to develop. (The committed key is the
single-contributor **dev VK** — never use it for real funds.)

## 4. Configuration

Copy the example env files and fill them in:

```bash
cp qietr-relayer/.env.example qietr-relayer/.env
cp qietr-web/.env.example     qietr-web/.env
```

Indexer API needs `DATABASE_URL`:

```bash
export DATABASE_URL="postgres://qietr:qietr@localhost:5432/qietr"
psql "$DATABASE_URL" -f qietr-indexer/db/schema.sql
```

The SDK is configured in code (no `.env`): pass `cluster`, `indexerUrl`
(e.g. `http://localhost:4040`), `proverPath` (base URL hosting the `.wasm`/`.zkey`),
and optionally `relayerUrl` (`http://localhost:4080`).

### Relayer security note

In production set `API_KEY`, run behind a proxy with `TRUST_PROXY=true`, and bind
to a private interface. The relayer logs a loud warning if it starts on `0.0.0.0`
with no API key. A configured `SANCTIONS_LIST` that fails to load is fail-closed —
the relayer refuses to start.

## 5. Running

```bash
# Terminal 1 — indexer API
cd qietr-indexer/api && DATABASE_URL=... npm start        # :4040

# Terminal 2 — relayer
cd qietr-relayer && npm start                              # :4080

# Terminal 3 — web (optional)
cd qietr-web && npm run dev                                # :3000
```

The geyser plugin is loaded by a validator via its config JSON
(`--geyser-plugin-config`). For local indexing you need a validator running the
plugin against your pool program; see `qietr-indexer/geyser-plugin/README.md`.

## 6. One end-to-end check (devnet)

The pool ships a scripted deposit → pay → withdraw against devnet:

```bash
cd qietr-pool
npx tsx scripts/devnet-e2e.mts          # full happy-path e2e
npx tsx scripts/devnet-smoke.mjs        # quick read-only state probe
```

These require a funded devnet keypair and the public devnet addresses in the
root README. They are the closest thing to a "does the whole thing work" button.
