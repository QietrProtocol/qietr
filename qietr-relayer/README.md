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

1. **Rate limit** — sliding window per IP (default: 30 / 10 min) and per recipient ATA (default: 10 / 10 min). Higher limits via API key.
2. **Sanctions screening** — recipient ATA owner pubkey is checked against the public blocklist. Rejections logged with a generic 403; no list-membership info leaked.
3. **Tier check** — `denom_id` must match a configured tier; transaction size must be within bounds.
4. **Replay window** — same tx signature rejected within 30s window (Kora handles full replay; this is local rate-limiter belt-and-braces).

The pool program itself remains unfiltered. The relayer is an OPT-IN service users can swap out — running your own Kora instance with no policy layer is fully supported.

## Local dev

```bash
cp .env.example .env       # set KORA_URL, FEE_PAYER_KEYPAIR, etc.
npm install
npm run dev                # tsc + node — server starts on port 4041
```

## Security posture

- **No custody.** The relayer never holds USDC. It only pays SOL fees and forwards txs.
- **Fee-payer keypair** is hot-wallet by necessity. Lives in an HSM in prod. Rotated quarterly.
- **Logs strip** request bodies and signatures; only metadata (timestamp, denom_id, response code) persists.
- **API keys** are coarse (no per-user secrets) — they raise rate-limit ceilings, not unlock anything sensitive.

## Next pass

1. Prometheus metrics on accept/reject reasons.
2. Production deployment behind Cloudflare.
