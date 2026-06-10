# Roadmap — Qietr

**Version:** 0.2 (implementation complete, devnet deploy pending)
**Status:** Phase 1 implementation complete. Ready for devnet.

This roadmap is realistic. Single-chain MVP on Solana with audit is a 4-6 month effort for a small focused team. We will not promise a faster timeline to please anyone.

---

## Phase 0 — Specification (complete)

**Goal:** approved planning documents that engineers can build from without re-deriving decisions.

Deliverables:

- [x] PRD ([01-PRD.md](01-PRD.md))
- [x] TRD ([02-TRD.md](02-TRD.md))
- [x] Backend schema ([03-backend-schema.md](03-backend-schema.md))
- [x] User workflows ([04-user-workflows.md](04-user-workflows.md))
- [x] UI/UX spec ([05-uiux.md](05-uiux.md))
- [x] Tokenomics ([06-tokenomics.md](06-tokenomics.md))
- [x] Brand ([07-brand.md](07-brand.md))
- [x] Security and risk ([08-security-risks.md](08-security-risks.md))
- [x] Roadmap (this document)

**Exit criteria:** documents reviewed and approved by founder. Repo created under `QietrProtocol` org.

---

## Phase 1 — Single-chain MVP build (complete)

**Goal:** end-to-end deposit + withdraw + x402 payment built and compiled. Ready for devnet deploy.

All six workstreams completed:

- **W1 — Circuits:** `qietr_payment.circom` (5,789 constraints), compiled to r1cs/wasm, dev zkey + VK generated. 6/6 tests passing.
- **W2 — Anchor program:** 7 instructions (initialize_pool, initialize_denomination, deposit, withdraw, set_paused, queue_vk_upgrade, apply_vk_upgrade). Groth16 verifier integrated. Merkle tree with Poseidon hashing. `cargo check` clean. Compiled `qietr_pool.so` (464 KB).
- **W3 — SDK:** Full deposit/pay/wrapFetch implementation. Note encryption (Argon2id + AES-256-GCM). Poseidon Merkle tree. 38/38 tests passing.
- **W4 — Indexer:** Geyser plugin compiled to DLL. Fastify API with three Postgres-backed routes (`/denominations`, `/merkle-proof`, `/nullifier-status`).
- **W5 — Web app:** 12 static routes. Wallet adapter (Phantom, Solflare). SDK integration. Note manager. Activity log. Static export build clean.
- **W6 — Relayer:** Fastify server with POST /submit, GET /quote, GET /health. Rate-limiter + sanctions screening + Kora client.

### Phase 1 remaining

- Deploy pool program to devnet (requires rotated program keypair + devnet SOL)
- Host circuit artifacts on Cloudflare R2
- Deploy web app to Cloudflare Pages
- Run end-to-end test on devnet

See [10-deployment.md](10-deployment.md) for detailed deployment instructions.

---

## Phase 2 — Testnet hardening and audit (weeks 11-20)

**Goal:** public testnet on Solana devnet with growing usage and audit clearance.

- **Week 11-12:** public testnet launch. Tweet, post to docs, no incentives yet.
- **Week 13-15:** observe usage, fix UX rough edges, harden proof-gen reliability.
- **Week 14-18:** external audit (Anchor program + circuits, parallel firms).
- **Week 18-19:** address audit findings, second-look review by audit firms.
- **Week 19-20:** publish audit reports, finalize bug bounty rules.

### Phase 2 exit criteria

- No unmitigated Critical or High audit findings.
- 500+ unique testnet deposits.
- Bug bounty live with documented scope.
- Trusted-setup ceremony transcript published with multi-party contributions.

---

## Phase 3 — Mainnet launch (weeks 21-26)

**Goal:** mainnet pool live with capped TVL, $QIET token launch.

- **Week 21:** internal mainnet deploy with capped tier limits.
- **Week 22:** soft launch — invite power users, low TVL caps, watch metrics.
- **Week 23:** raise caps in stages, observe.
- **Week 24:** $QIET TGE. Launch venue and exact mechanics finalized one week before TGE based on conditions.
- **Week 25:** revenue distributor activation; first epoch of fee distribution.
- **Week 26:** post-launch retrospective, public report.

### Phase 3 exit criteria

- Mainnet pool stable for two weeks at full caps.
- No security incidents above informational severity.
- Token distribution executed per published plan.
- Revenue distribution mechanism running.

---

## Phase 4 — Agent integrations and cross-chain (weeks 27-40)

**Goal:** Qietr is the default privacy layer in popular Solana agent frameworks; cross-chain payments to EVM in beta.

### Sub-tracks

- **Agent SDK adapters.** Native integrations with SendAI Agent Kit, Coinbase AgentKit on Solana, and one or two other notable frameworks. Each integration ships with a tutorial.
- **Cross-chain v1.** Attestor service design, second audit, devnet → testnet → mainnet beta. Initial pair: Solana ↔ Base. See [02-TRD.md §10](02-TRD.md).
- **Consolidation UX.** Multi-commitment merge with privacy-aware pacing.
- **Mobile-first UI.** Optimized flows for Phantom mobile, Solflare mobile.

### Phase 4 exit criteria

- At least three agent frameworks officially recommend Qietr in their docs.
- Cross-chain mainnet beta with capped TVL and audit clearance.

---

## Phase 5 — Beyond MVP (post-week 40)

Optional tracks, prioritized by usage data:

- Encrypted agent-to-agent messaging product (separate brand surface).
- Confidential SPL Token-2022 support, *if* the ZK ElGamal precompile ships and audits cleanly.
- Native mobile wallet.
- Hardware-wallet support for note signing.
- Additional anonymity primitives (e.g. per-tier deposit batching, shielded transfers between notes).
- Additional chains (Aptos, Sui, EVM L2s) — only if cross-chain v1 proves stable.

---

## Cadence and reporting

- **Weekly internal sync.** Cross-team status, blockers, demos.
- **Bi-weekly public update.** Short post on `docs.qietr.com/changelog` summarizing progress.
- **Monthly metrics report.** Public dashboard of testnet/mainnet usage, anonymity-set sizes, payment volume, with no personally identifying data.

---

## What we will not do

- Promise specific dates publicly before each phase begins. We commit to plans that are visible internally; external dates are given only as ranges, and we update them when reality shifts.
- Ship without an audit on mainnet.
- Bypass security findings to hit a date.
- Pivot to a token-price-driven roadmap.

---

## How to influence the roadmap

- Open issues on the relevant GitHub repo.
- Propose changes via GitHub Discussions on the `qietr-docs` repo.
- Vote on proposals once on-chain governance is live (Phase 3 onward).

The roadmap is a plan, not a contract. We will update it as the system, the team, and the market evolve.
