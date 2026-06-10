# Trusted-Setup Ceremony Spec — Qietr

**Phase G1 of IMPLEMENTATION_PLAN.md**

## Overview

Qietr uses Groth16 over BN254, which requires a multi-party trusted-setup ceremony to generate the proving key. The current dev setup uses a `pot14` Powers of Tau with a single contribution. Production requires a fresh ceremony with at least 8 independent contributors.

## Circuit

| Property | Value |
|----------|-------|
| Circuit name | `qietr_payment` |
| Constraints | 5,789 (non-linear) |
| Private inputs | `secret`, `nullifier`, `paymentAmount`, `changeCommitment` |
| Public inputs | `amount`, `root`, `nullifierHash`, `recipient`, `paymentAmount`, `changeCommitment` |
| Hash | Poseidon (BN254) |
| Merkle depth | 20 |

## Ceremony phases

### Phase 1 — Powers of Tau (BFT)

A single BN254 Powers of Tau ceremony producing `pot14` (2^14 = 16,384 max constraints; our circuit uses 5,789 which fits within 2^13 = 8,192, but pot14 provides headroom for circuit changes).

One entity generates `pot14_0000.ptau`. Each contributor:

1. Downloads the current `.ptau` file
2. Runs `snarkjs powersoftau contribute` with fresh entropy
3. Uploads the result
4. Signs a statement: contributor identity, timestamp, file hash (SHA-256)

Minimum 8 contributions. After the final contribution, run `snarkjs powersoftau beacon` for a random beacon, then `snarkjs powersoftau prepare phase2`.

### Phase 2 — Circuit-specific setup

Using the Phase 1 output:

```bash
snarkjs groth16 setup qietr_payment.r1cs pot14_final.ptau circuit_0000.zkey
```

Each Phase 2 contributor:

1. Downloads `circuit_0000.zkey`
2. Runs `snarkjs zkey contribute` with fresh entropy
3. Uploads the result
4. Signs a statement (same format as Phase 1)

Minimum 8 contributions. Finalize with `snarkjs zkey beacon` + `snarkjs zkey verify`.

### Output artifacts

| File | Description | Storage |
|------|-------------|---------|
| `qietr_payment.zkey` | Proving key | Cloudflare R2 (public) |
| `qietr_payment_vk.json` | Verifying key | Git-tracked (dev) + R2 (prod) |
| `qietr_payment.wasm` | Witness generator | Cloudflare R2 |

### Transcript publishing

After the ceremony, publish:

- All intermediate `.ptau` files with hashes
- All intermediate `.zkey` files with hashes
- Each contributor's signed statement
- Final verification transcript

Hosted at `https://circuits.qietr.com/ceremony/`.

## Contributor qualifications

| Type | Example | Count |
|------|---------|-------|
| Qietr team member | Core dev | 2 |
| External security researcher | PSE, Veridise | 2 |
| Ecosystem partner | Solana Foundation, Anza | 1 |
| Community / independent | Anonymous via beacon | 3+ |

## Contributor instructions

```bash
# Prerequisites
npm install -g snarkjs

# Phase 1 contribution
curl -O https://circuits.qietr.com/ceremony/phase1/current.ptau
sha256sum current.ptau
snarkjs powersoftau contribute current.ptau contributed.ptau
# → Will prompt for random text input
sha256sum contributed.ptau
# Upload contributed.ptau

# Phase 2 contribution
curl -O https://circuits.qietr.com/ceremony/phase2/current.zkey
sha256sum current.zkey
snarkjs zkey contribute current.zkey contributed.zkey
# → Will prompt for random text input
sha256sum contributed.zkey
# Upload contributed.zkey
```

## Verification commands

```bash
# Verify entire ptau chain
snarkjs powersoftau verify pot14_final.ptau

# Verify zkey chain
snarkjs zkey verify qietp_payment.r1cs pot14_final.ptau qietr_payment.zkey

# Export and verify VK
snarkjs zkey export verificationkey qietr_payment.zkey qietr_payment_vk.json
snarkjs groth16 verify qietr_payment_vk.json public.json proof.json
```

## Dev vs prod

| Aspect | Dev | Production |
|--------|-----|------------|
| ptau | `pot14_0000.ptau` (single contrib) | Multi-party `pot14_final.ptau` |
| zkey | `qietr_payment_dev.zkey` (single contrib) | Multi-party `qietr_payment.zkey` |
| VK | `qietr_payment_dev_vk.json` | `qietr_payment_vk.json` |
| VK in pool | `dev_vk.rs` (auto-generated) | Runtime-loaded from `Denomination` config |
| Trust | None (local dev only) | 8+ independent contributors |

## Timeline

1. Week 1: Recruit contributors, distribute instructions
2. Week 2: Phase 1 (Powers of Tau) — 1 week window
3. Week 3: Phase 2 (circuit-specific) — 1 week window
4. Week 4: Transcript verification + artifact publishing
5. Week 5: Replace dev VK in Anchor program, deploy fresh to devnet

## Security notes

- No single party controls the final key unless all other contributions are compromised
- The random beacon at the end of each phase ensures even the last contributor cannot influence the output
- All communication via signed messages on the contributor's known public key
- Ceremony artifacts uploaded to R2 with checksums; checksums also published on Qietr's X account and GitHub
