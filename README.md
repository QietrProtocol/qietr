<p align="center">
  <img src="https://raw.githubusercontent.com/QietrProtocol/.github/main/assets/brand/qietr-logo.svg" alt="Qietr" width="120" />
</p>

<h1 align="center">Qietr</h1>

<p align="center">
  <em>Zero-knowledge privacy layer for HTTP 402 micropayments on Solana.</em>
  <br />
  Pay for APIs, content, and metered services in USDC — without revealing identity, history, or balance.
</p>

<p align="center">
  <a href="#architecture">Architecture</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#subprojects">Subprojects</a> •
  <a href="#docs">Docs</a> •
  <a href="#license">License</a>
</p>

---

## What is Qietr?

Qietr lets AI agents and humans pay for APIs, content, and metered services privately. It wraps **HTTP 402 (x402)** micropayments in a zero-knowledge pool:

| | x402 (plain) | Qietr (private) |
|---|---|---|
| **Flow** | Alice → Bob | Pool → Bob |
| **Linkability** | Everyone sees Alice paid Bob | Bob sees payment, cannot identify Alice |
| **Privacy** | None | Anonymity set + ZK proof |

## Architecture

```
qietr/
├── qietr-circuits/    # Circom ZK circuits (Poseidon + Groth16 over BN254)
├── qietr-pool/        # Anchor program — Merkle tree, deposit, withdraw, Groth16 verifier
├── qietr-sdk/         # TypeScript SDK — notes, proofs, relayer client, x402 helper
├── qietr-relayer/     # Fastify server — gasless deposits, fee management, sanctions
├── qietr-indexer/     # Geyser plugin + Fastify API — on-chain state indexer
├── qietr-web/         # Next.js app — wallet adapter, deposit/pay UI, note manager
├── qietr-msg/         # Anchor program — encrypted off-chain messaging
└── qietr-escrow/      # Anchor program — job escrow with CPI token transfer
```

### How it works

1. **Deposit** — User deposits USDC into a shielded pool. A ZK note (secret + nullifier + commitment) is generated client-side.
2. **Pay** — User proves ownership of a note via Groth16 proof and submits a withdrawal to the merchant's address. The proof reveals only the nullifier — no link to the depositor.
3. **Relay** — A relayer optionally covers Solana tx fees (gasless deposit) and earns fees.

## Quick Start

```bash
# Install SDK
npm install @qietr/sdk

# Generate a note and deposit
import { QietrSDK } from "@qietr/sdk";

const sdk = new QietrSDK({
  rpcUrl: "https://api.devnet.solana.com",
  programId: "RrG8g32Kuo2tfbG8swwgYweDRtdKpTjpUxKT4RnEWLb",
});

const note = await sdk.deposit({
  amountMicroUsdc: "10000000", // 10 USDC
});
```

## Subprojects

| Subproject | Stack | State |
|---|---|---|
| `qietr-circuits` | Circom + snarkjs | Compiled, dev keys ready — 6/6 tests |
| `qietr-pool` | Anchor + Groth16 | 7 instructions, Merkle tree — cargo check clean |
| `qietr-sdk` | TypeScript | Deposit/pay/wrapFetch, Poseidon + note encryption — 38/38 tests |
| `qietr-relayer` | Fastify + Kora | Gasless deposits, rate-limiter, sanctions — tsc clean |
| `qietr-indexer` | Rust Geyser + Fastify | On-chain event indexer, Postgres — tsc clean |
| `qietr-web` | Next.js + Wallet Adapter | 12 routes, static export — build clean |
| `qietr-msg` | Anchor | Encrypted messaging PDA |
| `qietr-escrow` | Anchor | Job escrow with CPI token transfers |

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

## Status

Implementation complete and ready for **devnet rollout**. All subprojects type-check and pass tests.

## License

MIT — see [LICENSE](LICENSE).

---

<p align="center">© 2026 Qietr Protocol</p>
