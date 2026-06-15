# @qietr/sdk

TypeScript SDK for [Qietr](../README.md) — privacy-preserving stablecoin payments on Solana with native x402 support.

**Status:** implemented and tested against the live devnet programs. 113/113 unit
tests pass. Publish to npm via `npm publish --access public` (requires npm token
set as `NPM_TOKEN` in CI or `.npmrc`; see `.github/workflows/publish-sdk.yml`).

## Layout

```
qietr-sdk/
  package.json                  # @qietr/sdk, ESM, types
  tsconfig.json                 # strict, ES2022, Bundler resolution
  src/
    index.ts                    # public exports
    sdk.ts                      # QietrSDK class — deposit/pay/wrapFetch
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
  test/                         # node:test suites — 100 cases
  dist/                         # Compiled JS + declarations
```

## Usage

```ts
import { QietrSDK } from "@qietr/sdk";

const sdk = new QietrSDK({
  cluster: "devnet",
  indexerUrl: "http://localhost:8080",      // your indexer-api instance
  proverPath: "./qietr-circuits/build",     // local prover artifacts
  // relayerUrl: "http://localhost:4080",   // optional, for gasless deposits
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
npm run build         # emits dist/ (run before npm test)
npm test              # 100 tests — all pass
```

> The SDK requires `indexerUrl` and `proverPath` in its config (no hosted
> defaults). Point them at your indexer instance and local prover artifacts.

## Security

- The SDK never sends a note off-device unencrypted.
- Proving runs locally via the WASM prover by default. A remote prover (if you configure `proverPath` to a hosted URL) would see payment metadata — keep it local for full privacy.
- Burner keypairs are generated per-payment, used once, then discarded. They never see SOL — fees come from the relayer.
- The devnet deployment ships the development `pot14` verifying key, which is **not** safe for production. A trusted-setup ceremony is required before mainnet.
