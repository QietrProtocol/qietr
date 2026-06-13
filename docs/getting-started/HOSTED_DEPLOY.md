# Hosted deploy — making the web UI submit real devnet deposits

This turns the "preview" web UI into a live app that can deposit / pay / withdraw
against the **devnet** pool. It uses a geyser-free architecture so you need no
validator: a small RPC poller drains chain state into Postgres.

```
Vercel: qietr-web (static export)  ──/circuits──►  bundled WASM + zkey (same origin)
       │  fetch /merkle-proof, /denominations, /nullifier-status
       ▼
  Indexer API + poller (Render, one container)
       ▲ reads          │ writes
       │                ▼
       └──────── Neon Postgres
                        ▲
                        │ getProgramAccounts + getSignaturesForAddress
                        │
               Helius devnet RPC (poller pulls deposit + withdraw leaves)
```

> ⚠️ **Devnet only, not audited, dev proving key.** This makes the UI *functional*,
> not production-safe. The bundled `qietr_payment_final.zkey` is the single-
> contributor dev key (`pot14`). Keep the "devnet / not audited" disclaimers up.

---

## Prerequisites

- A **Helius** devnet API key — `https://devnet.helius-rpc.com/?api-key=...`
- A **Neon** account (free serverless Postgres)
- A **Render** account (free tier, no credit card) for the indexer service
- A **Vercel** account (the web app is already deployed here via the root `vercel.json`)
- The pool is already deployed on devnet (`4XH6f74UFTvqx4j9UarXGrRZRrAwbnNNsRFBTfNqmWib`)
  and its denominations initialized. Verify with `cd qietr-pool && npx tsx scripts/devnet-smoke.mjs`.

---

## 1. Database — Neon

1. Create a Neon project → copy the connection string. It looks like:
   `postgres://user:pass@ep-xxx.region.aws.neon.tech/qietr?sslmode=require`
2. Apply the schema:

   ```bash
   psql "postgres://...neon.tech/qietr?sslmode=require" -f qietr-indexer/db/schema.sql
   ```

`sslmode=require` makes both the API and poller use TLS automatically.

## 2. Indexer (API + poller) — Render (free web service)

The API and poller run **together** in one container: `qietr-indexer/serve.mjs`
supervises both children, and `qietr-indexer/Dockerfile` builds them. The API
serves HTTP on `$PORT` (which Render injects and health-checks); the poller
drains chain → Postgres in the background. The repo ships a `render.yaml`
blueprint so Render configures everything automatically.

**Deploy from the Render dashboard:**

1. New → **Blueprint** → connect this GitHub repo. Render reads `render.yaml`
   and proposes a `qietr-indexer` web service on the **free** plan.
2. Click **Apply**. Render builds `qietr-indexer/Dockerfile`.
3. Open the service → **Environment** → set the three secret vars (they're
   `sync:false` in the blueprint, so not committed):

   | Variable | Value |
   |---|---|
   | `SOLANA_RPC_URL` | `https://devnet.helius-rpc.com/?api-key=YOUR_KEY` |
   | `DATABASE_URL` | `postgres://...neon.tech/neondb?sslmode=require` (use the **direct**, non-`-pooler` host) |
   | `CORS_ORIGINS` | `https://YOUR-PROJECT.vercel.app` (comma-separate extra origins) |

4. Save → Render redeploys with the secrets. The health check is `GET /health`.

Verify once it's live (replace with your Render URL):

```bash
curl https://qietr-indexer.onrender.com/health        # {"ok":true}
curl https://qietr-indexer.onrender.com/denominations
```

On first run the poller backfills all history oldest-first, assigning
`leaf_index` 0,1,2,… — counting **both** deposit commitments and withdraw
change commitments (both append a leaf on chain) — then tails new ones every 8s.

> **Free-tier sleep.** A Render free web service sleeps after ~15 min with no
> inbound request and wakes on the next hit (first request takes ~30s). The
> poller resumes from its Postgres checkpoint on wake, so indexing catches up
> automatically — fine for a devnet demo. For always-on real-time polling,
> upgrade the service to a paid instance.

> Set `CORS_ORIGINS` to your exact web origin(s). Leave unset (or `*`) to allow
> any origin — acceptable for this read-only, public-data API.

## 3. Web — Vercel

The web app is already wired for Vercel: the root `vercel.json` builds the SDK
then the static export (`outputDirectory: qietr-web/out`) and sets the security
+ CSP headers. Circuit artifacts are bundled in `qietr-web/public/circuits`, so
the prover path is the same-origin `/circuits` — no separate CDN needed.

You only need to set the **environment variables** in the Vercel project
(Settings → Environment Variables, Production) and redeploy:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_QIETR_CLUSTER` | `devnet` |
| `NEXT_PUBLIC_QIETR_RPC_URL` | `https://devnet.helius-rpc.com/?api-key=YOUR_KEY` |
| `NEXT_PUBLIC_QIETR_INDEXER_URL` | `https://qietr-indexer.onrender.com` |
| `NEXT_PUBLIC_QIETR_PROVER_PATH` | `/circuits` |
| `NEXT_PUBLIC_QIETR_RELAYER_URL` | *(optional — only if you deploy the relayer)* |

> `NEXT_PUBLIC_*` vars are baked at **build** time, so after changing them you
> must trigger a new deploy (push a commit or "Redeploy" in the dashboard).

### Important: CSP `connect-src`

`vercel.json` ships a Content-Security-Policy. Its `connect-src` already allows
`*.helius-rpc.com`, `*.solana.com`, `*.onrender.com`, and `*.vercel.app`. If your
indexer/relayer/RPC live on **other** domains (e.g. a custom domain), edit that
list in `vercel.json` before deploying or the browser will block the fetch.

> The Cloudflare-style `qietr-web/public/_headers` file is kept for reference
> but Vercel **ignores** it — Vercel reads headers from `vercel.json` only.

## 5. Verify end to end

1. Open the Vercel URL → **Deposit**. The "preview" banner should be gone
   (SDK initialized because indexer + prover are configured).
2. Connect a devnet wallet with test USDC, deposit into a tier.
3. Within ~10s the poller indexes the commitment; **Pay** can then build a proof
   (it fetches `/merkle-proof` and runs snarkjs in-browser) and submit a withdraw.

### Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Banner still says "preview" | `NEXT_PUBLIC_QIETR_INDEXER_URL` or `..._PROVER_PATH` not set at **build** time. Rebuild. |
| `/merkle-proof` → `commitment_not_found` | Poller hasn't ingested yet, or is down. `fly logs` on the poller. |
| `root_mismatch` / `ingest_gap` (500) | Leaf ordering bug — poller indexed deposits out of order. Wipe `commitments` for that denom and let the poller re-backfill. |
| Browser blocks indexer/RPC call | CSP `connect-src` in `vercel.json` doesn't list that host. |
| CORS error in console | Add the web origin to the API's `CORS_ORIGINS`. |
| RPC 429 / throttling | Public devnet RPC is rate-limited — use the Helius URL everywhere. |

## Cost

Neon free tier + one Render free web service (API + poller) + Vercel Hobby
tier. Effectively $0 for devnet traffic, no credit card.
