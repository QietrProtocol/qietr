# Hosted deploy — making the web UI submit real devnet deposits

This turns the "preview" web UI into a live app that can deposit / pay / withdraw
against the **devnet** pool. It uses a geyser-free architecture so you need no
validator: a small RPC poller drains chain state into Postgres.

```
Vercel: qietr-web (static export)  ──/circuits──►  bundled WASM + zkey (same origin)
       │  fetch /merkle-proof, /denominations, /nullifier-status
       ▼
  Indexer API + poller (Koyeb, one container)
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
- A **Koyeb** account (free tier, no credit card) for the indexer service
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

## 2. Indexer (API + poller) — Koyeb (one free service, no card)

Koyeb's free tier is a single service, so the API and poller run **together**
in one container: `qietr-indexer/serve.mjs` supervises both children, and
`qietr-indexer/Dockerfile` builds them. The API serves HTTP on `$PORT` (which
Koyeb injects and health-checks); the poller drains chain → Postgres in the
background.

**Deploy from the Koyeb dashboard (GitHub):**

1. Create → Web Service → GitHub → this repo.
2. Build: **Dockerfile**, with **Work directory / build context = `qietr-indexer`**
   (so it picks up `qietr-indexer/Dockerfile`).
3. Environment variables (mark secrets as secret):

   | Variable | Value |
   |---|---|
   | `SOLANA_RPC_URL` | `https://devnet.helius-rpc.com/?api-key=YOUR_KEY` |
   | `DATABASE_URL` | `postgres://...neon.tech/neondb?sslmode=require` (use the **direct**, non-`-pooler` host) |
   | `CORS_ORIGINS` | `https://YOUR-PROJECT.vercel.app` (comma-separate extra origins) |

4. Health check: HTTP `GET /health`. Deploy.

Verify once it's live (replace with your Koyeb URL):

```bash
curl https://YOUR-SERVICE.koyeb.app/health           # {"ok":true}
curl https://YOUR-SERVICE.koyeb.app/denominations
```

On first run the poller backfills all history oldest-first, assigning
`leaf_index` 0,1,2,… — counting **both** deposit commitments and withdraw
change commitments (both append a leaf on chain) — then tails new ones every 8s.

> **CLI alternative:** `npm i -g @koyeb/cli`, `koyeb login`, then
> `koyeb service create qietr-indexer --git github.com/QietrProtocol/qietr --git-branch main --git-builder docker --git-docker-dockerfile qietr-indexer/Dockerfile --git-workdir qietr-indexer --env SOLANA_RPC_URL=... --env DATABASE_URL=... --env CORS_ORIGINS=... --ports 4040:http --routes /:4040`.

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
| `NEXT_PUBLIC_QIETR_INDEXER_URL` | `https://YOUR-SERVICE.koyeb.app` |
| `NEXT_PUBLIC_QIETR_PROVER_PATH` | `/circuits` |
| `NEXT_PUBLIC_QIETR_RELAYER_URL` | *(optional — only if you deploy the relayer)* |

> `NEXT_PUBLIC_*` vars are baked at **build** time, so after changing them you
> must trigger a new deploy (push a commit or "Redeploy" in the dashboard).

### Important: CSP `connect-src`

`vercel.json` ships a Content-Security-Policy. Its `connect-src` already allows
`*.helius-rpc.com`, `*.solana.com`, `*.koyeb.app`, and `*.vercel.app`. If your
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

Neon free tier + one Koyeb free service (API + poller) + Vercel Hobby tier.
Effectively $0 for devnet traffic, no credit card.
