# qietr-relayer

Fee-payer for Qietr withdraw transactions. Wraps [Kora](https://github.com/solana-foundation/kora) with our rate-limiter and sanctions-screening policy layer.

**Status:** implemented. All routes live, rate-limiter + sanctions screening built, Kora client + direct RPC fallback. `tsc` clean.

## Why a relayer

Withdraw transactions need a SOL fee, but the burner pubkey deliberately has no SOL and no history. The relayer signs the SOL fee so the user's privacy isn't broken by the act of paying for the transaction. The user signs the withdraw instruction itself; the relayer signs only the fee component.

## Layout

```
qietr-relayer/
  package.json                  # @qietr/relayer, Fastify
  tsconfig.json
  src/
    index.ts                    # server entrypoint
    kora.ts                     # Kora HTTP client wrapper
    routes/
      submit.ts                 # POST /submit  — relay a signed withdraw tx
      quote.ts                  # GET  /quote   — show current fee / limits
    policy/
      rate-limit.ts             # per-IP + per-burner sliding window
      sanctions.ts              # ATA → blocklist check
  data/
    sanctions.example.txt       # placeholder; real list lives elsewhere
```

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/submit` | Body: `{ tx_base64, denom_id }`. Validates against policy, forwards to Kora with our fee-payer signature, returns the on-chain signature. |
| `GET` | `/quote` | Returns current fee bps, per-IP rate budget, supported denom_ids. |
| `GET` | `/health` | Liveness + fee-payer pubkey. |

## Policy layer

Before forwarding to Kora the relayer applies:

1. **Rate limit** — sliding window per IP (default: 20 / 60 s) and per recipient ATA (default: 10 / 60 s), tunable via env. Set `TRUST_PROXY=true` behind a proxy/CDN so the bucket keys on the real client IP.
2. **Sanctions screening** — recipient ATA owner pubkey is checked against a configured blocklist. Rejections logged with a generic 403; no list-membership info leaked. If a list is configured but fails to load, the relayer refuses to start (fail-closed).
3. **Tier check** — `denom_id` must match a configured tier.
4. **Replay defense** — the relayer hashes the raw tx and rejects a resubmission within `REPLAY_TTL_SECONDS` (default 120 s, > blockhash validity) with a 409, so a replay can't make the relayer pay fees for a tx that fails on-chain.
5. **Economic guards** — gasless deposits must pay the relayer's fee ATA at least the configured minimum (destination + amount are decoded and checked); the relayer refuses to forward (and spend SOL) when its fee-payer balance is below `MIN_BALANCE_LAMPORTS` or it has exceeded `MAX_TX_PER_WINDOW`. Auth uses a constant-time compare.

The pool program itself remains unfiltered. The relayer is an OPT-IN service users can swap out — running your own Kora instance with no policy layer is fully supported.

## Local dev

```bash
cp .env.example .env       # set FEE_PAYER_SECRET_KEY, KORA_URL, etc.
npm install
npm run dev                # tsx watch — server starts on port 4080 (PORT env)
```

## Security posture

- **No custody.** The relayer never holds USDC. It only pays SOL fees and forwards txs.
- **Fee-payer keypair** is hot-wallet by necessity. Lives in an HSM in prod. Rotated quarterly.
- **Logs strip** request bodies and signatures; only metadata (timestamp, denom_id, response code) persists.
- **API keys** are coarse (no per-user secrets) — they raise rate-limit ceilings, not unlock anything sensitive.

## Next pass

1. Prometheus metrics on accept/reject reasons.
2. Production deployment behind Cloudflare.
