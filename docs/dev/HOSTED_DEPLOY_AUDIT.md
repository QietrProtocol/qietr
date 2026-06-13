# Hosted devnet deploy — audit & handoff (2026-06-13)

Status snapshot for continuing the "make the preview web UI submit real devnet
deposits" work after a context reset. Read this top-to-bottom; it captures what
is DONE + VERIFIED, the bug currently being fixed, and the exact next steps.

---

## 0. Goal

Turn the hosted web UI (qietr.com) from a "preview" (SDK returns null when
indexer/prover env unset) into a functional devnet app: deposit → pay →
withdraw, proving in-browser. **Devnet only, not audited, dev proving key** —
those disclaimers stay.

## 1. Architecture (final, geyser-free)

```
Vercel: qietr.com (Next.js static export)  ──/circuits──► bundled WASM + zkey (same origin)
       │  fetch /merkle-proof, /denominations, /nullifier-status
       ▼
  Indexer API + poller (Render, ONE container via serve.mjs supervisor)
       ▲ reads          │ writes
       │                ▼
       └──────── Neon Postgres (project restless-lake-51168245, db neondb)
                        ▲
                        │ getProgramAccounts + getSignaturesForAddress
                        │
               Helius devnet RPC (poller pulls deposit + withdraw leaves)
```

- **DB** = Neon. **Indexer host** = Render free web service (Koyeb abandoned — it
  now forces a credit card). **Web** = Vercel (already deployed, custom domain
  qietr.com). All free, no card.

## 2. Live endpoints / resources

| Thing | Value |
|---|---|
| Web | https://qietr.com |
| Indexer (Render) | https://qietr-indexer.onrender.com |
| Neon project id | `restless-lake-51168245` (db `neondb`, host `ep-billowing-paper-ahbxtxgm.c-3.us-east-1.aws.neon.tech`) |
| Pool program (devnet) | `4XH6f74UFTvqx4j9UarXGrRZRrAwbnNNsRFBTfNqmWib` |
| Helius RPC | `https://devnet.helius-rpc.com/?api-key=34305fd0-...` |

> Render free web service **sleeps after ~15 min idle**, wakes on next request
> (~30s cold start). Poller resumes from its Postgres checkpoint on wake.

## 3. What is DONE + VERIFIED (via curl / Neon MCP)

- ✅ Neon schema applied (5 tables: denominations, commitments, roots,
  nullifiers, ingest_progress).
- ✅ Poller ingests real devnet data. Decode is a 1:1 port of the geyser
  plugin (`qietr-indexer/poller/src/decode.ts`), locked by
  `test/decode.test.mjs` (10/10 pass).
- ✅ **Critical bug found + fixed:** a `withdraw` also appends a leaf (the
  change commitment = `public_signals[5]`, qietr-pool lib.rs:293). The original
  poller (and the geyser plugin) only indexed `deposit` commitments, so the
  reconstructed tree diverged from chain. Fixed: `parseWithdrawIx` (offset
  8+1+32+256+5*32 = 457; PROOF_BYTES=256, PUBLIC_SIGNAL_COUNT=6) + interleaved
  deposit/withdraw replay oldest-first + value-dedup for idempotent re-scans.
  **VERIFIED end-to-end on devnet: API `/merkle-proof` computed root == on-chain
  root for a 2-leaf tree, and `leaves == on-chain next_leaf_index` for all denoms.**
  NOTE: the Rust geyser plugin still has this bug (out of scope for the
  geyser-free path; flag if anyone runs the validator path).
- ✅ Account sync writes denominations BEFORE roots/nullifiers (FK order).
- ✅ Neon TLS: `qietr-indexer/api/src/ssl.ts` auto-enables SSL on `sslmode=require`.
- ✅ CORS: `@fastify/cors` on the API. Verified `qietr.com` origin allowed.
- ✅ Combined container: `qietr-indexer/serve.mjs` supervises API + poller;
  `qietr-indexer/Dockerfile` builds both; `render.yaml` blueprint deploys it.
- ✅ Circuit artifacts bundled at `qietr-web/public/circuits/`
  (`qietr_payment.wasm` 2.4MB, `qietr_payment_final.zkey` 3.3MB = renamed dev
  zkey, `qietr_payment_vk.json`). Served same-origin via `PROVER_PATH=/circuits`.
  Verified HTTP 200 on qietr.com.
