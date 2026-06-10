# Cross-Chain Design — Qietr ↔ EVM

**Phase I of IMPLEMENTATION_PLAN.md**

## Goal

Enable USDC privacy payments that span Solana and EVM chains (Base, Polygon, Ethereum). A user deposits on Solana and withdraws on Base (or vice versa) without revealing the link between the two transactions.

## Architecture

```
Solana                          Relayer / Attestor               EVM (Base)
+--------------------+          +--------------------+          +-------------------+
| Qietr Pool (Sol)   |          |     Attestor        |          | Qietr Pool (EVM)  |
| - deposit()        |          |                     |          | - deposit()       |
| - withdraw()       +<-------->+ - Watches events    +<-------->+ - withdraw()      |
| - Merkle tree      |          |   on both chains    |          | - Merkle tree     |
| - Nullifier set    |          | - Relays nullifiers |          | - Nullifier set   |
+--------------------+          | - Maintains roots   |          +-------------------+
                                +--------------------+
```

## Approach

### Option A — Wormhole VAA (recommended)

[Wormhole](https://wormhole.com) provides a generic message-passing layer. A VAA (Verified Action Approval) is signed by Wormhole guardians after observing an event on the source chain.

**Flow:**

1. User deposits USDC into Qietr Pool on Solana, receives a commitment + nullifier
2. User submits a `withdraw` proof on EVM chain
3. The EVM pool contract calls Wormhole to verify the nullifier hasn't been spent on Solana
4. Wormhole guardians observe the Solana nullifier set and relay VAAs to EVM
5. EVM pool releases USDC

**Nullifier synchronization:**

- The attestor runs a service that:
  - Watches both chains for `NullifierRecord` insertions
  - Periodically posts the latest nullifier Merkle root to the other chain via Wormhole VAAs
- The pool on each chain stores a "nullifier root" from the other chain
- Withdraw proofs must include a Merkle inclusion proof that the nullifier is NOT in the other chain's set

**Challenges:**
- Cross-chain nullifier sync latency (15-30 seconds via Wormhole)
- Higher gas costs for Merkle inclusion checks on EVM
- VAA verification costs on Solana (requires secp256k1 instruction)

### Option B — LayerZero OFT

[LayerZero](https://layerzero.network) OFT (Omnichain Fungible Token) standard. USDC is deployed as an OFT and the Qietr pool interacts with it.

**Flow:**

1. User deposits USDC into Qietr Pool on Solana
2. User burns pool representation on Solana with a ZK proof
3. Pool emits a `Withdraw` event containing the encrypted output
4. LayerZero UltraLight Node relays the message to EVM
5. EVM adapter verifies the ZK proof (if proof is included) or trusts the oracle/delivery layer
6. USDC is minted on the destination chain

**Challenges:**
- USDC on Solana is native SPL, not an OFT — requires a bridge wrapper
- LayerZero's security model relies on oracles + relayers
- ZK proof verification on-chain on EVM requires BN254 precompile (available on all modern L2s)

### Option C — Native USDC via CCTP

Circle's [Cross-Chain Transfer Protocol](https://www.circle.com/cross-chain-transfer-protocol) for native USDC.

**Flow:**

1. User deposits USDC on Solana → gets commitment
2. User submits withdraw proof on EVM chain
3. Withdraw instruction burns USDC on Solana via CCTP
4. Circle mints USDC on destination chain
5. EVM pool receives the minted USDC and releases to recipient

**Challenges:**
- CCTP only handles USDC, not arbitrary tokens
- CCTP doesn't carry arbitrary data (can't attach nullifier proofs)
- Requires Circle API integration for mint/burn attestation
- Best used as the settlement layer rather than the message layer

## Recommended architecture

**Hybrid: Wormhole VAAs + CCTP settlement**

1. **Message layer:** Wormhole VAAs carry nullifier state and Merkle roots between chains
2. **Settlement layer:** CCTP handles the actual USDC movement (burn on source, mint on destination)
3. **ZK layer:** Each chain verifies Groth16 proofs independently using the shared nullifier state

```
1. User deposits USDC on Solana → CCTP burns → commitment added to Solana tree
2. User generates Groth16 proof on Solana, submits to EVM pool
3. EVM pool:
   a. Verifies proof against latest Solana Merkle root (via Wormhole VAA)
   b. Checks nullifier is fresh (not in EVM's local set)
   c. Calls CCTP to mint USDC on EVM
   d. Transfers USDC to recipient
4. Attestor:
   a. Watches both chains
   b. Posts Solana roots → EVM via Wormhole
   c. Posts EVM nullifiers → Solana via Wormhole (for reverse direction)
```

## Phasing

| Phase | Scope | Timeline |
|-------|-------|----------|
| I1a | Design doc + attestor spec | This document |
| I1b | Solana → EVM (Base) unidirectional | After mainnet launch |
| I1c | EVM → Solana bidirectional | After I1b |
| I1d | Polygon + Ethereum support | After I1c |

## Security considerations

- **Replay across chains:** The nullifier namespace must be chain-aware. Either include `chain_id` in the nullifier hash or maintain separate nullifier sets per chain pair.
- **Attestor honesty:** The attestor is trusted for liveness but not correctness — ZK proofs prevent invalid withdrawals even if the attestor is malicious. The attestor can at most delay withdrawals.
- **VAA freshness:** Withdraw transactions must reference a VAA within a valid window (e.g., within the last 200 Solana slots). Stale VAAs are rejected.
- **Economic security:** Wormhole's guardian set (19/19 consensus) provides stronger guarantees than a single attestor.

## Open questions

- What is the cost of verifying a Groth16 proof + Wormhole VAA + CCTP attestation on EVM? Likely >500k gas.
- Should the cross-chain pool share the same USDC liquidity or maintain separate vaults per chain?
- Can the Merkle tree be shared across chains (single global tree) or should each chain have its own tree with cross-chain nullifier checking?
