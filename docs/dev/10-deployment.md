# Deployment Plan — Qietr Devnet

**Phase F of IMPLEMENTATION_PLAN.md**

## F1 — Deploy pool program to devnet

### Prerequisites

- Solana CLI configured for devnet (`solana config set --url devnet`)
- Devnet wallet with SOL (use `solana airdrop 5`)
- `anchor build` producing `target/deploy/qietr_pool.so`

### Steps

1. **Rotate program keypair**

   Current placeholder: `2zaHsJNoZ1adQtecG7yRv1NCCVzaX3yaRD6CeQBQimVc`

   ```bash
   solana-keygen new --no-bip39-passphrase -o target/deploy/qietr_pool-keypair.json
   ```

   Extract new pubkey:
   ```bash
   solana-keygen pubkey target/deploy/qietr_pool-keypair.json
   ```

2. **Update `declare_id!`** in `programs/qietr_pool/src/lib.rs` with the new pubkey.

3. **Update `Anchor.toml`**:
   ```toml
   [programs.devnet]
   qietr_pool = "<NEW_PUBKEY>"
   
   [provider]
   cluster = "devnet"
   ```

4. **Rebuild**:
   ```bash
   anchor build
   ```

5. **Deploy**:
   ```bash
   anchor deploy --provider.cluster devnet
   ```

6. **Initialize pool**:
   ```bash
   node scripts/devnet-smoke.mjs
   ```
   This script creates a test mint, initializes PoolConfig + denominations, deposits, and withdraws.

## F2 — Host circuit artifacts on Cloudflare R2

### Bucket structure

Bucket: `qietr-circuits`

```
circuits.qietr.com/
  qietr_payment.wasm              # WASM witness generator
  qietr_payment_dev.zkey          # Dev proving key (replace with ceremony key for mainnet)
  qietr_payment_vk.json           # Verifying key JSON
```

### Upload via wrangler

```bash
npx wrangler r2 object put circuits-qietr/qietr_payment.wasm \
  --file ../qietr-circuits/build/qietr_payment_js/qietr_payment.wasm

npx wrangler r2 object put circuits-qietr/qietr_payment_dev.zkey \
  --file ../qietr-circuits/keys/qietr_payment_dev.zkey

npx wrangler r2 object put circuits-qietr/qietr_payment_vk.json \
  --file ../qietr-circuits/keys/qietr_payment_dev_vk.json
```

### DNS

Create `circuits.qietr.com` CNAME pointing to the R2 bucket endpoint.

### SDK integration

The SDK fetches artifacts from `https://circuits.qietr.com/{filename}` by default.
Override via `QietrSDKConfig.proverPath`.

## F3 — Deploy web app to Cloudflare Pages

### Build

```bash
cd qietr-web
npm run build
# Output: out/
```

### Deploy via wrangler

```bash
npx wrangler pages deploy out/ --project-name=qietr-web
```

### Environment variables

Set in Cloudflare Pages dashboard:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_QIETR_CLUSTER` | `devnet` or `mainnet-beta` |
| `NEXT_PUBLIC_QIETR_RPC_URL` | Solana RPC URL |

### Custom domain

- `qietr.com` → Cloudflare Pages project
- Configure CSP headers via `_headers` file in `out/`
- Enable SRI for snarkjs CDN script

### CSP headers (`out/_headers`)

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.solana.com https://*.rpcpool.com; img-src 'self' data:; worker-src 'self' blob:
```

### Indexer + Relayer deployment

Not part of the initial static-site deploy. Run as separate services:

- **Indexer API**: Node/Fastify behind Cloudflare, connects to RDS Postgres
- **Relayer**: Node/Fastify behind Cloudflare, requires fee-payer keypair
- **Geyser plugin**: Runs alongside Solana validator, writes to Postgres