- ✅ Vercel env vars baked into the deployed build (verified `onrender.com` +
  `helius-rpc.com` present in shipped JS chunks).
- ✅ `/health`, `/denominations`, `/merkle-proof` all return correct data from
  Render.

## 4. CURRENT BUG — UI not interactive (root cause found, fix in progress)

**Symptom:** qietr.com loads but nothing is clickable — wallet connect / forms
/ buttons dead.

**Root cause:** the CSP `script-src` was `'self' 'wasm-unsafe-eval'` — missing
`'unsafe-inline'`. Next.js static export injects inline `<script>` tags
(`self.__next_f.push(...)`) to pass hydration data. Strict CSP blocked them, so
React never hydrated → the page stayed a static shell. Confirmed: homepage has
5 inline `<script>` tags + `__next_f`, blocked by the policy.

**Fix applied (UNCOMMITTED at time of writing):** added `'unsafe-inline'` to
`script-src` in BOTH `vercel.json` and `qietr-web/public/_headers`. New value:

```
script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'
```

> Trade-off: `'unsafe-inline'` weakens XSS hardening. Acceptable for a devnet
> demo. The cleaner long-term fix is nonce/hash-based CSP, which a static export
> can't easily do (no server to mint per-request nonces). Revisit before any
> mainnet/production posture.

## 5. NEXT STEPS (do these after context reset)

1. **Commit + push** the CSP fix (vercel.json + _headers). Currently uncommitted:
   - `M vercel.json`, `M qietr-web/public/_headers`, `M .mcp.json`
   - Also untracked: `AGENTS.md` (decide if it should be committed/ignored).
2. Vercel auto-redeploys on push (or Redeploy manually). Wait for it to finish.
3. **Re-test in a real browser** (curl can't catch hydration):
   - Open https://qietr.com/app/deposit → "preview" banner should be GONE.
   - Open DevTools Console — should be NO CSP violation errors.
   - Connect a devnet wallet (Phantom/Solflare), deposit, then pay/withdraw.
4. If buttons still dead after the fix:
   - Check Console for remaining CSP blocks (tighten the specific directive).
   - Verify wallet-adapter mounts: `WalletAdapterProvider` wraps in
     `app/layout.tsx`; `autoConnect=false` is intentional.
   - Confirm hydration isn't crashing on an SDK import (the SDK pulls snarkjs;
     check for a browser polyfill / `Buffer` issue in console).

## 6. Key files (for fast re-orientation)

| File | Role |
|---|---|
| `qietr-indexer/poller/src/{index,decode,db,rpc,config}.ts` | RPC poller |
| `qietr-indexer/poller/test/decode.test.mjs` | decode parity tests (10/10) |
| `qietr-indexer/serve.mjs` | supervises API + poller in one container |
| `qietr-indexer/Dockerfile` | combined build (context = `qietr-indexer`) |
| `qietr-indexer/api/src/{index,db,ssl}.ts` | API + CORS + Neon TLS |
| `render.yaml` | Render blueprint (secrets sync:false) |
| `vercel.json` | build + headers/CSP (Vercel ignores `public/_headers`) |
| `qietr-web/app/_lib/use-sdk.ts` | SDK init; returns null → "preview" |
| `qietr-web/app/_components/WalletAdapterProvider.tsx` | wallet context |
| `qietr-web/.env.production.local` | gitignored; Vercel env values |
| `docs/getting-started/HOSTED_DEPLOY.md` | full deploy walkthrough |

## 7. Env vars reference

Render service (`qietr-indexer`): `SOLANA_RPC_URL`, `DATABASE_URL` (Neon direct,
non-`-pooler`, `sslmode=require`), `CORS_ORIGINS` (currently `*`).

Vercel (build-time, `NEXT_PUBLIC_*`): `QIETR_CLUSTER=devnet`,
`QIETR_RPC_URL`=Helius, `QIETR_INDEXER_URL=https://qietr-indexer.onrender.com`,
`QIETR_PROVER_PATH=/circuits`.

## 8. Open / deferred

- Geyser plugin has the same withdraw-change-commitment bug (unfixed; not used
  in the hosted path).
- Two stray Render "Key Value" (Redis) instances were created by mistake — NOT
  used by anything; delete them in the Render dashboard.
- `'unsafe-inline'` CSP — revisit with nonce/hash for production.
