<h1 align="center">Qietr</h1>

<p align="center">
  <strong>Zero-knowledge privacy layer for HTTP 402 micropayments on Solana.</strong>
  <br />
  Pay for APIs, content, and metered services in USDC — without revealing your identity, history, or balance.
</p>

<p align="center">
  <a href="#what-is-qietr">Overview</a> •
  <a href="#how-it-works">How it works</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#quick-start">Quick start</a> •
  <a href="#deployment-status">Status</a> •
  <a href="#docs">Docs</a>
</p>

<p align="center">
  <em>Status: live on Solana devnet · not yet audited · not on mainnet</em>
</p>

---

## What is Qietr?

The web is gaining a native payment rail: **HTTP 402 (x402)** lets a server demand
a stablecoin payment before returning a response. It is ideal for AI agents paying
for APIs, tools, and data on the fly. But a naive x402 payment is fully public —
anyone watching the chain sees exactly who paid whom, when, and how much.

Qietr fixes that. It wraps x402 micropayments in a **zero-knowledge shielded pool**:
users deposit USDC into a common pool, then pay merchants by proving — in zero
knowledge — that they own an unspent deposit, without revealing which one. The
merchant gets paid and verifies the payment; they learn nothing about the payer.

| | x402 (plain) | Qietr (shielded) |
|---|---|---|
| **Payment flow** | Alice → Bob | Pool → Bob |
| **Linkability** | Everyone sees Alice paid Bob | Bob sees a valid payment, cannot identify Alice |
| **Privacy set** | None | Every same-tier depositor (see caveat below) |
| **Proof** | — | Groth16 zk-SNARK over BN254 |

> **Privacy caveat (honest disclosure).** The anonymity set is *per denomination tier*
> (0.1 / 1 / 10 / 100 USDC), not the whole pool — a spend is indistinguishable only
> among deposits of the same tier. Moreover, a **partial spend** mints a non-tier
> **change note** into the same tree in the same transaction. An observer can link
> `spend nullifier X → change leaf created in the same tx`, so the change note and its
> future lineage are correlatable with that spend. To stay in the full anonymity set,
> spend a whole denomination (no change) or re-deposit change as a fresh tier note.
> See [`docs/dev/PRIVACY.md`](docs/dev/PRIVACY.md) for the full model and roadmap.

## How it works

1. **Deposit** — A user deposits a fixed denomination of USDC (0.1 / 1 / 10 / 100)
   into the shielded pool. The client generates a secret note (secret + nullifier),
   and only its Poseidon **commitment** is published on-chain and inserted into a
   Merkle tree. The link between the depositor and the commitment never leaves the
   device.
2. **Pay** — To pay a merchant, the client builds a Groth16 proof that it knows a
   secret behind *some* leaf in the Merkle tree, and reveals only a **nullifier**
   (which prevents double-spends). The on-chain program verifies the proof and
   releases funds to the merchant. No link to the original deposit is revealed.
3. **Relay (optional)** — A relayer can pay the Solana transaction fee on the
   user's behalf (gasless deposits) so a fresh wallet never needs SOL, earning a
   configurable fee in return.

The same primitives power two agent-economy modules: **encrypted messaging**
(`qietr-msg`) and **job escrow** with on-chain dispute resolution (`qietr-escrow`).

## Architecture

```
qietr/
├── qietr-circuits/   # Circom ZK circuits — Poseidon hashing + Groth16 over BN254
├── qietr-pool/       # Anchor program — Merkle tree, deposit, withdraw, Groth16 verifier
├── qietr-sdk/        # TypeScript SDK — notes, proofs, relayer client, x402 helper
├── qietr-relayer/    # Fastify service — gasless deposits, fee logic, rate-limit, sanctions
├── qietr-indexer/    # Geyser plugin + Fastify API — indexes pool state into Postgres
├── qietr-web/        # Next.js app — wallet adapter, deposit/pay UI, note manager
├── qietr-msg/        # Anchor program — encrypted off-chain messaging
└── qietr-escrow/     # Anchor program — agent job escrow with CPI token transfers
```

## Quick start

> **Note:** `@qietr/sdk` is **not yet published to npm.** Build it from source
> until the first release lands.

```bash
git clone https://github.com/QietrProtocol/qietr
cd qietr/qietr-sdk
npm install
npm run build
npm test            # 100/100
```

```ts
import { QietrSDK } from "@qietr/sdk";

const sdk = new QietrSDK({
  cluster: "devnet",
  programId: "4XH6f74UFTvqx4j9UarXGrRZRrAwbnNNsRFBTfNqmWib",
  indexerUrl: "http://localhost:8080",   // your indexer-api instance
  proverPath: "./qietr-circuits/build",  // local prover artifacts
});

const note = await sdk.deposit({ amount: 10, payer: walletAdapter });
```

