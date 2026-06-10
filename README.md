# Qietr

> Privacy infrastructure for autonomous AI agents on Solana.

Qietr is a zero-knowledge privacy layer for HTTP 402 (x402) micropayments on Solana. Agents and humans can pay for APIs, content, and metered services in USDC without revealing identity, transaction history, or balance.

## Documents

| # | Document | Purpose |
|---|----------|---------|
| 01 | [PRD](docs/01-PRD.md) | Product vision, scope, success metrics |
| 02 | [TRD](docs/02-TRD.md) | Technical architecture and protocol design |
| 03 | [Backend Schema](docs/03-backend-schema.md) | On-chain accounts and off-chain service schemas |
| 04 | [User Workflows](docs/04-user-workflows.md) | End-to-end user and agent flows |
| 05 | [UI/UX](docs/05-uiux.md) | Design system and screens |
| 06 | [Tokenomics](docs/06-tokenomics.md) | $QIET supply, distribution, utility |
| 07 | [Brand](docs/07-brand.md) | Identity, voice, visual rules |
| 08 | [Security & Risk](docs/08-security-risks.md) | Threat model, audits, mitigations |
| 09 | [Roadmap](docs/09-roadmap.md) | Phased milestones |

## Status

Implementation complete. Ready for devnet rollout.

| Subproject | State | Tests |
|------------|-------|-------|
| `qietr-circuits` | Real circom circuit, compiled, dev keys generated | 6/6 pass |
| `qietr-pool` | Anchor program, 7 instructions, Merkle tree + Groth16 verifier | cargo check clean |
| `qietr-sdk` | Deposit/pay/wrapFetch with Poseidon + note encryption | 38/38 pass |
| `qietr-relayer` | Fastify server, Kora client, rate-limiter, sanctions | tsc clean |
| `qietr-indexer` | Geyser plugin + Fastify API with Postgres queries | tsc clean |
| `qietr-web` | Next.js static export, 12 routes, wallet adapter | build clean |

## License

MIT — see [LICENSE](LICENSE) for details.

---

© 2026 Qietr Protocol. All rights reserved.
