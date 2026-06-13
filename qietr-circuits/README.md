# qietr-circuits

Zero-knowledge circuits for [Qietr](../README.md) — privacy-preserving stablecoin payments on Solana with native x402 support.

**Status:** implemented, compiled, dev keys generated. 6/6 tests pass.

## Layout

```
qietr-circuits/
  circuits/
    qietr_payment.circom     # Spend circuit (194 lines, 6 constraints, Poseidon + MerkleTreeChecker)
  scripts/
    compile.sh               # circom -> r1cs/wasm/sym
    setup-dev.sh             # dev-only ptau + zkey
    export-vk.sh             # export verifying key for the on-chain verifier
    vk-to-rust.js            # VK → dev_vk.rs for the Anchor program
  test/
    qietr_payment.test.js    # 6 test cases (happy path, wrong nullifier, zero payment, etc.)
  build/                     # generated, gitignored (r1cs, wasm, sym)
  ptau/                      # generated, gitignored (pot14)
  keys/                      # generated, gitignored (dev zkey, VK)
```

## Decisions locked

- **Single parameterized circuit** (one ceremony, not four). `amount` is bound to the on-chain tier by the verifier configuration, not hard-coded into separate circuits.
- **Merkle depth:** 20 (TRD section 3.4).
- **Curve / hash / proof system:** BN254 / Poseidon / Groth16 (TRD section 2).
- **Public-signal order:** `[amount, root, nullifierHash, recipient, paymentAmount, changeCommitment]` — snarkjs orders by signal-declaration order, not the `public [...]` list. Authoritative source is `build/qietr_payment.sym`; must match `lib.rs::withdraw` and `verifier.rs` in `qietr-pool`.

## Prerequisites

- [circom 2.1+](https://docs.circom.io/getting-started/installation/) on PATH
- Node.js 20+
- `npm install` to pull `snarkjs` and `circomlib`

## Quick start

```bash
npm install
npm run compile        # build/qietr_payment.{r1cs,sym,wasm}
npm run setup:dev      # dev-only ptau + zkey + vkey
npm run export-vk      # verifying key for downstream consumers
npm test               # 6 tests — all pass
```

The `setup:dev` flow produces keys for local development only. The production trusted setup is a multi-party ceremony scheduled before mainnet launch (TRD section 4.4).

## Next pass

1. Production trusted-setup ceremony (multi-party, scheduled before mainnet).

## Security

Never commit `keys/`, `ptau/`, or any artifact containing toxic waste from a real ceremony. `.gitignore` enforces this. Production ceremony artifacts live in a dedicated, audited repository at launch.
