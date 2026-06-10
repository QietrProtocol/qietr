# Tokenomics — $QIET

**Version:** 0.1 (spec phase)
**Status:** Draft. Final allocations and vesting are decided before token generation event (TGE), not now.

---

## 1. Purpose

$QIET is the protocol token of Qietr. It exists to:

1. **Distribute protocol revenue** to people who hold long-term exposure to the network.
2. **Govern parameters** that should not be hard-coded (fee rate, denomination additions, paused state in extreme cases).
3. **Align incentives** between users, integrators, and the team.

$QIET is explicitly **not**:

- A claim on the team's assets or revenue.
- A security or investment contract. Holders earn protocol fees by holding, the same way a router-LP earns routing fees by depositing — there is no profit promise.
- A required token to use the protocol. Anyone can deposit and pay without ever touching $QIET.

This document is a tokenomics design draft. Final numbers will be reviewed by legal counsel before TGE.

---

## 2. Supply

- **Total supply:** `1,000,000,000` $QIET (1 billion).
- **Mintability:** the contract has no mint function after deployment. Supply is fixed.
- **Decimals:** 9 (Solana SPL standard).
- **Mint:** SPL Token mint with `mintAuthority = null` after initial distribution.
- **Freeze authority:** `null` from genesis. No address can freeze accounts.

---

## 3. Allocation

Draft allocation. Final numbers depend on legal review and the launch venue chosen.

| Bucket | Percent | Tokens | Notes |
|--------|---------|--------|-------|
| Community / users | 50% | 500,000,000 | Public launch + ongoing emissions to depositors |
| Core team | 18% | 180,000,000 | Vested |
| Ecosystem / integrations | 12% | 120,000,000 | Grants to SDK integrators, agent frameworks, audit partners |
| Treasury | 12% | 120,000,000 | Multisig, on-chain governance once active |
| Strategic backers | 8% | 80,000,000 | If applicable; may be reduced or eliminated |

Numbers in the **draft column will be revisited** before TGE. The principles below are firm.

### 3.1 Allocation principles

1. **Community is the largest bucket.** No single private bucket exceeds it.
2. **Team is locked.** Minimum 12 months cliff plus 24 months linear vest. No exceptions for any team member.
3. **Backers are vested at least as long as the team.** Same or longer cliff and vest.
4. **No private rounds at advantageous prices vs. the public sale**, unless those rounds are publicly disclosed before TGE with full terms.
5. **Treasury is on-chain.** Movements require multisig signatures from the start, with the path to on-chain governance documented.

---

## 4. Distribution mechanics

### 4.1 Initial distribution

Three components decided pre-TGE:

- **Public sale / launch venue.** On Solana the practical options are pump.fun, Believe, Meteora bonding-curve launches, or a fixed-price sale. The choice is made closer to launch based on integrations and liquidity needs.
- **Airdrop to testnet participants.** A meaningful slice of the community bucket is reserved for users who deposited on testnet. Allocation criteria are published in advance.
- **Reserve for ongoing emissions.** See 4.2.

### 4.2 Ongoing emissions (community bucket)

A portion of the community bucket is distributed continuously to depositors based on usage. Mechanic options under consideration:

- **Per-deposit emission credit.** Each deposit (above a minimum dust threshold) earns $QIET pro-rata to USDC value and time held in the pool.
- **Per-payment emission credit.** Each payment from a note earns $QIET pro-rata to amount paid.

Emissions are calculated on-chain, claimable by note holders via a ZK-proof that does not link claim address to deposit address. Final mechanic is decided after testnet usage data informs the right balance between deposit-side and spend-side rewards.

### 4.3 Vesting schedule (team and backers)

| Bucket | Cliff | Linear vest | Total |
|--------|-------|-------------|-------|
| Team | 12 months | 24 months | 36 months |
| Backers (if any) | 12 months | 24 months | 36 months |
| Ecosystem | 0 months | 24 months | 24 months |
| Treasury | 0 months | 36 months | 36 months |

Vesting contracts are open source and verifiable on-chain.

---