The SDK requires `indexerUrl` and `proverPath` — there are no hosted defaults yet.
See [`qietr-sdk/README.md`](qietr-sdk/README.md) for the full API.

## Deployment status

All three on-chain programs are **deployed and verified on Solana devnet**.
End-to-end flows — deposit, Groth16 withdraw, escrow lifecycle, and encrypted
messaging — have been exercised against the live programs.

### Programs (Solana devnet)

| Program | Program ID | Explorer |
|---|---|---|
| `qietr_pool` | `4XH6f74UFTvqx4j9UarXGrRZRrAwbnNNsRFBTfNqmWib` | [view](https://explorer.solana.com/address/4XH6f74UFTvqx4j9UarXGrRZRrAwbnNNsRFBTfNqmWib?cluster=devnet) |
| `qietr_escrow` | `DBLjgT9mCjTF3q7zqDCnUrMtHEnBarNwqmk7XojB4FNz` | [view](https://explorer.solana.com/address/DBLjgT9mCjTF3q7zqDCnUrMtHEnBarNwqmk7XojB4FNz?cluster=devnet) |
| `qietr_msg` | `6ZAeJCLRrNyMCLYgH5uUdRNbA5usAun94vPtaTM5Xdez` | [view](https://explorer.solana.com/address/6ZAeJCLRrNyMCLYgH5uUdRNbA5usAun94vPtaTM5Xdez?cluster=devnet) |

### Supporting addresses

| Role | Address |
|---|---|
| Upgrade authority (all 3 programs) | `GWxyJs7G9FPUY58UTtUSpVwFuXTRdXzneyBcekxmvuR4` |
| USDC mint (devnet) | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |
| `$QIET` token mint | _not minted yet_ |

Verify any program with `solana program show <ID> -u devnet`.

**Not yet done** (and not claimed):

- ❌ **Mainnet** — devnet only.
- ❌ **Security audit** — planned before any mainnet deployment.
- ❌ **Trusted-setup ceremony** — the pool currently ships the development `pot14`
  verifying key, which is **not production-safe**. A multi-party ceremony is
  required before mainnet.
- ❌ **Public web app / hosted prover / npm package** — run the web UI and prover
  locally for now.
- ❌ **$QIET token** — designed in the docs, not minted.

## Subprojects

| Subproject | Stack | State |
|---|---|---|
| `qietr-circuits` | Circom + snarkjs | Groth16 circuit compiled, dev keys — 6/6 tests |
| `qietr-pool` | Anchor + Groth16 | Live on devnet — 3/3 Rust tests, mocha suite |
| `qietr-sdk` | TypeScript | deposit / pay / wrapFetch, Poseidon + note encryption — 100/100 tests |
| `qietr-relayer` | Fastify + Kora | Gasless deposits, rate-limiter, sanctions — 6/6 auth tests |
| `qietr-indexer` | Rust Geyser + Fastify | Pool-state indexer into Postgres — 6/6 plugin tests |
| `qietr-web` | Next.js + Wallet Adapter | 15 static routes, deposit/pay/note/activity — builds clean |
| `qietr-msg` | Anchor | Encrypted messaging PDA — live on devnet |
| `qietr-escrow` | Anchor | Job escrow with CPI token transfers — live on devnet |

## Docs

| # | Document |
|---|----------|
| 01 | [Product Requirements](docs/dev/01-PRD.md) |
| 02 | [Technical Architecture](docs/dev/02-TRD.md) |
| 03 | [Backend Schema](docs/dev/03-backend-schema.md) |
| 04 | [User Workflows](docs/dev/04-user-workflows.md) |
| 05 | [UI/UX Design](docs/dev/05-uiux.md) |
| 06 | [Tokenomics](docs/dev/06-tokenomics.md) |
| 07 | [Brand](docs/dev/07-brand.md) |
| 08 | [Security & Risk](docs/dev/08-security-risks.md) |
| 09 | [Roadmap](docs/dev/09-roadmap.md) |
| 10 | [Deployment](docs/dev/10-deployment.md) |
| 11 | [Trusted Setup](docs/dev/11-trusted-setup.md) |
| 12 | [Cross-Chain](docs/dev/12-cross-chain.md) |
| 13 | [Agent Ecosystem](docs/dev/13-agent-ecosystem.md) |

## Security

Qietr is **pre-audit** software deployed on devnet for testing. Do not use it with
real funds. The shielded pool's privacy guarantees depend on a trusted-setup
ceremony that has **not** yet been performed. Report vulnerabilities to
security@qietr.com.

## License

MIT — see [LICENSE](LICENSE).

---

<p align="center">© 2026 Qietr Protocol</p>
