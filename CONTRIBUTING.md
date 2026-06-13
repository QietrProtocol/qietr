# Contributing to Qietr

Thanks for your interest in Qietr — a zero-knowledge privacy layer for x402
micropayments on Solana. This guide covers how to get set up, our standards, and
how to propose changes.

## Getting started

Read [`docs/getting-started/LOCAL_SETUP.md`](docs/getting-started/LOCAL_SETUP.md)
first — it has prerequisite versions, build order, ports, `.env` templates, and a
single end-to-end command.

The repo is a multi-package monorepo:

| Package | What it is | Language |
|---------|-----------|----------|
| `qietr-pool` | Shielded-pool Anchor program | Rust |
| `qietr-escrow` / `qietr-msg` | Job escrow + encrypted messaging programs | Rust |
| `qietr-circuits` | Groth16 payment circuit | Circom |
| `qietr-sdk` | TypeScript SDK (notes, proofs, x402) | TypeScript |
| `qietr-relayer` | Gasless fee-payer service | TypeScript |
| `qietr-indexer` | Geyser plugin + Merkle-proof API | Rust + TypeScript |
| `qietr-web` | Marketing + docs site | TypeScript (Next.js) |

## Toolchain

The Anchor programs build under a **specific** toolchain combination — see
`qietr-pool/README.md` and the repo's documented pins:

- Agave **4.0.2**
- `anchor-lang` / `anchor-spl` **0.31.1**
- `groth16-solana` **0.2.0**

Node packages target **Node 20+** (declared via `engines` in each `package.json`).

## Standards

- **TypeScript:** strict mode is on everywhere; keep it that way. No `any`
  without justification. Run `npm run typecheck` and `npm test` before pushing.
- **Rust:** programs use `overflow-checks` and checked math. Preserve
  `has_one`/constraint-based access control. Run `cargo check` (and `anchor test`
  where a validator is available).
- **Match the surrounding code.** Comment density, naming, and idiom should look
  like the file you're editing.
- **Security-sensitive changes** (circuit, pool program, relayer money path,
  x402 spend guard) require tests that demonstrate the new behavior.

## Proposing changes

1. Fork and branch from `main` (`feat/...`, `fix/...`, `docs/...`).
2. Keep PRs focused; one logical change per PR.
3. Fill out the PR template. Link any related issue.
4. Ensure CI is green: typecheck, tests, `cargo check`, web build.
5. For protocol/circuit changes, describe the security implications explicitly.

## Reporting bugs and security issues

- **Non-security bugs:** open a GitHub issue using the bug template.
- **Security vulnerabilities:** follow [`SECURITY.md`](SECURITY.md) — email,
  don't file a public issue.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):
`type(scope): summary`, e.g. `fix(sdk): keep x402 amount bigint end-to-end`.

By contributing you agree your contributions are licensed under the repository's
license.
