# Qietr Privacy Model — what holds, what doesn't (yet)

**Status:** devnet, unaudited. This document is the authoritative, honest
description of Qietr's privacy guarantees. Where the README or website make a
shorter claim, this file governs.

## 1. What the shielded pool gives you

Qietr is a fixed-denomination shielded pool (Tornado-style) over USDC on Solana:

- Deposits publish only a Poseidon **commitment** to a secret note. The link
  between your wallet and the commitment never leaves your device.
- A payment proves, in zero knowledge, that you own *some* unspent leaf in the
  tree for a given denomination, revealing only a **nullifier** (double-spend
  guard) and the recipient. The merchant cannot tell which deposit funded it.

Within those bounds, a spend is **indistinguishable among all deposits of the
same denomination tier** that are still in the recent-root window.

## 2. The anonymity set is per-tier, not pool-wide

There are four tiers: **0.1 / 1 / 10 / 100 USDC**. A proof is bound to one
denomination (the `amount` public signal must equal the tier value). So your
anonymity set is *the deposits in your tier*, not "every depositor in the pool."

Sparse tiers (e.g. 100 USDC) therefore offer a smaller set. Prefer popular tiers
for stronger privacy.

## 3. Change notes are linkable (the important caveat)

A **partial spend** (paying less than a full denomination) mints a non-tier
**change commitment** back into the **same Merkle tree, in the same
transaction** as the spend (`qietr_payment.circom` constrains `changeCommitment`;
`lib.rs::withdraw` appends it). An on-chain observer sees:

```
tx T: nullifier X spent (tier-1 leaf consumed)  +  new leaf L appended
```

and can infer that leaf `L` is the change from spend `X`. The change note — and
every future spend of it — is therefore **correlatable** with the original
spend. This is why Tornado Cash has no change mechanism.

**Consequences**

- The change note is *not* in the tier anonymity set; it is a uniquely
  identifiable amount tied to a specific spend.
- Chains of partial spends form a linkable lineage.

**Mitigations (today, in the SDK's control)**

- **Spend whole denominations.** A spend with `paymentAmount == tier` produces a
  zero-value change note and reveals nothing extra. (The SDK picks the smallest
  commitment that covers the payment; choosing exact-tier payments avoids change.)
- **Re-deposit change** as a fresh deposit so it re-enters a tier set with a new,
  unlinked commitment.
- **Compartmentalize** large balances across several tier-exact notes at deposit
  time rather than relying on change.

### Decision D2 (2026-06-13): document, don't redesign — yet

We evaluated removing change notes (no-change / pool-of-pools redesign so the
fixed-denomination set always holds). For the current milestone we chose to
**keep change notes and disclose the linkage honestly** (this document) rather
than ship a circuit/program redesign. A no-change design is tracked as future
work; see §6.

## 4. Other leakage to be aware of

- **Recent-root window (30 roots).** The root is a public signal; with a 30-root
  history an observer learns an *upper bound* on your deposit time. On sparse
  tiers this narrows the set. (`state.rs: ROOT_HISTORY_LEN = 30`.)
- **Recipient masking.** The recipient pubkey is reduced to a field element by
  clearing the top 3 bits (`pubkey_to_field`). This is a lossy 253-bit mapping:
  8 distinct pubkeys collide to one field element. The on-chain equality check
  still pins payment to the canonical ATA of the proven owner, but a
  full-pubkey hash (Poseidon/keccak mod p) is the stronger long-term design.
- **Relayer metadata.** If you use the gasless relayer, it sees your IP and the
  recipient (it screens sanctions on the recipient ATA owner). Use Tor/VPN and a
  trusted relayer, or pay your own fee.
- **Timing / amount correlation.** Paying an unusual amount, or immediately after
  a deposit, can correlate on-chain activity regardless of the ZK layer.

## 5. What is NOT a privacy claim

- Qietr does not anonymize the **merchant**; the recipient is on-chain.
- Qietr does not hide that *a* payment of a given tier occurred.
- Qietr is **unaudited** and runs a single-contributor **dev verifying key** on
  devnet (see `docs/dev/11-trusted-setup.md`). Do not use with funds you can't
  lose until a multi-party trusted setup and external audit are complete.

## 6. Roadmap toward a stronger set

- Replace the dev VK via a multi-party trusted-setup ceremony
  (`docs/dev/CEREMONY.md`).
- Full-pubkey recipient binding (drop the 3-bit mask).
- Evaluate no-change / split-note designs so partial spends don't leak a change
  lineage.
- Larger / configurable root-history window per tier.
