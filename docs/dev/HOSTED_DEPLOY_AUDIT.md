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

## 4. CSP BUGS — FIXED + VERIFIED LIVE (headless Chromium, 2026-06-13)

Two separate CSP defects, both found and fixed. Verified with a headless
Chromium harness (Playwright) that loads `/` and `/app/deposit`, captures
`securitypolicyviolation` events + console/page errors, and proves hydration by
clicking a tier radio and asserting `aria-checked` moves.

**Bug 1 — UI not interactive (hydration). FIXED, committed `2f91cf9`, live.**
`script-src` was missing `'unsafe-inline'`; Next.js static export injects inline
`self.__next_f.push(...)` hydration scripts, which strict CSP blocked → React
never hydrated → static shell. Added `'unsafe-inline'`.
**VERIFIED:** clicking the "10 USDC" radio moves `aria-checked` to "0.1 USDC";
wallet-connect button renders (client-only); zero pageErrors.

**Bug 2 — in-browser prover blocked (eval). FIXED, committed `500d8a3`, live.**
`script-src` had only `'wasm-unsafe-eval'`, which permits WebAssembly compile but
NOT `eval()`/`new Function()`. snarkjs 0.7.x (ffjavascript) builds its field
arithmetic with `new Function`, so a `script-src 'eval'` violation fired on
`/app/deposit` (where the SDK+snarkjs chunk loads) — withdraw/pay proving would
have failed at runtime. Added `'unsafe-eval'`.
**VERIFIED:** the `eval` violation is gone after redeploy; hydration still works.

Current live value (both `vercel.json` and `qietr-web/public/_headers`, kept in sync):
```
script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'
```

> Trade-off: `'unsafe-inline'` + `'unsafe-eval'` weaken XSS hardening. Both are
> required for this static-export + in-browser-snarkjs design and are acceptable
> for a devnet demo. Cleaner long-term: nonce/hash CSP (needs a server) and/or a
> snarkjs build that avoids `eval`. Revisit before any mainnet posture.

**Remaining (intentional) violation:** the wallet-adapter UI CSS `@import`s
DM Sans from `fonts.googleapis.com`, which CSP blocks → one harmless console
warning + cosmetic fallback font in the wallet modal. **Deliberately NOT
allowed** — loading Google fonts would leak every visitor's IP to Google on a
privacy tool. Documented in `_headers`. Do not "fix" it.

## 5. NEXT STEPS

1. ~~Commit + push the CSP fixes.~~ DONE — `2f91cf9` (unsafe-inline) +
   `500d8a3` (unsafe-eval), both pushed and live on qietr.com.
   - Still uncommitted/untracked, UNRELATED to deploy: `M .mcp.json`,
     `?? AGENTS.md` (decide separately whether to commit/ignore).
2. ~~Wait for Vercel redeploy.~~ DONE — verified live (`unsafe-eval` in the
   served CSP header; eval violation gone in headless re-test).
3. **Human step — needs a funded devnet wallet (curl/headless can't sign):**
   Connect Phantom/Solflare on qietr.com, deposit a tier, then pay/withdraw.
   This is the only thing left to confirm the full money path + that snarkjs
   `fullProve` actually succeeds end-to-end (CSP no longer blocks it; artifacts
   serve 200; but a real witness needs a real deposited note).
   - NOTE: the `/app/deposit` "preview" `<Banner>` is **hardcoded copy**, not
     SDK-driven — it will NOT disappear when env is configured. Do not treat
     "banner gone" as a success signal. Interactivity (buttons fire) is the
     real signal, and it's verified. If you want the banner to reflect real
     config, make it conditional on `useQietrSdk() !== null`.
4. Headless verify harness lives in `%TEMP%/qietr-verify/verify.mjs` (Playwright
   + Chromium installed in the ms-playwright cache, ~150MB). Reusable for future
   re-checks; delete the cache if you want the disk back.

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
- `'unsafe-inline'` + `'unsafe-eval'` CSP — revisit with nonce/hash and/or an
  eval-free snarkjs build for production (see §4).
- Wallet-adapter DM Sans Google-font is intentionally CSP-blocked (privacy); if
  the cosmetic fallback ever matters, self-host the font instead of allowing
  `fonts.googleapis.com`.
