# PRD — Qietr

**Version:** 0.1 (spec phase)
**Status:** Draft for internal review
**Owner:** Qietr Protocol team

---

## 1. Summary

Qietr is a zero-knowledge privacy layer for HTTP 402 micropayments on Solana. Users and AI agents deposit USDC into a shielded pool in fixed denominations, then spend it to any merchant or x402 endpoint without revealing the link between deposit and payment. Recipients receive ordinary USDC at their wallet — no integration on their side is required.

The protocol is built on three open primitives:

- **x402** — the HTTP 402 payment standard popularized by Coinbase and Cloudflare.
- **Groth16 zero-knowledge proofs over BN254**, the same proving system used by widely deployed shielded-pool designs.
- **Solana** as the settlement layer, using SPL USDC, native `feePayer` sponsorship, and the `sol_alt_bn128_*` syscalls (via `groth16-solana`).

## 2. Problem

The HTTP 402 payment protocol is rapidly becoming the default rail for agent-to-API payments. Every payment is visible on-chain, linked to the agent's wallet, and trivially profileable. This creates three concrete problems:

1. **Agent identity leakage.** Long-running autonomous agents accumulate a permanent, public spending history. Competitors can profile their usage patterns, infer their objectives, and identify their operators.
2. **Usage profiling by merchants and indexers.** Every API call is a labeled data point. There is no equivalent of a private payment method for the agent economy.
3. **Operational risk for high-value flows.** Agents acting on behalf of treasuries, trading desks, or paying contractors expose strategic information through their payment graph.

x402 solves the *interface* problem (how an HTTP server requests payment). It does not solve the *privacy* problem (whether the payer can be identified). Qietr fills that gap.

## 3. Goals

### MVP goals (Phase 1)

- Single-chain (Solana mainnet) shielded pool supporting fixed USDC denominations.
- ZK proof of inclusion + non-double-spend, verified on-chain in an Anchor program using `groth16-solana`.
- Burner-wallet handoff that issues an x402-compatible payment to any merchant.
- Fee-payer sponsorship so users never need SOL to spend their notes.
- Browser-ready and Node-ready SDK with a `wrapFetch` API that transparently handles 402 responses.
- Public testnet deployment with a hosted UI for deposit / pay / note management.

### V1 goals (Phase 2–3)

- Independent third-party security audit.
- Mainnet launch with capped TVL.
- Agent SDK adapters: SendAI Agent Kit, Coinbase AgentKit on Solana.
- $QIET token launch with fee revenue routed to holders.

### Out of scope for MVP

- Cross-chain payments (Solana ↔ EVM). Deferred to V2 once single-chain volume justifies attestor infrastructure.
- Confidential SPL tokens (Token-2022 ZK ElGamal). The precompile is paused pending audit and is not a dependency we can build on today.
- Encrypted agent-to-agent messaging product (separate roadmap item).
- Mobile-native apps. MVP is web + SDK only.

## 4. Non-goals

- Qietr is not a mixer for arbitrary tokens. It is purpose-built for USDC micropayments to merchants.
- Qietr does not claim regulatory blessing. See [08-security-risks.md](08-security-risks.md) for the sanctions discussion.
- Qietr does not custody funds. Users hold their own notes; loss of a note is loss of funds.

## 5. Target users

| Segment | Why they need it | Distribution |
|---------|------------------|--------------|
| Autonomous AI agents | API and content payments without identity leakage | SDK in popular agent frameworks |
| Indie developers | Private API access, no usage profiling | Docs, sample apps |
| Privacy-conscious users | Payments to creators, paywalled content, donations | Hosted web app |
| x402 merchants | They receive ordinary USDC — Qietr is transparent to them | No integration required |

## 6. User stories

**Agent operator**
> As an agent operator running a research bot, I want my bot to pay for OpenRouter, Helius, and Jina credits without those services or any indexer being able to link the payments to my operator wallet or to each other.

**Indie developer**
> As a solo founder, I want to pay for competitor APIs to benchmark them without revealing my product's existence through my wallet's outgoing transactions.

**Content payer**
> As a reader, I want to pay $0.05 to unlock an article without the publisher building a profile of every article I read.

**$QIET holder**
> As a token holder, I want a transparent share of protocol fees that scales with network usage, with no team-controlled inflation.

## 7. Success metrics

### Phase 1 (testnet)
- 50+ unique testnet deposits within the first 30 days
- End-to-end deposit-to-payment flow under 60 seconds for a fresh user
- ZK proof generation under 15 seconds in browser on a 2024-class laptop
- Zero double-spends, zero stuck deposits in the test period
- One external developer integrates the SDK in a sample agent

### Phase 2 (audit)
- Audit completed with no Critical or High findings unmitigated
- Bug bounty live with documented scope

### Phase 3 (mainnet)
- First 30 days: 500+ unique depositors, $250k+ cumulative deposit volume
- Median anonymity set per denomination tier: 100+ after 60 days
- Sustained payment success rate above 99%

## 8. Anti-metrics (things we explicitly do not optimize for)

- Token price. Tokenomics rewards usage, not speculation.
- Total Value Locked. Privacy quality is the goal; TVL is a side effect.
- Headline integrations with partners that do not actually use the SDK.

## 9. Assumptions

- Solana mainnet retains its current fee structure and syscall availability through 2026.
- The `groth16-solana` library remains maintained or we fork it.
- x402-svm continues to be the dominant Solana payment-request standard.
- USDC remains the primary unit of account for agent payments on Solana.

## 10. Constraints

- All cryptographic primitives must be auditable open source. No proprietary ZK stacks.
- The Anchor program must fit within Solana compute-unit limits for a single payment transaction including proof verification.
- No custodial component. The protocol must not be able to seize or freeze user funds.

## 11. Open questions

- Should denomination tiers be `0.1 / 1 / 10 / 100 USDC` or `1 / 10 / 100 USDC`? Tradeoff: smaller tiers improve micropayment fit, larger tiers improve anonymity set growth per deposit.
- Should fee revenue accrue to $QIET holders via a claim contract or via continuous airdrop? Claim is more gas-efficient; airdrop is more visible.
- Do we require a hosted relayer for fee sponsorship at launch, or can we rely on community fee-payers from day one?

## 12. References

- HTTP 402 / x402 protocol overview (Coinbase / Cloudflare).
- Groth16 (Jens Groth, 2016).
- BN254 curve and Poseidon hash function.
- Solana `sol_alt_bn128_*` syscalls and the `groth16-solana` verifier library.
- Prior art on fixed-denomination shielded pools using Merkle commitments and nullifier sets.
