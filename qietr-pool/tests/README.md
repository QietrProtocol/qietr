# qietr-pool tests

## What's here

- `helpers.ts` — fixtures: provider, mint, admin, deposit/withdraw runners. Pulls the prover + IX builders from `@qietr/sdk` (workspace `file:` dep).
- `qietr-pool.ts` — primary suite. Three describe blocks:
  - **Happy paths** — `initialize_pool` + `initialize_denomination`, deposit, withdraw round-trip (real Groth16 proof against the dev VK, real SPL transfer).
  - **Rejection paths** — double-spend (PDA `init` collision), stale root (push 31 more deposits so the snapshot falls out of the 30-root window), recipient retarget, paused-pool, nullifier-hash arg mismatch.
  - **Admin gating** — non-admin can't pause; VK upgrade respects the 48h time-lock.

## Running

```bash
# Once toolchain blocker (B1) is cleared:
anchor build           # produces target/idl/qietr_pool.json
anchor test            # spins up validator, runs this suite
```

`anchor test` reads `Anchor.toml`'s `[scripts]` section, which already points at this folder.

The circuit artifacts (`qietr_payment.wasm`, `qietr_payment_dev.zkey`) are pulled directly from `../qietr-circuits/build/` and `../qietr-circuits/keys/`. Make sure `qietr-circuits/scripts/setup-dev.sh` has been run at least once (it has been — these files exist).

## What's NOT here yet

- **Non-canonical ATA reject test** — placeholder in `qietr-pool.ts`. Needs an `spl-token` helper to create a Token account that isn't the canonical ATA for (owner, mint). Easy follow-up.
- **Compute-unit budget assertion** — `anchor test` doesn't expose CU per ix cleanly; add a `getTransaction(..., { commitment: "confirmed" }).meta.computeUnitsConsumed` check after `runWithdraw` and assert `< 400_000`. Will land after first `anchor build`.
- **Cross-tier proof rejection** — separate test that proves under a 1 USDC tier and submits to a 10 USDC tier. Covered structurally by the `amount_field == tier_amount_field` check; an explicit test is still worth adding.

## Rust unit tests

Pure-Rust tests (Poseidon parity vs circomlibjs) live in `programs/qietr_pool/src/merkle.rs` under `#[cfg(test)]`. Run with:

```bash
cargo test -p qietr_pool --lib
```

These don't require `anchor build` and pass today (2/2 green).
