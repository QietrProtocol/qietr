# qietr-pool

Solana Anchor program for the Qietr shielded payments pool.

**Status:** implemented. 7 live instructions, real Groth16 verification, Merkle tree with Poseidon hashing. `cargo check` clean. Compiled `qietr_pool.so` (464 KB) at `target/sbpf-solana-solana/release/`.

## Layout

```
qietr-pool/
  Cargo.toml                       # workspace
  Anchor.toml                      # toolchain (anchor 0.31.1, agave 4.0.2)
  programs/qietr_pool/
    Cargo.toml
    src/
      lib.rs                       # 7 instructions — initialize_pool, initialize_denomination,
                                   # deposit, withdraw, set_paused, queue_vk_upgrade, apply_vk_upgrade
      state.rs                     # PoolConfig, Denomination, MerkleTree (depth 20, root window 30), NullifierRecord
      errors.rs                    # QietrError (18 variants)
      merkle.rs                    # Append-only Merkle tree with Poseidon-2 + golden-vector tests
      verifier.rs                  # groth16-solana wrapper with 256-byte proof packing
      dev_vk.rs                    # Auto-generated dev verifying key
  tests/
    qietr-pool.ts                  # 9 integration tests (mocha)
    helpers.ts                     # Fixtures + test runners
```

## Decisions locked

- **Program-id placeholder** in `Anchor.toml` and `declare_id!()`. Replace with a real keypair before first deploy.
- **Single parameterized circuit** matches the verifying-key-per-tier layout: `Denomination.verifying_key_hash` pins the tier-specific VK; `PoolConfig.verifying_key_hash` is the fallback / global.
- **Merkle depth 20, root-history window 30** (TRD section 3.4). Tree state stored as a frontier (`filled_subtree`) plus a ring buffer of recent roots.
- **Nullifiers stored as PDA existence** (TRD section 3.2). Replay is prevented by `init` failing on the second attempt.
- **Compute budget target:** under 400k CU for withdraw (TRD section 3.5).

## Prerequisites

- Rust 1.79+
- Solana CLI 1.18+
- Anchor 0.30.1
- Node.js 20+ (only to run mocha tests)

## Quick start

```bash
anchor build           # compiles programs/qietr_pool → qietr_pool.so (464 KB)
cargo check            # passes (warnings only, no errors)
anchor test            # spins up test validator + runs mocha suite (9 integration tests)
```

The first real build will require generating a program keypair and updating `declare_id!` in `lib.rs` and `[programs.localnet]` / `[programs.devnet]` in `Anchor.toml`.

## Next pass

1. Rotate program keypair for devnet, deploy, initialize tiers.
2. End-to-end deposit + pay round-trip against devnet RPC.
3. Compute-unit budget measurement and optimization.

## Security

- Verifying key may only change through the time-locked `update_verifying_key` path. Direct writes to `PoolConfig` from any other instruction are forbidden.
- The pool program never knows whose deposit feeds whose withdrawal. The Merkle structure and nullifier set are the entire on-chain identity model.
- Sanctions screening, if any, lives at the relayer layer (TRD section 7), never in this program.
