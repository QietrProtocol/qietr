# @qietr/sdk

TypeScript SDK for [Qietr](../README.md) — privacy-preserving stablecoin payments on Solana with native x402 support.

**Status:** implemented. 38/38 tests pass. Typed, built, ready for integration.

## Layout

```
qietr-sdk/
  package.json                  # @qietr/sdk, ESM, types
  tsconfig.json                 # strict, ES2022, Bundler resolution
  src/
    index.ts                    # public exports
    sdk.ts                      # QietrSDK class (405 lines — real deposit/pay/wrapFetch)
    sdk.ts                      # QietrSDK class
    note.ts                     # Argon2id + AES-256-GCM encryption
    prover.ts                   # Witness + Groth16 proof generation (snarkjs wasm)
    x402.ts                     # wrapFetch 402 retry flow
    hash.ts                     # Poseidon commitment + nullifier hash
    merkle.ts                   # Off-chain Poseidon Merkle tree
    program.ts                  # Hand-rolled instruction builders
    chain.ts                    # Cluster config, USDC mints, ATA derivation
    pubkey.ts                   # Pubkey → BN254 field element conversion
    randomness.ts               # Field element randomness
    indexer-client.ts            # Indexer API client
    types.ts                    # Shared interfaces
  test/                         # 14 test suites, 38 cases (node:test)
  dist/                         # Compiled JS + declarations
```

## Target shape

```ts
import { QietrSDK } from "@qietr/sdk";

const sdk = new QietrSDK({
  cluster: "mainnet-beta",
  relayerUrl: "https://relay.qietr.com",
  proverPath: "https://prover.qietr.com",
});

const note = await sdk.deposit({ amount: 10, payer: walletAdapter });

sdk.setNote(note);
const f = sdk.wrapFetch(fetch);
const res = await f("https://api.example.com/v1/expensive-endpoint");
const updatedNote = sdk.getUpdatedNote();
```

## Prerequisites

- Node.js 20+
- A Solana wallet adapter (the SDK accepts anything satisfying `SignerLike`).

## Quick start

```bash
npm install
npm run build         # emits dist/
npm test              # 38 tests — all pass
```

## Next pass

1. Wire IDL-driven instruction paths once Anchor IDL is finalized.
2. Full end-to-end test against devnet.

## Security

- The SDK never sends a note off-device unencrypted.
- The hosted prover at `prover.qietr.com` reveals payment metadata to the operator. It is opt-in; the WASM prover is the default.
- Burner keypairs are generated per-payment, used once, then discarded. They never see SOL — fees come from the relayer.