## 5. Utility

### 5.1 Revenue share

- **Source:** deposit fees collected by the pool program. Range: 0.10% to 5.00%, set by governance, default 1.00% at launch.
- **Distribution:** all fees stream to a `RevenueDistributor` program that holders interact with to claim their share. Snapshot is per-epoch (one Solana epoch ≈ 2-3 days).
- **Claim:** holders claim their accrued share at will. Unclaimed share rolls forward.

Crucially, revenue share is the only reward for holding. There is no inflation paid to stakers from the team or treasury bucket.

### 5.2 Governance

Governable parameters:

- `fee_bps` (deposit fee rate), within a hard-coded range of `0..=500`.
- Denomination additions and pauses.
- `verifying_key_hash` updates (time-locked, used for circuit upgrades after audit).
- Treasury disbursements.
- Emission mechanic parameters (curve shape, target rate).

Non-governable (immutable from genesis):

- Total supply.
- Mint and freeze authority (both null).
- The shielded-pool program's core deposit / withdraw logic, except via the standard upgrade flow which requires a 14-day timelock and an active governance vote.

Governance venue: SPL Governance (Realms) at launch. Path to a custom on-chain governance program left open.

### 5.3 Fee discounts

Holders staking a minimum threshold of $QIET receive a tiered fee discount on deposits:

| Stake tier | Discount |
|------------|----------|
| Tier 0 (no stake) | 0% |
| Tier 1 | 25% |
| Tier 2 | 50% |
| Tier 3 | 75% |

Thresholds are denominated in USDC value of the stake at oracle price to avoid gaming via token price swings. Discount applies only to the staker's own deposits — it does not affect revenue share for other holders.

---

## 6. Worked examples

### 6.1 Revenue share for a holder

Assumptions: 100M $QIET held, total supply 1B (10% share). Monthly protocol fees: $200,000.

- Holder share: 10% of $200,000 = $20,000 per month.
- Stream is claimed per epoch. No claim deadline.

(Numbers are illustrative.)

### 6.2 Fee discount for a depositor

Holder stakes Tier 2 ($QIET equivalent to ~$5,000 by spec) and deposits 100 USDC.

- Base fee: 1.0% = 1.00 USDC.
- Discount: 50%.
- Net fee paid: 0.50 USDC.

---

## 7. What the token is not used for

- **Not gas.** All gas on the protocol is SOL (or sponsored). $QIET is not consumed per transaction.
- **Not collateral.** No lending market against $QIET at the protocol level.
- **Not access control.** Anyone can use Qietr without holding $QIET. The discount is a benefit, not a gate.

---

## 8. Treasury policy

The protocol treasury exists to fund:

- Security audits (recurring, not one-off).
- Bug bounties (continuous program).
- Public-good grants for integrators (agent frameworks, indexers, alternative provers).
- Liquidity provisioning for $QIET if needed.

Treasury policy commitments:

- All treasury movements are on-chain and visible.
- Treasury never sells $QIET into the open market except via TWAP programs published in advance.
- Treasury never funds market-making contracts whose terms are private.

---

## 9. Risks and disclosures

- **Regulatory.** Privacy-focused tokens face a more uncertain regulatory landscape than general-purpose tokens. Holders should assume jurisdiction-specific compliance is their responsibility.
- **Smart-contract.** The pool and revenue programs hold value. Bugs, regardless of audit, are possible.
- **Liquidity.** A new token's market is thin. Price volatility is expected.
- **Adoption.** Revenue share scales with usage. If the protocol is not adopted, fees and therefore revenue share are negligible.

These risks are reiterated in the launch communications and in the legal disclaimer.

---

## 10. Open questions

- Final allocation percentages, subject to legal review.
- Launch venue (pump.fun vs Believe vs Meteora vs fixed-price sale).
- Emission curve shape (linear, exponential decay, or epoch-based step).
- Whether to bootstrap initial liquidity from treasury or rely on public-launch liquidity entirely.
- Discount tier thresholds in USDC terms — must be high enough to be meaningful, low enough to be reachable by indie developers.
